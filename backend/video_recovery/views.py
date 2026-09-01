from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import VideoRecoveryJob
from .serializers import PIPELINE_STAGES, VideoRecoveryJobSerializer
from .services.corruption_types import CORRUPTION_CATALOG
from .services.ffmpeg_utils import ffmpeg_available
from .services.pipeline import schedule_recovery


class VideoRecoveryUploadAPIView(APIView):
    """POST /api/video-recovery/upload/ — upload a damaged video and start recovery."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get("file") or request.FILES.get("video")
        if not upload:
            return Response({"detail": "file is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not ffmpeg_available():
            return Response(
                {"detail": "ffmpeg/ffprobe not available on the server."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        job = VideoRecoveryJob.objects.create(
            original_filename=getattr(upload, "name", "") or "upload.mp4",
            original_file=upload,
            uploaded_by=request.user,
        )
        schedule_recovery(str(job.id))
        return Response(
            VideoRecoveryJobSerializer(job, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class VideoRecoveryJobListAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = VideoRecoveryJob.objects.all().order_by("-created_at")[:100]
        return Response(
            VideoRecoveryJobSerializer(qs, many=True, context={"request": request}).data
        )


class VideoRecoveryJobDetailAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, job_id):
        try:
            job = VideoRecoveryJob.objects.get(pk=job_id)
        except VideoRecoveryJob.DoesNotExist:
            return Response({"detail": "Job not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(VideoRecoveryJobSerializer(job, context={"request": request}).data)


class VideoRecoveryRetryAPIView(APIView):
    """POST /api/video-recovery/jobs/<id>/retry/ — re-run recovery pipeline."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, job_id):
        try:
            job = VideoRecoveryJob.objects.get(pk=job_id)
        except VideoRecoveryJob.DoesNotExist:
            return Response({"detail": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        job.stage_logs = []
        job.forensic_report = {}
        job.damage_map = {}
        job.hybrid_report = {}
        job.quality_report = {}
        job.error_message = ""
        job.completed_at = None
        if job.recovered_file:
            job.recovered_file.delete(save=False)
        job.save()
        schedule_recovery(str(job.id))
        return Response(VideoRecoveryJobSerializer(job, context={"request": request}).data)


class VideoRecoveryPipelineSchemaAPIView(APIView):
    """GET /api/video-recovery/pipeline/ — pipeline architecture metadata."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "name": "Hybrid Video Recovery + Regeneration",
                "principle": "Recover what is real + Regenerate what is lost",
                "stages": PIPELINE_STAGES,
                "flow": [
                    "Video Upload",
                    "Upload Validation",
                    "Preserve Original (SHA-256)",
                    "Deep Damage Analysis",
                    "Damage Map",
                    "Recovery Engine (container → stream → frame)",
                    "Regeneration Engine (restore / interpolate / generate)",
                    "Hybrid Merger",
                    "Temporal Consistency",
                    "Audio Recovery",
                    "Video Encoding",
                    "Quality Validation",
                    "Final Output",
                ],
                "corruption_types": CORRUPTION_CATALOG,
            }
        )
