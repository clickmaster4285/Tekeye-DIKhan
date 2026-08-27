"""
FastAPI inference server for Custom VMS integration.

Run (Server 2 / local ML host):
  cd ml_services
  python api_server.py

Or:
  uvicorn api_server:app --host 0.0.0.0 --port 8100
"""
from __future__ import annotations

import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from load_env import load_ml_env

load_ml_env()

from inference_engine import (  # noqa: E402
    decode_image,
    detect_image,
    extract_face_embedding,
    health_status,
    recognize_face,
    reload_face_db,
    validate_human_face,
    warmup_all_models,
)
from live_stream import get_live_manager  # noqa: E402

_live = get_live_manager()


def _boot_live_streams():
    try:
        warmup_all_models()
        from plate_recognizer import get_plate_engine

        get_plate_engine()
        _live.configure_from_env()
        _live.ensure_started()
    except Exception as exc:
        print(f"[live] Background boot failed: {exc}")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    threading.Thread(target=_boot_live_streams, daemon=True, name="live-boot").start()
    yield
    _live.stop()


app = FastAPI(title="Custom ML Inference", version="1.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FaceEmbeddingEntry(BaseModel):
    identity: str
    embedding: list[float] = Field(default_factory=list)
    quality: float | None = None


class ThresholdCalibrationRequest(BaseModel):
    genuine_scores: list[float] = Field(default_factory=list)
    impostor_scores: list[float] = Field(default_factory=list)
    target_far: float = 0.01


class CameraRegisterEntry(BaseModel):
    key: str
    rtsp_url: str
    purpose: str = ""
    purposes: list[str] = Field(default_factory=list)


def _resolve_live_stream(
    key: str,
    rtsp_url: str | None = None,
    *,
    purpose: str = "",
    purposes: str = "",
) -> str:
    _live.ensure_started()
    purpose_list = [p.strip() for p in (purposes or "").split(",") if p.strip()]
    if purpose_list or (purpose or "").strip():
        applied = _live.set_camera_purposes(key, purpose=purpose, purposes=purpose_list)
        print(f"[live] Purposes for {key}: {applied}")
    resolved = _live.resolve_rtsp_url(key, rtsp_url)
    if not resolved:
        raise HTTPException(
            status_code=404,
            detail=f"Camera {key} is not registered. Sync cameras from Django backend.",
        )
    if not _live.ensure_camera(key, resolved):
        raise HTTPException(status_code=503, detail=f"Could not open camera stream for {key}")
    return resolved


def _mjpeg_headers() -> dict[str, str]:
    return {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "X-Accel-Buffering": "no",
    }


@app.get("/health")
def health():
    data = health_status()
    data["live_streams"] = _live.status()
    return data


@app.post("/reload/faces")
def reload_faces(payload: list[FaceEmbeddingEntry] | None = None):
    entries = [
        {
            "identity": item.identity,
            "embedding": item.embedding,
            **({"quality": item.quality} if item.quality is not None else {}),
        }
        for item in (payload or [])
    ]
    count = reload_face_db(entries)
    return {"reloaded": True, "known_faces": count, "db_embeddings": len(entries)}


@app.post("/faces/calibrate")
def calibrate_face_threshold(payload: ThresholdCalibrationRequest):
    from face_calibration import suggest_threshold

    return suggest_threshold(
        payload.genuine_scores,
        payload.impostor_scores,
        target_far=payload.target_far,
    )


@app.post("/faces/extract")
async def extract_face_embedding_endpoint(image: UploadFile = File(...)):
    data = await image.read()
    try:
        frame = decode_image(data)
        result = extract_face_embedding(frame)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result


@app.post("/reid/extract")
async def extract_reid_embedding_endpoint(image: UploadFile = File(...)):
    from reid_extractor import extract_reid_embedding

    data = await image.read()
    try:
        frame = decode_image(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    embedding = extract_reid_embedding(frame)
    if not embedding:
        raise HTTPException(status_code=400, detail="Could not extract appearance embedding from image.")
    return {"embedding": embedding, "dim": len(embedding)}


@app.post("/detect/image")
async def detect(
    image: UploadFile = File(...),
    conf: float = 0.25,
    iou: float = 0.45,
    recognize_faces: bool = True,
):
    data = await image.read()
    try:
        frame = decode_image(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    detections = detect_image(
        frame,
        conf=conf,
        iou=iou,
        recognize_faces=recognize_faces,
    )
    return {"detections": detections, "count": len(detections)}


@app.post("/plates/detect")
async def detect_plates(
    image: UploadFile = File(...),
    conf: float | None = None,
    save: bool = True,
    camera_key: str = "",
):
    """License plate YOLO + EasyOCR. Saves accepted plates under media/licence plates/."""
    from plate_recognizer import get_plate_engine

    data = await image.read()
    try:
        frame = decode_image(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    engine = get_plate_engine()
    if not engine.available:
        raise HTTPException(
            status_code=503,
            detail="Plate model/OCR unavailable. Install easyocr and ensure plate weights exist.",
        )
    detections = engine.detect_and_read(
        frame,
        camera_key=camera_key.strip(),
        conf=conf,
        save=save,
        force_save=True,
    )
    return {
        "detections": detections,
        "count": len(detections),
        "accepted": sum(1 for d in detections if d.get("accepted")),
        "media_dir": "licence plates",
    }


@app.post("/recognize/face")
async def recognize(image: UploadFile = File(...)):
    data = await image.read()
    try:
        frame = decode_image(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return recognize_face(frame)


@app.post("/validate/human-face")
async def validate_face(image: UploadFile = File(...)):
    data = await image.read()
    try:
        frame = decode_image(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return validate_human_face(frame)


@app.get("/live/status")
def live_status():
    return _live.status()


@app.post("/live/register/bulk")
def register_cameras_bulk(payload: list[CameraRegisterEntry]):
    entries = []
    for item in payload:
        if not item.key.strip() or not item.rtsp_url.strip():
            continue
        entry = {
            "key": item.key.strip(),
            "rtsp_url": item.rtsp_url.strip(),
        }
        if item.purpose.strip():
            entry["purpose"] = item.purpose.strip()
        purposes = [p.strip() for p in (item.purposes or []) if str(p).strip()]
        if purposes:
            entry["purposes"] = purposes
        entries.append(entry)
    result = _live.register_cameras_bulk(entries)
    if not _live.ensure_started():
        print("[live] Warning: camera registry updated but infer loops did not start")
    return result


@app.delete("/live/cam/{camera_key}/register")
def unregister_camera(camera_key: str):
    key = camera_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="camera_key required")
    removed = _live.unregister_camera(key)
    return {"removed": removed, "key": key}


@app.get("/live/cam/{camera_key}/detections")
def live_detections(
    camera_key: str,
    rtsp_url: str | None = None,
    purpose: str = "",
    purposes: str = "",
):
    key = camera_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="camera_key required")
    _resolve_live_stream(key, rtsp_url, purpose=purpose, purposes=purposes)
    snapshot = _live.get_detection_snapshot(key)
    return {
        "ip": key,
        "key": key,
        "detections": snapshot.get("detections") or [],
        "purposes": _live._purposes_for(key),
        "frame_width": snapshot.get("frame_width") or 0,
        "frame_height": snapshot.get("frame_height") or 0,
        "display_width": snapshot.get("display_width") or 0,
        "display_height": snapshot.get("display_height") or 0,
        "count": len(snapshot.get("detections") or []),
    }


@app.get("/live/cam/{camera_key}/jpeg")
def live_jpeg(
    camera_key: str,
    rtsp_url: str | None = None,
    purpose: str = "",
    purposes: str = "",
):
    """Single latest JPEG — annotated when ready, otherwise raw (fast first paint)."""
    key = camera_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="camera_key required")
    _resolve_live_stream(key, rtsp_url, purpose=purpose, purposes=purposes)
    frame = _live.get_preview_jpeg(key)
    if not frame:
        raise HTTPException(status_code=503, detail="No frame yet")
    return Response(
        content=frame,
        media_type="image/jpeg",
        headers=_mjpeg_headers(),
    )


@app.get("/live/cam/{camera_key}/mjpeg")
def live_mjpeg(
    camera_key: str,
    rtsp_url: str | None = None,
    purpose: str = "",
    purposes: str = "",
):
    key = camera_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="camera_key required")
    _resolve_live_stream(key, rtsp_url, purpose=purpose, purposes=purposes)
    return StreamingResponse(
        _live.iter_mjpeg(key),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers=_mjpeg_headers(),
    )


@app.get("/live/cam/{camera_key}/mjpeg/raw")
def live_mjpeg_raw(
    camera_key: str,
    rtsp_url: str | None = None,
    purpose: str = "",
    purposes: str = "",
):
    key = camera_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="camera_key required")
    _resolve_live_stream(key, rtsp_url, purpose=purpose, purposes=purposes)
    return StreamingResponse(
        _live.iter_mjpeg_raw(key),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers=_mjpeg_headers(),
    )


@app.get("/live/cam/{camera_key}/mjpeg/attendance")
def live_mjpeg_attendance(
    camera_key: str,
    rtsp_url: str | None = None,
    width: int = 3840,
):
    """Native main-stream MJPEG for attendance clip capture (reuses ML RTSP session)."""
    key = camera_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="camera_key required")
    _resolve_live_stream(key, rtsp_url)
    target_width = max(640, min(4096, int(width or 3840)))
    return StreamingResponse(
        _live.iter_mjpeg_attendance(key, target_width=target_width),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers=_mjpeg_headers(),
    )


# ---------- Person Journey (Tek Eye) — parallel pipeline, does not alter live inference ----------


class JourneyCameraEntry(BaseModel):
    key: str
    rtsp_url: str
    camera_id: int | None = None
    zone: str = ""
    name: str = ""


class JourneyRegisterBulk(BaseModel):
    cameras: list[JourneyCameraEntry] = Field(default_factory=list)
    backend_ingest_url: str = ""
    ingest_token: str = ""


@app.get("/journey/status")
def journey_status():
    from journey_manager import get_journey_manager

    return get_journey_manager().status()


@app.post("/journey/register/bulk")
def journey_register_bulk(payload: JourneyRegisterBulk):
    from journey_manager import get_journey_manager

    mgr = get_journey_manager()
    return mgr.register_cameras_bulk(payload.model_dump())


@app.delete("/journey/cam/{camera_key}")
def journey_unregister_camera(camera_key: str):
    from journey_manager import get_journey_manager

    key = camera_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="camera_key required")
    removed = get_journey_manager().unregister_camera(key)
    return {"removed": removed, "key": key}


@app.post("/journey/stop-all")
def journey_stop_all():
    from journey_manager import get_journey_manager

    mgr = get_journey_manager()
    before = mgr.status()
    mgr.stop_all()
    return {"stopped": before.get("running_pipelines", 0), "cameras": before.get("cameras") or []}


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("ML_API_HOST", "0.0.0.0")
    port = int(os.getenv("ML_API_PORT", "8100"))
    uvicorn.run("api_server:app", host=host, port=port, reload=False)
