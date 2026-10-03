"""
On-prem speech-to-text for the TekEye voice agent (faster-whisper).

Audio never leaves the site: the browser sends short VAD-segmented WAV clips to Django,
which forwards them here. Handles English, Urdu and mixed speech.

Env:
  VOICE_STT_MODEL        whisper size or local path (default "small"; "medium" is more accurate for Urdu)
  VOICE_STT_DEVICE       auto | cuda | cpu (default auto)
  VOICE_STT_COMPUTE_TYPE default float16 on cuda, int8 on cpu
  VOICE_STT_BEAM_SIZE    decoding beams (default 5 on cuda, 1 on cpu for latency)
"""

from __future__ import annotations

import io
import math
import os
import threading

_model = None
_lock = threading.Lock()


def _load(force_cpu: bool = False):
    global _model
    if _model is not None and not force_cpu:
        return _model
    with _lock:
        if _model is not None and not force_cpu:
            return _model
        from faster_whisper import WhisperModel

        device = "cpu" if force_cpu else (os.getenv("VOICE_STT_DEVICE") or "auto").strip().lower()
        if device == "auto":
            try:
                import ctranslate2

                device = "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
            except Exception:
                device = "cpu"
        size = (os.getenv("VOICE_STT_MODEL") or "small").strip()
        explicit = "" if force_cpu else (os.getenv("VOICE_STT_COMPUTE_TYPE") or "").strip()
        # Older GPUs lack efficient float16; fall back instead of failing the ML node.
        candidates = [explicit] if explicit else (["float16", "int8_float16", "int8"] if device == "cuda" else ["int8"])
        last_exc = None
        for compute in candidates:
            try:
                _model = WhisperModel(size, device=device, compute_type=compute)
                print(f"[stt] Loaded faster-whisper '{size}' on {device} ({compute})")
                return _model
            except ValueError as exc:
                last_exc = exc
        raise last_exc


def available() -> bool:
    try:
        import faster_whisper  # noqa: F401

        return True
    except ImportError:
        return False


def _beam_size(model) -> int:
    explicit = (os.getenv("VOICE_STT_BEAM_SIZE") or "").strip()
    if explicit.isdigit() and int(explicit) > 0:
        return int(explicit)
    return 5 if model.model.device == "cuda" else 1


# Spoken Urdu and Hindi are nearly identical, so Whisper often detects Urdu speech as Hindi
# (or Punjabi/Sindhi) and writes Devanagari. Officers speak English or Urdu: re-decode those as Urdu.
_AS_URDU = {"hi", "pa", "sd", "ne", "mr", "bn", "gu", "ps", "fa", "ar"}


def _run(model, audio: bytes, language: str | None, prompt: str):
    def decode(lang):
        return model.transcribe(
            io.BytesIO(audio),
            language=lang or None,
            initial_prompt=prompt or None,
            beam_size=_beam_size(model),
            vad_filter=True,
            condition_on_previous_text=False,
        )

    # Language is detected before decoding starts (segments are lazy), so switching costs no extra decode.
    segments, info = decode(language)
    if not language and info.language in _AS_URDU:
        segments, _ = decode("ur")
        info.language = "ur"
    return list(segments), info


def transcribe(audio: bytes, *, language: str | None = None, prompt: str = "") -> dict:
    try:
        segments, info = _run(_load(), audio, language, prompt)
    except RuntimeError as exc:
        # CUDA runtime libs (cuBLAS / cuDNN) missing on this node: keep STT working on CPU.
        if not any(k in str(exc).lower() for k in ("cublas", "cudnn", "cuda")):
            raise
        print(f"[stt] GPU inference unavailable ({exc}); switching to CPU")
        segments, info = _run(_load(force_cpu=True), audio, language, prompt)
    text = " ".join(s.text.strip() for s in segments).strip()
    confidence = None
    if segments:
        avg_logprob = sum(s.avg_logprob for s in segments) / len(segments)
        confidence = round(math.exp(avg_logprob), 3)
    return {
        "text": text,
        "language": info.language,
        "language_probability": round(info.language_probability, 3),
        "duration": round(info.duration, 2),
        "confidence": confidence,
    }
