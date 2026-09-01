from django.urls import path

from .views import (
    VideoRecoveryJobDetailAPIView,
    VideoRecoveryJobListAPIView,
    VideoRecoveryPipelineSchemaAPIView,
    VideoRecoveryRetryAPIView,
    VideoRecoveryUploadAPIView,
)

urlpatterns = [
    path("video-recovery/upload/", VideoRecoveryUploadAPIView.as_view(), name="video-recovery-upload"),
    path("video-recovery/jobs/", VideoRecoveryJobListAPIView.as_view(), name="video-recovery-jobs"),
    path("video-recovery/jobs/<uuid:job_id>/", VideoRecoveryJobDetailAPIView.as_view(), name="video-recovery-job-detail"),
    path("video-recovery/jobs/<uuid:job_id>/retry/", VideoRecoveryRetryAPIView.as_view(), name="video-recovery-job-retry"),
    path("video-recovery/pipeline/", VideoRecoveryPipelineSchemaAPIView.as_view(), name="video-recovery-pipeline"),
]
