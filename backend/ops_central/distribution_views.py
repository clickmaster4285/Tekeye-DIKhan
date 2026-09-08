"""Distribution API views for IT Super Admin camera ↔ ML assignment."""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from cameras.models import Camera
from ops_central.models import RemoteServer

from .distribution import (
    apply_auto_distribute,
    assign_camera_to_server,
    build_distribution_board,
    preview_auto_distribute,
)
from .permissions import IsITSuperAdminOnly
from .serializers import AssignCameraSerializer, AutoDistributeSerializer


class DistributionBoardAPIView(APIView):
    """GET board: unassigned + per-ML-server camera lists."""

    permission_classes = [IsITSuperAdminOnly]

    def get(self, request):
        site_id = request.query_params.get("site_id")
        location_code = (request.query_params.get("location_code") or "").strip()
        parsed_site = None
        if site_id not in (None, ""):
            try:
                parsed_site = int(site_id)
            except (TypeError, ValueError):
                return Response({"detail": "Invalid site_id."}, status=status.HTTP_400_BAD_REQUEST)
        board = build_distribution_board(site_id=parsed_site, location_code=location_code)
        return Response(board)


class AssignCameraAPIView(APIView):
    """POST assign/move/unassign a camera to an ML server (routes live registration)."""

    permission_classes = [IsITSuperAdminOnly]

    def post(self, request):
        if "ml_server_id" not in request.data:
            return Response(
                {"detail": "ml_server_id is required (use null to unassign)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ser = AssignCameraSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        camera_id = ser.validated_data["camera_id"]
        ml_server_id = ser.validated_data.get("ml_server_id")
        enforce = ser.validated_data.get("enforce_capacity", True)

        if not Camera.objects.filter(pk=camera_id).exists():
            return Response({"detail": "Camera not found."}, status=status.HTTP_404_NOT_FOUND)
        if ml_server_id is not None and not RemoteServer.objects.filter(
            pk=ml_server_id, is_active=True
        ).exists():
            return Response({"detail": "ML server not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            result = assign_camera_to_server(
                camera_id,
                ml_server_id,
                enforce_capacity=bool(enforce),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Camera.DoesNotExist:
            return Response({"detail": "Camera not found."}, status=status.HTTP_404_NOT_FOUND)
        except RemoteServer.DoesNotExist:
            return Response({"detail": "ML server not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(result)


class AutoDistributeAPIView(APIView):
    """POST preview or apply balanced camera distribution across ML servers."""

    permission_classes = [IsITSuperAdminOnly]

    def post(self, request):
        ser = AutoDistributeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        site_id = ser.validated_data.get("site_id")
        location_code = (ser.validated_data.get("location_code") or "").strip()
        dry_run = bool(ser.validated_data.get("dry_run"))
        apply = bool(ser.validated_data.get("apply", True))
        try:
            if dry_run or not apply:
                result = preview_auto_distribute(site_id=site_id, location_code=location_code)
                result["applied"] = False
                result["moved"] = 0
            else:
                result = apply_auto_distribute(
                    site_id=site_id,
                    location_code=location_code,
                    dry_run=False,
                )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)
