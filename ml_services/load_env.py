"""Load ml_services/.env when running api_server standalone (systemd uses EnvironmentFile)."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

_ENV_FILE = Path(__file__).resolve().parent / ".env"


def load_ml_env() -> None:
    if _ENV_FILE.is_file():
        load_dotenv(dotenv_path=_ENV_FILE)
