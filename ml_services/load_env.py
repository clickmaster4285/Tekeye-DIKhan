"""Load ml_services/.env when running api_server standalone (systemd uses EnvironmentFile)."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_ENV_FILE = Path(__file__).resolve().parent / ".env"

# Cap native thread pools before PyTorch/ONNX/OpenCV load (per ML worker process).
for _env_key, _env_val in (
    ("OMP_NUM_THREADS", "1"),
    ("OPENBLAS_NUM_THREADS", "1"),
    ("MKL_NUM_THREADS", "1"),
    ("NUMEXPR_NUM_THREADS", "1"),
    ("VECLIB_MAXIMUM_THREADS", "1"),
    ("BLIS_NUM_THREADS", "1"),
):
    os.environ.setdefault(_env_key, _env_val)


def load_ml_env() -> None:
    if _ENV_FILE.is_file():
        load_dotenv(dotenv_path=_ENV_FILE)
