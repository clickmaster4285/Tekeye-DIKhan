from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings

from .client import (
    MLServiceError,
    ml_detect_image,
    ml_health,
    ml_reload_faces,
    ml_service_enabled,
    ml_validate_human_face,
)
from .face_sync import collect_db_face_embeddings


class MLHealthAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not ml_service_enabled():
            return Response(
                {
                    "status": "disabled",
                    "message": "Set ML_SERVICE_URL in backend/.env and start ml_services/api_server.py.",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            data = ml_health()
        except MLServiceError as exc:
            return Response(
                {"status": "error", "message": str(exc)},
                status=exc.status_code or status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"status": "ok", **data})


class MLDetectImageAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        image = request.FILES.get("image")
        if not image:
            return Response({"detail": "image file is required."}, status=400)
        try:
            result = ml_detect_image(image.read(), filename=image.name or "image.jpg")
        except MLServiceError as exc:
            return Response({"detail": str(exc)}, status=exc.status_code or 503)
        return Response(result)


class MLValidateHumanFaceAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        image = request.FILES.get("image")
        if not image:
            return Response({"detail": "image file is required."}, status=400)
        try:
            result = ml_validate_human_face(image.read(), filename=image.name or "face.jpg")
        except MLServiceError as exc:
            return Response({"detail": str(exc)}, status=exc.status_code or 503)
        return Response(result)


class MLReloadFacesAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            result = ml_reload_faces(embeddings=collect_db_face_embeddings())
        except MLServiceError as exc:
            return Response({"detail": str(exc)}, status=exc.status_code or 503)
        return Response(result)


def _form_float(request, name: str, default: float) -> float:
    raw = request.data.get(name, request.query_params.get(name, default))
    try:
        return float(raw)
    except (TypeError, ValueError):
        return default


class MLVideoSearchAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if not ml_service_enabled():
            return Response(
                {"detail": "ML service is not configured. Set ML_SERVICE_URL and start ml_services."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        image = request.FILES.get("image")
        video = request.FILES.get("video")
        if not image:
            return Response({"detail": "image file is required."}, status=400)
        if not video:
            return Response({"detail": "video file is required."}, status=400)

        max_bytes = int(getattr(settings, "ML_VIDEO_SEARCH_MAX_BYTES", 8 * 1024 * 1024 * 1024))
        video_size = int(getattr(video, "size", 0) or 0)
        if video_size > 0 and max_bytes > 0 and video_size > max_bytes:
            max_gb = max_bytes / (1024 * 1024 * 1024)
            return Response(
                {
                    "detail": (
                        f"Video is too large ({video_size / (1024 ** 3):.1f} GB). "
                        f"Maximum allowed is {max_gb:.0f} GB for Find in Video."
                    )
                },
                status=400,
            )

        from .video_search_jobs import start_job

        payload = start_job(
            image,
            video,
            {
                "clip_seconds": min(5.0, max(2.0, _form_float(request, "clip_seconds", 4.0))),
                "face_threshold": _form_float(request, "face_threshold", 0.45),
                "reid_threshold": _form_float(request, "reid_threshold", 0.88),
                "sample_fps": _form_float(request, "sample_fps", 0.0),
            },
        )
        return Response(payload, status=status.HTTP_202_ACCEPTED)

    def get(self, request):
        job_id = (request.query_params.get("job_id") or "").strip()
        if not job_id:
            return Response({"detail": "job_id is required."}, status=400)
        from .video_search_jobs import read_status

        row = read_status(job_id)
        if not row:
            return Response({"detail": "Search job not found."}, status=404)
        return Response(row)
