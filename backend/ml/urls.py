from django.urls import path

from .views import (
  MLDetectImageAPIView,
  MLHealthAPIView,
  MLReloadFacesAPIView,
  MLValidateHumanFaceAPIView,
  MLVideoAnalyzeAPIView,
  MLVideoAnalyzeFileAPIView,
  MLVideoSearchAPIView,
)

urlpatterns = [
  path("ml/health/", MLHealthAPIView.as_view(), name="ml-health"),
  path("ml/detect/", MLDetectImageAPIView.as_view(), name="ml-detect"),
  path("ml/validate/human-face/", MLValidateHumanFaceAPIView.as_view(), name="ml-validate-face"),
  path("ml/reload-faces/", MLReloadFacesAPIView.as_view(), name="ml-reload-faces"),
  path("ml/search/video/", MLVideoSearchAPIView.as_view(), name="ml-search-video"),
  path("ml/analyze-video/", MLVideoAnalyzeAPIView.as_view(), name="ml-analyze-video"),
  path("ml/analyze-video/<str:job_id>/file/", MLVideoAnalyzeFileAPIView.as_view(), name="ml-analyze-video-file"),
]
