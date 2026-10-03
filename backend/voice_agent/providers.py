"""
Pluggable LLM providers for the voice agent.

Each provider keeps conversation history in its own native message format (stored
on VoiceSession.history) and exposes the same small surface to the agent loop:
append_user / complete / append_tool_results / append_assistant_text.

VOICE_AGENT_PROVIDER=anthropic (default) or ollama.
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class AgentUnavailable(Exception):
    """The LLM backend could not be reached / refused the request. Message is safe to speak."""


@dataclass
class ToolCall:
    id: str
    name: str
    input: dict


@dataclass
class StepResult:
    text: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    refused: bool = False


def _append_user_content(history: list, content: str) -> None:
    """Append a user turn, merging into a trailing user message (e.g. after tool results)."""
    if history and history[-1].get("role") == "user":
        last = history[-1]
        blocks = last["content"] if isinstance(last["content"], list) else [{"type": "text", "text": last["content"]}]
        last["content"] = [*blocks, {"type": "text", "text": content}]
    else:
        history.append({"role": "user", "content": content})


class AnthropicProvider:
    name = "anthropic"

    def __init__(self):
        import anthropic

        self._anthropic = anthropic
        # Credentials resolve from the environment (ANTHROPIC_API_KEY etc.).
        self.client = anthropic.Anthropic(timeout=90.0, max_retries=2)
        self.model = getattr(settings, "VOICE_AGENT_MODEL", "") or "claude-opus-5"
        self.effort = getattr(settings, "VOICE_AGENT_EFFORT", "") or "low"

    def append_user(self, history: list, text: str) -> None:
        _append_user_content(history, text)

    def append_assistant_text(self, history: list, text: str) -> None:
        history.append({"role": "assistant", "content": text})

    def complete(self, system: str, tools: list, history: list) -> StepResult:
        a = self._anthropic
        try:
            response = self.client.beta.messages.create(
                model=self.model,
                max_tokens=16000,
                system=system,
                tools=[
                    {"name": t.name, "description": t.description, "input_schema": t.input_schema}
                    for t in tools
                ],
                messages=history,
                thinking={"type": "adaptive"},
                output_config={"effort": self.effort},
                # Tools + system prompt are a stable prefix; cache them across turns.
                cache_control={"type": "ephemeral"},
                # On a safety decline, the API re-runs the request on a fallback model.
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
        except a.AuthenticationError as exc:
            logger.error("[voice_agent] Anthropic auth failed: %s", exc)
            raise AgentUnavailable("The AI service is not configured. Please contact IT.") from exc
        except a.RateLimitError as exc:
            raise AgentUnavailable("The AI service is busy. Please try again in a moment.") from exc
        except a.APIConnectionError as exc:
            raise AgentUnavailable("I can't reach the AI service right now.") from exc
        except a.APIStatusError as exc:
            logger.error("[voice_agent] Anthropic error %s: %s", exc.status_code, exc.message)
            raise AgentUnavailable("The AI service returned an error. Please try again.") from exc

        # Preserve every block (thinking, fallback, tool_use) unchanged for the next request.
        history.append(
            {"role": "assistant", "content": [b.to_dict(mode="json", exclude_none=True) for b in response.content]}
        )

        if response.stop_reason == "refusal":
            return StepResult(text="I can't help with that request.", refused=True)
        text = " ".join(b.text for b in response.content if b.type == "text").strip()
        calls = [
            ToolCall(id=b.id, name=b.name, input=b.input if isinstance(b.input, dict) else {})
            for b in response.content
            if b.type == "tool_use"
        ]
        return StepResult(text=text, tool_calls=calls)

    def append_tool_results(self, history: list, results: list[tuple[ToolCall, dict, bool]]) -> None:
        # All results for one assistant turn go back in a single user message.
        history.append(
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": call.id,
                        "content": json.dumps(payload, default=str, ensure_ascii=False),
                        "is_error": is_error,
                    }
                    for call, payload, is_error in results
                ],
            }
        )


OLLAMA_MAX_MESSAGES = 60


def _recent(history: list) -> list:
    """Long chats overflow a small local model's context: send the latest messages, starting at a user turn."""
    if len(history) <= OLLAMA_MAX_MESSAGES:
        return history
    tail = history[-OLLAMA_MAX_MESSAGES:]
    for i, msg in enumerate(tail):
        if msg.get("role") == "user":
            return tail[i:]
    return tail


class OllamaProvider:
    """Fully on-prem option (e.g. qwen2.5 / llama3.1 with tool support) via Ollama's /api/chat."""

    name = "ollama"

    def __init__(self):
        self.base_url = (getattr(settings, "VOICE_AGENT_OLLAMA_URL", "") or "http://127.0.0.1:11434").rstrip("/")
        self.model = getattr(settings, "VOICE_AGENT_OLLAMA_MODEL", "") or "qwen2.5:14b"
        # Ollama's default 4k context silently truncates the system prompt + tools once history grows.
        self.num_ctx = int(getattr(settings, "VOICE_AGENT_OLLAMA_NUM_CTX", 16384))
        # Keep the model resident; a cold reload costs ~10s on the first turn after idle.
        self.keep_alive = getattr(settings, "VOICE_AGENT_OLLAMA_KEEP_ALIVE", "") or "60m"

    def append_user(self, history: list, text: str) -> None:
        history.append({"role": "user", "content": text})

    def append_assistant_text(self, history: list, text: str) -> None:
        history.append({"role": "assistant", "content": text})

    def complete(self, system: str, tools: list, history: list) -> StepResult:
        body = {
            "model": self.model,
            "stream": False,
            "keep_alive": self.keep_alive,
            "options": {"num_ctx": self.num_ctx, "temperature": 0.2},
            "messages": [{"role": "system", "content": system}, *_recent(history)],
            "tools": [
                {
                    "type": "function",
                    "function": {"name": t.name, "description": t.description, "parameters": t.input_schema},
                }
                for t in tools
            ],
        }
        try:
            resp = requests.post(f"{self.base_url}/api/chat", json=body, timeout=300)
            resp.raise_for_status()
            msg = resp.json().get("message") or {}
        except (requests.RequestException, ValueError) as exc:
            logger.error("[voice_agent] Ollama error: %s", exc)
            raise AgentUnavailable("I can't reach the local AI model right now.") from exc

        raw_calls = msg.get("tool_calls") or []
        history.append({"role": "assistant", "content": msg.get("content") or "", "tool_calls": raw_calls})
        calls = []
        for rc in raw_calls:
            fn = rc.get("function") or {}
            args = fn.get("arguments") or {}
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except ValueError:
                    args = {}
            calls.append(ToolCall(id=uuid.uuid4().hex, name=fn.get("name") or "", input=args))
        return StepResult(text=(msg.get("content") or "").strip(), tool_calls=calls)

    def append_tool_results(self, history: list, results: list[tuple[ToolCall, dict, bool]]) -> None:
        for call, payload, _is_error in results:
            history.append(
                {
                    "role": "tool",
                    "tool_name": call.name,
                    "content": json.dumps(payload, default=str, ensure_ascii=False),
                }
            )


_PROVIDERS = {"anthropic": AnthropicProvider, "ollama": OllamaProvider}
_instance = None


def get_provider():
    global _instance
    name = (getattr(settings, "VOICE_AGENT_PROVIDER", "") or "anthropic").strip().lower()
    if _instance is None or _instance.name != name:
        cls = _PROVIDERS.get(name)
        if cls is None:
            raise AgentUnavailable(f"Unknown VOICE_AGENT_PROVIDER '{name}'.")
        _instance = cls()
    return _instance
