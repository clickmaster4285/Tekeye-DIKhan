from pathlib import Path
import os
import shutil
import sys
import warnings

from dotenv import load_dotenv

# requests warns when urllib3/chardet/charset_normalizer are newer than its pinned range.
# The client still works; keep worker logs free of that startup noise.
warnings.filterwarnings(
    "ignore",
    message=r"urllib3 .* or chardet .*/charset_normalizer .* doesn't match a supported version",
)
# insightface 0.7 calls skimage SimilarityTransform.estimate(), deprecated in scikit-image 0.26.
# Face alignment still works; silence the per-face FutureWarning until insightface updates.
warnings.filterwarnings(
    "ignore",
    message=r"`estimate` is deprecated",
    category=FutureWarning,
)

# -----------------------------
# Base Directory
# -----------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent

# -----------------------------
# Load Environment Variables (backend/.env only)
# -----------------------------
load_dotenv(dotenv_path=BASE_DIR / ".env")


def _env_list(key: str, default: str = "") -> list[str]:
    """Read comma-separated list from .env."""
    value = os.getenv(key, default).strip()
    return [v.strip() for v in value.split(",") if v.strip()]


# Dev fallback hosts so DisallowedHost is avoided even if .env is missing or ALLOWED_HOSTS empty
_DEFAULT_DEV_HOSTS = ["127.0.0.1", "localhost",
                      "127.0.0.1:8000", "localhost:8000"]

# -----------------------------
# Security Settings
# -----------------------------
_SECRET_KEY = os.getenv("SECRET_KEY")
if not _SECRET_KEY and os.getenv("DEBUG", "False").lower() in ("true", "1", "yes"):
    # Allow a dev-only default only when DEBUG is explicitly enabled
    _SECRET_KEY = "dev-secret-key-do-not-use-in-production"
if not _SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY environment variable is required. "
        "Set it in .env or export SECRET_KEY=your-secret-key (never use the dev default in production)."
    )
SECRET_KEY = _SECRET_KEY
DEBUG = os.getenv("DEBUG", "False") == "True"
ALLOWED_HOSTS = _env_list("ALLOWED_HOSTS") or []
# In debug/development, allow LAN/IP access without frequent ALLOWED_HOSTS edits.
if DEBUG:
    ALLOWED_HOSTS = ["*"]

# -----------------------------
# Installed Apps
# -----------------------------
INSTALLED_APPS = [
    # Django Default Apps
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    'django_filters',  # Add this line


    # Third-party
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",

    # Local apps
    "users",
    "visitors",
    'logs',
      "seizure_management",
    "detentions",
    "cameras",
    "warehouse",
    "ml.apps.MlConfig",
    "person_journey.apps.PersonJourneyConfig",
    "object_tracking.apps.ObjectTrackingConfig",
    "recognition.apps.RecognitionConfig",
    "ops_central.apps.OpsCentralConfig",
    "gps_tracking.apps.GpsTrackingConfig",
    "video_recovery.apps.VideoRecoveryConfig",
    "camera_health.apps.CameraHealthConfig",
    "realtime.apps.RealtimeConfig",
    "infrastructure_monitoring.apps.InfrastructureMonitoringConfig",
    "voice_agent.apps.VoiceAgentConfig",
]

# -----------------------------
# Middleware
# -----------------------------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # Must be first
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # for Logs
    'logs.middleware.ActivityLogMiddleware',
]

# -----------------------------
# CORS Settings
# -----------------------------
CORS_ALLOW_ALL_ORIGINS = os.getenv("CORS_ALLOW_ALL_ORIGINS", "True") == "True"
if not CORS_ALLOW_ALL_ORIGINS:
    CORS_ALLOWED_ORIGINS = _env_list("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "origin",
    "user-agent",
    "x-requested-with",
]
CORS_EXPOSE_HEADERS = ["Content-Type", "Authorization"]

# -----------------------------
# URL & Templates
# -----------------------------
ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# -----------------------------
# Database
# -----------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
        "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "0")),
        "CONN_HEALTH_CHECKS": True,
    }
}

# Guard: runserver spawns a new thread per request, so persistent connections
# (CONN_MAX_AGE > 0) are never reused or closed and pile up until Postgres hits
# max_connections — every page then 500s. Only keep connections open under a
# real app server (gunicorn/uvicorn/daphne) with a fixed worker pool.
if len(sys.argv) > 1 and sys.argv[1] == "runserver":
    DATABASES["default"]["CONN_MAX_AGE"] = 0

# -----------------------------
# REST Framework
# -----------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# -----------------------------
# Auth
# -----------------------------
AUTH_USER_MODEL = "users.User"

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# -----------------------------
# Internationalization
# -----------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = 'Asia/Karachi'
USE_I18N = True
USE_TZ = True

# -----------------------------
# Static & Media
# -----------------------------
STATIC_URL = "/static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

# File upload settings for detention memo uploads (photos, documents, videos).
# Note: These are for Django — nginx has a separate client_max_body_size limit.
# Default Django limits are 2.5MB for file and 2.5MB for form data.
# We increase both to 100MB to handle large image uploads that will be compressed.
# Large CCTV recordings (up to 1 hour) are streamed to disk, not held in RAM.
FILE_UPLOAD_MAX_MEMORY_SIZE = int(
    os.getenv("FILE_UPLOAD_MAX_MEMORY_SIZE", str(8 * 1024 * 1024)))  # 8MB
DATA_UPLOAD_MAX_MEMORY_SIZE = int(
    os.getenv("DATA_UPLOAD_MAX_MEMORY_SIZE", str(8 * 1024 * 1024 * 1024)))  # 8GB total POST

# Images are automatically compressed on the backend before storage
# This reduces stored file sizes significantly (typically 70-85% reduction)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

def _ffmpeg_ok(path: str | Path) -> bool:
    p = Path(path)
    if not p.is_file():
        return False
    if sys.platform == "win32":
        return True
    return os.access(p, os.X_OK)


def _resolve_ffmpeg_path() -> str:
    """Resolve ffmpeg: bundled (OS-specific), .env, then PATH."""
    bundled_name = "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg"
    bundled = PROJECT_ROOT / "tools" / "ffmpeg" / "bin" / bundled_name
    if _ffmpeg_ok(bundled):
        return str(bundled)
    custom = os.getenv("FFMPEG_PATH", "").strip()
    if custom and _ffmpeg_ok(custom):
        return custom
    on_path = shutil.which("ffmpeg") or shutil.which("ffmpeg.exe")
    if on_path:
        return on_path
    extras = [
        Path(r"C:\ffmpeg\bin") / bundled_name,
        Path(r"C:\Program Files\ffmpeg\bin") / bundled_name,
        Path(r"C:\ProgramData\chocolatey\bin") / bundled_name,
    ]
    for extra in extras:
        if _ffmpeg_ok(extra):
            return str(extra)
    return ""


FFMPEG_PATH = _resolve_ffmpeg_path()

# -----------------------------
# TekEye voice agent ("Hello Customs")
# -----------------------------
# anthropic (Claude API; needs ANTHROPIC_API_KEY) or ollama (fully on-prem LLM)
VOICE_AGENT_PROVIDER = os.getenv("VOICE_AGENT_PROVIDER", "anthropic").strip().lower()
VOICE_AGENT_MODEL = os.getenv("VOICE_AGENT_MODEL", "claude-opus-5").strip()
# low keeps spoken replies fast; raise to medium/high for harder investigations
VOICE_AGENT_EFFORT = os.getenv("VOICE_AGENT_EFFORT", "low").strip()
VOICE_AGENT_OLLAMA_URL = os.getenv("VOICE_AGENT_OLLAMA_URL", "http://127.0.0.1:11434").strip()
VOICE_AGENT_OLLAMA_MODEL = os.getenv("VOICE_AGENT_OLLAMA_MODEL", "qwen2.5:14b").strip()
# Chat mode sends ~25 tools plus long histories; 8k silently truncates the system prompt.
VOICE_AGENT_OLLAMA_NUM_CTX = int(os.getenv("VOICE_AGENT_OLLAMA_NUM_CTX", "16384"))
VOICE_AGENT_OLLAMA_KEEP_ALIVE = os.getenv("VOICE_AGENT_OLLAMA_KEEP_ALIVE", "60m").strip()
VOICE_AGENT_IDLE_TIMEOUT_SEC = int(os.getenv("VOICE_AGENT_IDLE_TIMEOUT_SEC", "45"))
# On-prem Whisper STT (ml_services /voice/transcribe); defaults to the first known ML node
VOICE_STT_URL = os.getenv("VOICE_STT_URL", "").strip()

# -----------------------------
# ML inference service (external ml_services/ on Server 2 — HTTP client only)
# -----------------------------
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "").strip()
ML_SERVICE_PUBLIC_URL = os.getenv(
    "ML_SERVICE_PUBLIC_URL",
    os.getenv("ML_SERVICE_URL", ""),
).strip().rstrip("/")
ML_SERVICE_TIMEOUT = int(os.getenv("ML_SERVICE_TIMEOUT", "60"))
ML_VIDEO_SEARCH_TIMEOUT = int(os.getenv("ML_VIDEO_SEARCH_TIMEOUT", "3600"))
ML_VIDEO_SEARCH_MAX_BYTES = int(
    os.getenv("ML_VIDEO_SEARCH_MAX_BYTES", str(8 * 1024 * 1024 * 1024))
)  # 8GB — typical 1-hour CCTV export
ML_VIDEO_ANALYZE_MAX_BYTES = int(
    os.getenv("ML_VIDEO_ANALYZE_MAX_BYTES", str(1 * 1024 * 1024 * 1024))
)  # 1GB — Video AI Test uploads
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").rstrip("/")

# -----------------------------
# go2rtc — All Cities viewing path (RTSP → WebRTC, separate from ML MJPEG)
# -----------------------------
GO2RTC_URL = os.getenv("GO2RTC_URL", "").strip().rstrip("/")
# h264 = ffmpeg transcode for Chrome/Edge WebRTC; copy = try native HEVC (limited browser support)
GO2RTC_VIDEO_MODE = os.getenv("GO2RTC_VIDEO_MODE", "h264").strip().lower()
GO2RTC_ENABLED = bool(GO2RTC_URL) and os.getenv("GO2RTC_ENABLED", "true").strip().lower() in (
    "true",
    "1",
    "yes",
)
# All Cities viewing path (direct NVR via ffmpeg) — 0 = native 4K (grid + fullscreen)
try:
    VIEW_STREAM_MAX_WIDTH = max(0, int(os.getenv("VIEW_STREAM_MAX_WIDTH", "0")))
except (TypeError, ValueError):
    VIEW_STREAM_MAX_WIDTH = 0
try:
    VIEW_STREAM_FPS = max(5, min(int(os.getenv("VIEW_STREAM_FPS", "15")), 30))
except (TypeError, ValueError):
    VIEW_STREAM_FPS = 15
try:
    VIEW_STREAM_JPEG_QUALITY = max(2, min(int(os.getenv("VIEW_STREAM_JPEG_QUALITY", "3")), 12))
except (TypeError, ValueError):
    VIEW_STREAM_JPEG_QUALITY = 3

# Video recovery — GPU acceleration (PyTorch CUDA + FFmpeg NVENC)
VIDEO_RECOVERY_USE_GPU = os.getenv("VIDEO_RECOVERY_USE_GPU", "True").lower() in ("true", "1", "yes")
VIDEO_RECOVERY_GPU_BATCH_SIZE = int(os.getenv("VIDEO_RECOVERY_GPU_BATCH_SIZE", "32"))

# Background detection worker (saves ML readings without browser open)
DETECTION_WORKER_ENABLED = os.getenv("DETECTION_WORKER_ENABLED", "True").lower() in ("true", "1", "yes")
DETECTION_WORKER_AUTO_START = os.getenv("DETECTION_WORKER_AUTO_START", "True").lower() in ("true", "1", "yes")
DETECTION_WORKER_INTERVAL_SEC = float(os.getenv("DETECTION_WORKER_INTERVAL_SEC", "2"))
DETECTION_WORKER_CAMERA_REFRESH_SEC = int(os.getenv("DETECTION_WORKER_CAMERA_REFRESH_SEC", "60"))
DETECTION_CLIP_REQUEUE_LIMIT = int(os.getenv("DETECTION_CLIP_REQUEUE_LIMIT", "50"))
DETECTION_CLIP_MAX_WORKERS = int(os.getenv("DETECTION_CLIP_MAX_WORKERS", "1"))
DETECTION_CLIP_MAX_QUEUE = int(os.getenv("DETECTION_CLIP_MAX_QUEUE", "50"))

# Camera Health / AI Suggestions — OpenCV metrics on sampled frames
CAMERA_HEALTH_WORKER_ENABLED = os.getenv("CAMERA_HEALTH_WORKER_ENABLED", "True").lower() in (
    "true",
    "1",
    "yes",
)
CAMERA_HEALTH_INTERVAL_SEC = float(os.getenv("CAMERA_HEALTH_INTERVAL_SEC", "45"))

# Infrastructure Monitoring — auto-sync cameras/NVRs + poll device status
INFRA_MONITORING_WORKER_ENABLED = os.getenv(
    "INFRA_MONITORING_WORKER_ENABLED", "True"
).lower() in ("true", "1", "yes")
INFRA_POLL_INTERVAL_SEC = float(os.getenv("INFRA_POLL_INTERVAL_SEC", "45"))

# Background worker throttling (cycle sleep + ffmpeg spawn spacing)
WORKER_MIN_CYCLE_SLEEP_MS = int(os.getenv("WORKER_MIN_CYCLE_SLEEP_MS", "100"))
FFMPEG_SNAPSHOT_MIN_INTERVAL_SEC = float(os.getenv("FFMPEG_SNAPSHOT_MIN_INTERVAL_SEC", "2"))
FFMPEG_SNAPSHOT_TIMEOUT_SEC = int(os.getenv("FFMPEG_SNAPSHOT_TIMEOUT_SEC", "12"))
FFMPEG_STIMEOUT_US = os.getenv("FFMPEG_STIMEOUT_US", "10000000")
FFMPEG_THREADS = os.getenv("FFMPEG_THREADS", "1")

# JPEG snapshot saved with each new detection event (DETECTION_CLIP_SECONDS is unused; kept for .env compat)
DETECTION_CLIP_ENABLED = os.getenv("DETECTION_CLIP_ENABLED", "true").strip().lower() in ("true", "1", "yes")
DETECTION_CLIP_SECONDS = int(os.getenv("DETECTION_CLIP_SECONDS", "7"))
# Min seconds before the same label/class on one camera is saved again (0 = save every poll)
DETECTION_DEDUP_SECONDS = int(os.getenv("DETECTION_DEDUP_SECONDS", "5"))
# Crowd: person_count > threshold → one DetectionEvent + realtime alert; clears when ≤ threshold
CROWD_ALERT_ENABLED = os.getenv("CROWD_ALERT_ENABLED", "true").strip().lower() in ("true", "1", "yes")
CROWD_ALERT_THRESHOLD = int(os.getenv("CROWD_ALERT_THRESHOLD", "10"))
CROWD_ALERT_MIN_CONFIDENCE = float(os.getenv("CROWD_ALERT_MIN_CONFIDENCE", "0.25"))
# Same episode technique for fire / smoke / weapon alerts (save once + notify once)
ALERT_EPISODE_ENABLED = os.getenv("ALERT_EPISODE_ENABLED", "true").strip().lower() in ("true", "1", "yes")
ALERT_EPISODE_MIN_CONFIDENCE = float(os.getenv("ALERT_EPISODE_MIN_CONFIDENCE", "0.25"))

# Attendance — InsightFace recognition + decision engine
ATTENDANCE_FACE_MIN_CONFIDENCE = float(os.getenv("ATTENDANCE_FACE_MIN_CONFIDENCE", "0.25"))
ATTENDANCE_CAMERA_MARK_COOLDOWN_SECONDS = int(os.getenv("ATTENDANCE_CAMERA_MARK_COOLDOWN_SECONDS", "120"))
ATTENDANCE_MIN_CHECKOUT_HOURS = float(os.getenv("ATTENDANCE_MIN_CHECKOUT_HOURS", "4"))
ATTENDANCE_MIN_CHECKOUT_AFTER_IN_MINUTES = float(
    os.getenv("ATTENDANCE_MIN_CHECKOUT_AFTER_IN_MINUTES", "1")
)
ATTENDANCE_WORK_START = os.getenv("ATTENDANCE_WORK_START", "09:00")
ATTENDANCE_LATE_AFTER = os.getenv("ATTENDANCE_LATE_AFTER", "09:30")
ATTENDANCE_MIN_ENROLLMENT_IMAGES = int(os.getenv("ATTENDANCE_MIN_ENROLLMENT_IMAGES", "5"))
ATTENDANCE_WEBCAM_SIMILARITY_THRESHOLD = float(
    os.getenv("ATTENDANCE_WEBCAM_SIMILARITY_THRESHOLD", "0.45")
)
ATTENDANCE_CCTV_SIMILARITY_THRESHOLD = float(
    os.getenv("ATTENDANCE_CCTV_SIMILARITY_THRESHOLD", "0.38")
)
# Shared Camera Session architecture: keep False so attendance consumes ML frames
# (face_recognition purpose) instead of opening a second OpenCV RTSP per camera.
ATTENDANCE_CCTV_AUTOSTART = os.getenv("ATTENDANCE_CCTV_AUTOSTART", "False").lower() in (
    "true",
    "1",
    "yes",
)
# shared = pull JPEG from ML Camera Session; rtsp = legacy independent OpenCV decode
ATTENDANCE_CCTV_FRAME_SOURCE = os.getenv("ATTENDANCE_CCTV_FRAME_SOURCE", "shared").strip().lower()
ATTENDANCE_INSIGHTFACE_MODEL = os.getenv("ATTENDANCE_INSIGHTFACE_MODEL", "buffalo_l")
# Comma-separated ONNX providers override, e.g. "CUDAExecutionProvider,TensorrtExecutionProvider,CPUExecutionProvider"
ATTENDANCE_ONNX_PROVIDERS = os.getenv("ATTENDANCE_ONNX_PROVIDERS", "")
# Visitor Identity gallery — separate from staff attendance. Never punches attendance.
VISITOR_MIN_ENROLLMENT_IMAGES = int(os.getenv("VISITOR_MIN_ENROLLMENT_IMAGES", "3"))
VISITOR_MAX_ENROLLMENT_IMAGES = int(os.getenv("VISITOR_MAX_ENROLLMENT_IMAGES", "5"))
VISITOR_FACE_SIMILARITY_THRESHOLD = float(os.getenv("VISITOR_FACE_SIMILARITY_THRESHOLD", "0.42"))
VISITOR_GALLERY_CACHE_SECONDS = int(os.getenv("VISITOR_GALLERY_CACHE_SECONDS", "30"))

ATTENDANCE_MARK_ON_FACE_RECOGNITION_CAMERAS = os.getenv(
    "ATTENDANCE_MARK_ON_FACE_RECOGNITION_CAMERAS", "True"
).lower() in ("true", "1", "yes")
ATTENDANCE_MARK_ON_ALL_CAMERAS = os.getenv("ATTENDANCE_MARK_ON_ALL_CAMERAS", "False").lower() in (
    "true",
    "1",
    "yes",
)
ATTENDANCE_SNAPSHOT_ENABLED = os.getenv("ATTENDANCE_SNAPSHOT_ENABLED", "True").lower() in (
    "true",
    "1",
    "yes",
)
ATTENDANCE_VIDEO_SECONDS = float(os.getenv("ATTENDANCE_VIDEO_SECONDS", "5"))
ATTENDANCE_VIDEO_FPS = int(os.getenv("ATTENDANCE_VIDEO_FPS", "10"))
ATTENDANCE_VIDEO_WIDTH = int(os.getenv("ATTENDANCE_VIDEO_WIDTH", "1280"))
ATTENDANCE_VIDEO_JPEG_QUALITY = int(os.getenv("ATTENDANCE_VIDEO_JPEG_QUALITY", "90"))
ATTENDANCE_VIDEO_CRF = int(os.getenv("ATTENDANCE_VIDEO_CRF", "18"))

# Person Journey — cross-camera tracking (parallel to detection worker; does not replace it)
PERSON_JOURNEY_WORKER_ENABLED = os.getenv("PERSON_JOURNEY_WORKER_ENABLED", "False").lower() in (
    "true",
    "1",
    "yes",
)
PERSON_JOURNEY_SYNC_INTERVAL_SEC = int(os.getenv("PERSON_JOURNEY_SYNC_INTERVAL_SEC", "60"))
PERSON_JOURNEY_BACKEND_URL = os.getenv("PERSON_JOURNEY_BACKEND_URL", "http://127.0.0.1:8000").strip()
_ingest_token = os.getenv("PERSON_JOURNEY_INGEST_TOKEN", "").strip()
if not _ingest_token:
    import hashlib

    _ingest_token = hashlib.sha256(f"tekeye-journey-ingest:{SECRET_KEY}".encode()).hexdigest()
PERSON_JOURNEY_INGEST_TOKEN = _ingest_token
PERSON_JOURNEY_LIVE_INGEST_ENABLED = os.getenv("PERSON_JOURNEY_LIVE_INGEST_ENABLED", "True").lower() in (
    "true",
    "1",
    "yes",
)
PERSON_JOURNEY_LIVE_INGEST_INTERVAL_SEC = float(os.getenv("PERSON_JOURNEY_LIVE_INGEST_INTERVAL_SEC", "2"))
PERSON_JOURNEY_LIVE_CAMERA_REFRESH_SEC = int(os.getenv("PERSON_JOURNEY_LIVE_CAMERA_REFRESH_SEC", "60"))
# When journey ML pipelines are ingesting, live ingest skips unknowns (pipeline uses track+ReID).
# Leave empty for auto-detect; set True/False to force.
PERSON_JOURNEY_LIVE_INGEST_UNKNOWN_ENABLED = os.getenv("PERSON_JOURNEY_LIVE_INGEST_UNKNOWN_ENABLED", "")
# When False (default), one timeline record per camera visit — extended while the person stays.
# When True, every sighting is stored as its own row (noisy).
JOURNEY_KEEP_ALL_EVENTS = os.getenv("JOURNEY_KEEP_ALL_EVENTS", "False").lower() in ("true", "1", "yes")
# A person's stay on one camera is ONE timeline record; out of view longer than this (or seen on another
# camera meanwhile) starts a new visit record with its own snapshot.
JOURNEY_VISIT_GAP_SECONDS = float(os.getenv("JOURNEY_VISIT_GAP_SECONDS", "120"))
PERSON_JOURNEY_INGEST_DEDUP_SECONDS = float(os.getenv("PERSON_JOURNEY_INGEST_DEDUP_SECONDS", "3"))
JOURNEY_FACE_MATCH_THRESHOLD = float(os.getenv("JOURNEY_FACE_MATCH_THRESHOLD", "0.72"))
# OSNet features are non-negative: different people typically score 0.55–0.70 cosine on these cameras
# (measured: 65% of different-people pairs pass 0.55). Track-averaged same-person scores are ~0.85+.
JOURNEY_REID_MATCH_THRESHOLD = float(os.getenv("JOURNEY_REID_MATCH_THRESHOLD", "0.80"))
# Stricter bar when the person was last seen longer ago than JOURNEY_RECENT_WINDOW_SECONDS.
JOURNEY_REID_LONG_GAP_THRESHOLD = float(os.getenv("JOURNEY_REID_LONG_GAP_THRESHOLD", "0.85"))
# Best candidate must beat the runner-up by this much, otherwise the identity is ambiguous (new ID).
JOURNEY_REID_MARGIN = float(os.getenv("JOURNEY_REID_MARGIN", "0.04"))
# How long clothing-based (ReID) re-identification remembers a person; faces are remembered longer.
JOURNEY_REID_MEMORY_HOURS = float(os.getenv("JOURNEY_REID_MEMORY_HOURS", "12"))
JOURNEY_FACE_MEMORY_DAYS = float(os.getenv("JOURNEY_FACE_MEMORY_DAYS", "30"))
# A person with another live track on the same camera within this many seconds cannot be the new track.
JOURNEY_SIMULTANEOUS_SECONDS = float(os.getenv("JOURNEY_SIMULTANEOUS_SECONDS", "4"))
# Every minute, recent IDs whose averaged appearance is at least this similar — and that were never on the
# same camera at the same time — are merged (heals one person split into several IDs).
JOURNEY_CONSOLIDATE_THRESHOLD = float(os.getenv("JOURNEY_CONSOLIDATE_THRESHOLD", "0.82"))
# Two IDs seen on DIFFERENT cameras at the same time for longer than this are different people (0 = off,
# e.g. when two cameras watch the same area).
JOURNEY_CROSS_CAMERA_OVERLAP_SECONDS = float(os.getenv("JOURNEY_CROSS_CAMERA_OVERLAP_SECONDS", "30"))
# An "active" local track not updated for this long is finished; its ByteTrack id may be reused by someone else.
JOURNEY_TRACK_STALE_SECONDS = float(os.getenv("JOURNEY_TRACK_STALE_SECONDS", "60"))
# Legacy (no longer used for decisions; kept so old .env files still load).
JOURNEY_REID_CROSS_CAMERA_THRESHOLD = float(os.getenv("JOURNEY_REID_CROSS_CAMERA_THRESHOLD", "0.80"))
JOURNEY_COMBINED_MATCH_THRESHOLD = float(os.getenv("JOURNEY_COMBINED_MATCH_THRESHOLD", "0.70"))
JOURNEY_MAX_TRAVEL_SECONDS = int(os.getenv("JOURNEY_MAX_TRAVEL_SECONDS", "300"))
JOURNEY_RECENT_WINDOW_SECONDS = int(os.getenv("JOURNEY_RECENT_WINDOW_SECONDS", "900"))
# Unknown journeys require person-like bbox + (face/ReID or this confidence).
JOURNEY_UNKNOWN_MIN_CONFIDENCE = float(os.getenv("JOURNEY_UNKNOWN_MIN_CONFIDENCE", "0.88"))
# 3840 = 4K width cap; 0 = native camera resolution (no ffmpeg scale).
# Shared-session default: prefer ML Camera Session frames (JOURNEY_SNAPSHOT_NATIVE=False).
JOURNEY_SNAPSHOT_WIDTH = int(os.getenv("JOURNEY_SNAPSHOT_WIDTH", "1920"))
JOURNEY_SNAPSHOT_JPEG_QUALITY = int(os.getenv("JOURNEY_SNAPSHOT_JPEG_QUALITY", "98"))
# Person Journey UI always shows the cropped person. When True, also store the
# annotated full camera frame on the event (metadata.full_snapshot_path).
JOURNEY_SNAPSHOT_FULL_FRAME = os.getenv("JOURNEY_SNAPSHOT_FULL_FRAME", "True").lower() in (
    "true",
    "1",
    "yes",
)
JOURNEY_SNAPSHOT_NATIVE = os.getenv("JOURNEY_SNAPSHOT_NATIVE", "False").lower() in (
    "true",
    "1",
    "yes",
)
JOURNEY_SNAPSHOT_CROP_MIN_SIDE = int(os.getenv("JOURNEY_SNAPSHOT_CROP_MIN_SIDE", "720"))
JOURNEY_SNAPSHOT_CROP_MAX_SIDE = int(os.getenv("JOURNEY_SNAPSHOT_CROP_MAX_SIDE", "1600"))
JOURNEY_SNAPSHOT_MAX_WORKERS = int(os.getenv("JOURNEY_SNAPSHOT_MAX_WORKERS", "1"))
JOURNEY_SNAPSHOT_MAX_QUEUE = int(os.getenv("JOURNEY_SNAPSHOT_MAX_QUEUE", "40"))
JOURNEY_SNAPSHOT_TASK_TIMEOUT_SEC = float(os.getenv("JOURNEY_SNAPSHOT_TASK_TIMEOUT_SEC", "30"))
# When False, detection/journey/attendance snapshots never open a second FFmpeg RTSP.
CLIP_ALLOW_DIRECT_RTSP = os.getenv("CLIP_ALLOW_DIRECT_RTSP", "False").lower() in (
    "true",
    "1",
    "yes",
)

# CCTV stream FPS for ffmpeg proxy (RTSP URLs are built dynamically from NVR DB records)
CAMERA_STREAM_FPS = int(os.getenv("ML_LIVE_STREAM_FPS", "25"))
# 0 = native 4K from NVR main stream in Django camera preview MJPEG
CAMERA_PREVIEW_MAX_WIDTH = int(os.getenv("CAMERA_PREVIEW_MAX_WIDTH", "0"))
# Never fall back to NVR substream for attendance/CCTV OpenCV readers
RTSP_MAIN_STREAM_ONLY = os.getenv("RTSP_MAIN_STREAM_ONLY", "True").lower() in ("true", "1", "yes")

# CIIS PWA mobile device / session enforcement
CIIS_HEARTBEAT_INTERVAL = int(os.getenv("CIIS_HEARTBEAT_INTERVAL", "60"))
CIIS_DEVICE_STALE_AFTER = int(os.getenv("CIIS_DEVICE_STALE_AFTER", "180"))
CIIS_DEVICE_OFFLINE_ALERT_AFTER = int(os.getenv("CIIS_DEVICE_OFFLINE_ALERT_AFTER", "300"))
CIIS_DEVICE_OFFLINE_EXTENDED_AFTER = int(os.getenv("CIIS_DEVICE_OFFLINE_EXTENDED_AFTER", "600"))
CIIS_GPS_OFFLINE_AFTER = int(os.getenv("CIIS_GPS_OFFLINE_AFTER", "300"))
CIIS_MONITOR_INTERVAL = int(os.getenv("CIIS_MONITOR_INTERVAL", "60"))
CIIS_MAX_ACTIVE_MOBILE_DEVICES = int(os.getenv("CIIS_MAX_ACTIVE_MOBILE_DEVICES", "1"))
# ALLOW_WITH_ALERT | BLOCK | REVOKE_OLD
CIIS_MULTI_DEVICE_POLICY = os.getenv("CIIS_MULTI_DEVICE_POLICY", "ALLOW_WITH_ALERT").strip().upper()
