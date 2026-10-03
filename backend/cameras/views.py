"""Camera registry and ML detection on camera frames."""

from __future__ import annotations

from django.conf import settings
from django.db.models import Q
from django.http import StreamingHttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ml.client import (
    MLServiceError,
    ml_assigned_mjpeg_public_url,
    ml_detect_image,
    ml_live_detections_for_camera,
    ml_service_enabled,
)

from .clip_capture import schedule_detection_clip
from .detection_utils import filter_detections_for_camera, resolve_staff_identity
from .detection_utils import save_detection_batch
from .search_utils import apply_detection_search
from .models import Camera, CameraPurpose, ClipStatus, DetectionEvent, Nvr, Site
from .rtsp_utils import build_rtsp_url_for_preview
from .serializers import (
    BulkCameraCreateSerializer,
    CameraSerializer,
    CameraWriteSerializer,
    DetectionEventSerializer,
    NvrSerializer,
    SiteSerializer,
    nvr_brand_options,
    purpose_options,
)
from .stream_utils import capture_jpeg_frame, ffmpeg_available, generate_mjpeg_frames
from users.permissions import IsGlobalAdmin, is_global_admin


def _token_key_from_request(request) -> str | None:
    key = (request.query_params.get("token") or request.GET.get("token") or "").strip()
    if key:
        return key
    auth = (request.META.get("HTTP_AUTHORIZATION") or "").strip()
    if auth.lower().startswith("token "):
        return auth[6:].strip()
    return None


def _request_has_valid_auth(request) -> bool:
    if getattr(request.user, "is_authenticated", False) and request.user.is_authenticated:
        return True
    key = _token_key_from_request(request)
    if not key:
        return False
    return Token.objects.filter(key=key).exists()


def _capture_stream_url(camera: Camera) -> str | None:
    return camera.effective_stream_url() or None


class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.all()
    serializer_class = SiteSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active"]
    search_fields = ["code", "name"]
    ordering_fields = ["name", "code", "created_at"]


class NvrViewSet(viewsets.ModelViewSet):
    queryset = Nvr.objects.select_related("site").all()
    serializer_class = NvrSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["site", "brand", "is_active"]
    search_fields = ["name", "ip_address", "site__code", "site__name"]
    ordering_fields = ["name", "ip_address", "created_at"]

    @action(detail=False, methods=["get"], url_path="brands")
    def brands(self, request):
        return Response(nvr_brand_options())

    @action(detail=True, methods=["post"], url_path="bulk-cameras")
    def bulk_cameras(self, request, pk=None):
        """Auto-generate camera entries for channels 1..N on this NVR."""
        nvr = self.get_object()
        serializer = BulkCameraCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        count = serializer.validated_data["channel_count"]
        prefix = serializer.validated_data["name_prefix"]
        zone = serializer.validated_data["zone"]
        purposes = serializer.validated_data["purposes"]
        purpose = serializer.validated_data["purpose"]

        created = []
        skipped = []
        for ch in range(1, count + 1):
            if Camera.objects.filter(nvr=nvr, channel=ch).exists():
                skipped.append(ch)
                continue
            cam = Camera.objects.create(
                nvr=nvr,
                channel=ch,
                name=f"{prefix} {ch}",
                zone=zone,
                purpose=purpose,
                purposes=purposes,
                location=nvr.site.code,
            )
            created.append(CameraSerializer(cam).data)

        return Response(
            {
                "created": created,
                "skipped_channels": skipped,
                "count": len(created),
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class CameraViewSet(viewsets.ModelViewSet):
    queryset = Camera.objects.select_related("nvr", "nvr__site", "ml_server").all()
    serializer_class = CameraSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["nvr", "nvr__site", "location", "purpose", "status", "is_active", "ml_server"]
    search_fields = ["name", "code", "zone", "nvr__name", "nvr__site__code"]
    ordering_fields = ["name", "channel", "location", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        allocated = str(self.request.query_params.get("allocated", "")).strip().lower()
        if allocated in ("1", "true", "yes"):
            qs = qs.filter(ml_server_id__isnull=False)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return CameraWriteSerializer
        return CameraSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cam = serializer.save()
        return Response(CameraSerializer(cam).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        cam = self.get_object()
        serializer = self.get_serializer(cam, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        cam = serializer.save()
        return Response(CameraSerializer(cam).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="purposes")
    def purposes(self, request):
        return Response(purpose_options())

    @action(detail=False, methods=["get"], url_path="detection-events")
    def detection_events(self, request):
        def _aware(dt):
            if dt is None:
                return None
            if timezone.is_naive(dt):
                return timezone.make_aware(dt, timezone.get_current_timezone())
            return dt

        qs = (
            DetectionEvent.objects.select_related("camera", "camera__nvr", "camera__nvr__site")
            .order_by("-created_at", "-id")
        )
        camera_id = request.query_params.get("camera")
        if camera_id:
            qs = qs.filter(camera_id=camera_id)
        site_code = request.query_params.get("site")
        if site_code:
            qs = qs.filter(camera__nvr__site__code__iexact=site_code.strip())
        site_id = request.query_params.get("site_id")
        if site_id:
            qs = qs.filter(camera__nvr__site_id=site_id)
        nvr_id = request.query_params.get("nvr")
        if nvr_id:
            qs = qs.filter(camera__nvr_id=nvr_id)
        channel = request.query_params.get("channel")
        if channel:
            try:
                qs = qs.filter(camera__channel=int(channel))
            except (TypeError, ValueError):
                pass
        zone = request.query_params.get("zone")
        if zone and zone.strip():
            qs = qs.filter(camera__zone__iexact=zone.strip())
        date_from = request.query_params.get("date_from")
        if date_from:
            raw = date_from.strip()
            dt = parse_datetime(raw.replace(" ", "T", 1) if " " in raw and "T" not in raw else raw)
            if dt:
                qs = qs.filter(created_at__gte=_aware(dt))
            else:
                parsed = parse_date(raw[:10])
                if parsed:
                    qs = qs.filter(created_at__date__gte=parsed)
        date_to = request.query_params.get("date_to")
        if date_to:
            raw = date_to.strip()
            dt = parse_datetime(raw.replace(" ", "T", 1) if " " in raw and "T" not in raw else raw)
            if dt:
                qs = qs.filter(created_at__lte=_aware(dt))
            else:
                parsed = parse_date(raw[:10])
                if parsed:
                    qs = qs.filter(created_at__date__lte=parsed)

        # Freeze the result set at a point-in-time so offset pages don't shift
        # when new detections arrive (client reuses as_of / as_of_id from page 1).
        as_of_raw = (request.query_params.get("as_of") or "").strip()
        as_of_id_raw = (request.query_params.get("as_of_id") or "").strip()
        as_of_dt = None
        as_of_id = None
        if as_of_raw:
            normalized = as_of_raw.replace("Z", "+00:00")
            as_of_dt = parse_datetime(
                normalized.replace(" ", "T", 1) if " " in normalized and "T" not in normalized else normalized
            )
            as_of_dt = _aware(as_of_dt)
            if as_of_dt is not None:
                try:
                    as_of_id = int(as_of_id_raw) if as_of_id_raw else None
                except (TypeError, ValueError):
                    as_of_id = None
                if as_of_id is not None:
                    qs = qs.filter(
                        Q(created_at__lt=as_of_dt)
                        | Q(created_at=as_of_dt, id__lte=as_of_id)
                    )
                else:
                    qs = qs.filter(created_at__lte=as_of_dt)

        # Restrict to vehicle classes before search/pagination so this panel
        # never returns person/object/other detections.
        vehicle_only = str(request.query_params.get("vehicle_only", "")).lower() in (
            "1",
            "true",
            "yes",
        )
        # COCO + custom YOLO vehicle aliases used by ml_services weights.
        vehicle_classes = (
            "car",
            "truck",
            "bus",
            "motorcycle",
            "bicycle",
            "vehicle",
            "van",
            "microbus",
            "pickup-van",
            "pickup_van",
            "pickupvan",
        )
        if vehicle_only:
            class_q = Q()
            for name in vehicle_classes:
                class_q |= Q(class_name__iexact=name)
            qs = qs.filter(class_q)

        class_name = request.query_params.get("class_name")
        if class_name and class_name.strip():
            wanted = class_name.strip().lower()
            if vehicle_only and wanted not in vehicle_classes:
                qs = qs.none()
            else:
                qs = qs.filter(class_name__iexact=wanted)

        search_q = request.query_params.get("q") or request.query_params.get("search")
        if search_q and search_q.strip():
            qs = apply_detection_search(qs, search_q.strip())

        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = int(request.query_params.get("page_size", 25))
        except (TypeError, ValueError):
            page_size = 25
        if request.query_params.get("limit") and "page_size" not in request.query_params:
            try:
                page_size = int(request.query_params.get("limit", page_size))
            except (TypeError, ValueError):
                pass
        page_size = min(max(page_size, 1), 100)

        is_alert = request.query_params.get("is_alert")
        if is_alert is not None and str(is_alert).strip().lower() in ("true", "1", "yes"):
            qs = qs.filter(is_alert=True)
        elif is_alert is not None and str(is_alert).strip().lower() in ("false", "0", "no"):
            qs = qs.filter(is_alert=False)

        # Tip of the live filtered stream — client stores this to freeze later pages.
        tip = None
        if as_of_dt is None:
            tip = qs.values("created_at", "id").first()
        resp_as_of = as_of_dt if as_of_dt is not None else (tip["created_at"] if tip else None)
        resp_as_of_id = as_of_id if as_of_id is not None else (tip["id"] if tip else None)

        total = qs.count()
        offset = (page - 1) * page_size
        events = qs[offset : offset + page_size]
        total_pages = (total + page_size - 1) // page_size if total else 0

        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                # Echo snapshot used (or live tip) so offset pages stay stable.
                "as_of": resp_as_of.isoformat() if resp_as_of else None,
                "as_of_id": resp_as_of_id,
                "results": DetectionEventSerializer(
                    events, many=True, context={"request": request}
                ).data,
            }
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="detection-events/bulk-delete",
        permission_classes=[IsAuthenticated, IsGlobalAdmin],
    )
    def detection_events_bulk_delete(self, request):
        """Super Admin only — delete selected detection event IDs."""
        raw_ids = request.data.get("ids") if isinstance(request.data, dict) else None
        if not isinstance(raw_ids, list) or not raw_ids:
            return Response(
                {"detail": "ids must be a non-empty list of detection event IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ids: list[int] = []
        for item in raw_ids:
            try:
                ids.append(int(item))
            except (TypeError, ValueError):
                continue
        if not ids:
            return Response(
                {"detail": "No valid detection event IDs provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        deleted, _ = DetectionEvent.objects.filter(id__in=ids).delete()
        return Response({"ok": True, "deleted": deleted})

    @action(
        detail=False,
        methods=["post"],
        url_path="detection-events/clear",
        permission_classes=[IsAuthenticated, IsGlobalAdmin],
    )
    def detection_events_clear(self, request):
        """Super Admin only — clear all detection events (optional filters)."""
        if not is_global_admin(request.user):
            return Response(
                {"detail": "Only Super Admin can clear detection events."},
                status=status.HTTP_403_FORBIDDEN,
            )
        qs = DetectionEvent.objects.all()
        data = request.data if isinstance(request.data, dict) else {}
        camera_id = data.get("camera") or request.query_params.get("camera")
        if camera_id:
            try:
                qs = qs.filter(camera_id=int(camera_id))
            except (TypeError, ValueError):
                pass
        class_name = (data.get("class_name") or request.query_params.get("class_name") or "").strip()
        if class_name:
            qs = qs.filter(class_name__iexact=class_name)
        alerts_only = data.get("is_alert")
        if alerts_only is True or str(alerts_only).lower() in ("1", "true", "yes"):
            qs = qs.filter(is_alert=True)
        deleted, _ = qs.delete()
        return Response({"ok": True, "deleted": deleted})

    @action(
        detail=False,
        methods=["patch", "put", "post", "delete"],
        url_path=r"detection-events/(?P<event_id>[0-9]+)",
        permission_classes=[IsAuthenticated, IsGlobalAdmin],
    )
    def detection_event_detail(self, request, event_id=None):
        """Super Admin only — update or delete a single detection event (incl. snapshot)."""
        try:
            event = DetectionEvent.objects.select_related(
                "camera", "camera__nvr", "camera__nvr__site"
            ).get(pk=int(event_id))
        except (DetectionEvent.DoesNotExist, TypeError, ValueError):
            return Response({"detail": "Detection event not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            event.delete()
            return Response({"ok": True, "deleted": 1})

        data = request.data
        files = request.FILES
        changed = False

        def _has(key: str) -> bool:
            return key in data

        def _get(key: str):
            return data.get(key)

        if _has("camera"):
            raw_cam = _get("camera")
            try:
                cam_id = int(raw_cam)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "camera must be a valid camera id."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                event.camera = Camera.objects.select_related("nvr", "nvr__site").get(pk=cam_id)
            except Camera.DoesNotExist:
                return Response({"detail": "Camera not found."}, status=status.HTTP_400_BAD_REQUEST)
            changed = True

        if _has("created_at"):
            raw_ts = _get("created_at")
            if isinstance(raw_ts, str):
                raw_ts = raw_ts.strip()
            if not raw_ts:
                return Response(
                    {"detail": "created_at cannot be empty."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            parsed = parse_datetime(str(raw_ts).replace("Z", "+00:00"))
            if parsed is None:
                from datetime import datetime as _dt

                for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
                    try:
                        parsed = _dt.strptime(str(raw_ts), fmt)
                        break
                    except ValueError:
                        continue
            if parsed is None:
                return Response(
                    {"detail": "created_at must be a valid datetime."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
            event.created_at = parsed
            changed = True

        for key in (
            "class_name",
            "label",
            "employee_name",
            "personal_number",
            "person_qr",
            "track_event",
        ):
            if not _has(key):
                continue
            value = _get(key)
            setattr(event, key, "" if value is None else str(value).strip())
            changed = True

        if _has("confidence"):
            try:
                value = float(_get("confidence"))
            except (TypeError, ValueError):
                return Response(
                    {"detail": "confidence must be a number."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if value > 1:
                value = value / 100.0
            event.confidence = max(0.0, min(1.0, value))
            changed = True

        if _has("is_alert"):
            value = _get("is_alert")
            if isinstance(value, str):
                value = value.strip().lower() in ("1", "true", "yes", "on")
            else:
                value = bool(value)
            event.is_alert = value
            changed = True

        if _has("clip_status"):
            value = str(_get("clip_status") or "").strip().lower()
            valid = {c.value for c in ClipStatus}
            if value and value not in valid:
                return Response(
                    {"detail": f"clip_status must be one of: {', '.join(sorted(valid))}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if value:
                event.clip_status = value
                changed = True

        if _has("local_track_id"):
            raw = _get("local_track_id")
            if raw in (None, "", "null"):
                event.local_track_id = None
            else:
                try:
                    event.local_track_id = int(raw)
                except (TypeError, ValueError):
                    return Response(
                        {"detail": "local_track_id must be an integer."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            changed = True

        if _has("person_identity_id"):
            raw = _get("person_identity_id")
            if raw in (None, "", "null"):
                event.person_identity_id = None
            else:
                try:
                    event.person_identity_id = int(raw)
                except (TypeError, ValueError):
                    return Response(
                        {"detail": "person_identity_id must be an integer."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            changed = True

        if _has("bbox"):
            import json

            raw = _get("bbox")
            if isinstance(raw, str):
                try:
                    raw = json.loads(raw)
                except json.JSONDecodeError:
                    return Response(
                        {"detail": "bbox must be a JSON array of 4 numbers."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            if raw is None:
                event.bbox = []
            elif not isinstance(raw, (list, tuple)) or len(raw) != 4:
                return Response(
                    {"detail": "bbox must be a list of 4 numbers [x1,y1,x2,y2]."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            else:
                try:
                    event.bbox = [float(v) for v in raw]
                except (TypeError, ValueError):
                    return Response(
                        {"detail": "bbox values must be numbers."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            changed = True

        for dim in ("infer_frame_width", "infer_frame_height"):
            if not _has(dim):
                continue
            raw = _get(dim)
            if raw in (None, "", "null"):
                setattr(event, dim, None)
            else:
                try:
                    setattr(event, dim, int(raw))
                except (TypeError, ValueError):
                    return Response(
                        {"detail": f"{dim} must be an integer."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            changed = True

        clear_clip = _get("clear_clip")
        if isinstance(clear_clip, str):
            clear_clip = clear_clip.strip().lower() in ("1", "true", "yes", "on")
        elif clear_clip is not None:
            clear_clip = bool(clear_clip)
        else:
            clear_clip = False

        clip_file = files.get("clip") or files.get("image") or files.get("snapshot")
        if clip_file is not None:
            if event.clip:
                event.clip.delete(save=False)
            event.clip = clip_file
            event.clip_status = ClipStatus.READY
            changed = True
        elif clear_clip:
            if event.clip:
                event.clip.delete(save=False)
            event.clip = None
            event.clip_status = ClipStatus.SKIPPED
            changed = True

        clear_video = _get("clear_video")
        if isinstance(clear_video, str):
            clear_video = clear_video.strip().lower() in ("1", "true", "yes", "on")
        elif clear_video is not None:
            clear_video = bool(clear_video)
        else:
            clear_video = False

        video_file = files.get("video") or files.get("alert_video")
        if video_file is not None:
            name = (getattr(video_file, "name", "") or "").lower()
            content_type = (getattr(video_file, "content_type", "") or "").lower()
            allowed_ext = (".mp4", ".webm", ".mov", ".mkv", ".avi")
            if not any(name.endswith(ext) for ext in allowed_ext) and not content_type.startswith(
                "video/"
            ):
                return Response(
                    {"detail": "video must be a video file (mp4, webm, mov, mkv, avi)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if event.video:
                event.video.delete(save=False)
            event.video = video_file
            changed = True
        elif clear_video:
            if event.video:
                event.video.delete(save=False)
            event.video = None
            changed = True

        if not changed:
            return Response(
                {"detail": "No editable fields provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        event.save()
        event = DetectionEvent.objects.select_related(
            "camera", "camera__nvr", "camera__nvr__site"
        ).get(pk=event.pk)
        return Response(
            DetectionEventSerializer(event, context={"request": request}).data
        )

    @action(detail=False, methods=["get"], url_path="detection-summary")
    def detection_summary(self, request):
        today = timezone.localdate()
        qs = DetectionEvent.objects.filter(created_at__date=today)
        alert_count = qs.filter(is_alert=True).count()
        classes = qs.values_list("class_name", flat=True).distinct()
        return Response(
            {
                "detections_today": qs.count(),
                "classes_tracked": len(set(classes)),
                "alerts_today": alert_count,
            }
        )

    @action(detail=False, methods=["get"], url_path="plate-captures")
    def plate_captures(self, request):
        """Saved ANPR plate records: crop image, scene image, and OCR plate number."""
        import inspect

        from .plate_captures import load_plate_captures, plate_capture_summary

        try:
            page = int(request.query_params.get("page", 1))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = int(request.query_params.get("page_size") or request.query_params.get("limit") or 25)
        except (TypeError, ValueError):
            page_size = 25
        camera_key = (request.query_params.get("camera_key") or "").strip()
        q = (request.query_params.get("q") or "").strip()
        plate_number = (request.query_params.get("plate_number") or "").strip()
        date_from = (request.query_params.get("date_from") or "").strip()
        date_to = (request.query_params.get("date_to") or "").strip()
        cleanup = str(request.query_params.get("cleanup", "false")).lower() in ("1", "true", "yes")

        # Pass only kwargs supported by the installed load_plate_captures()
        # (avoids 500 if an older plate_captures.py is still on the server).
        kwargs = {
            "page": page,
            "page_size": page_size,
            "camera_key": camera_key,
            "q": q,
            "plate_number": plate_number,
            "date_from": date_from,
            "date_to": date_to,
            "cleanup": cleanup,
        }
        accepted = set(inspect.signature(load_plate_captures).parameters)
        if plate_number and "plate_number" not in accepted and "q" in accepted:
            # Older loader: fold plate filter into generic search.
            kwargs["q"] = plate_number if not q else q
        payload = load_plate_captures(**{k: v for k, v in kwargs.items() if k in accepted})
        return Response(
            {
                **payload,
                "summary": plate_capture_summary(),
            }
        )

    @action(detail=False, methods=["get"], url_path="vehicle-journeys")
    def vehicle_journeys(self, request):
        """Vehicles grouped by plate: cameras, pass count, and last seen."""
        from .plate_captures import load_vehicle_journeys

        try:
            page = int(request.query_params.get("page", 1))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = int(request.query_params.get("page_size") or request.query_params.get("limit") or 25)
        except (TypeError, ValueError):
            page_size = 25
        try:
            min_passes = int(request.query_params.get("min_passes", 2))
        except (TypeError, ValueError):
            min_passes = 2
        q = (request.query_params.get("q") or request.query_params.get("plate_number") or "").strip()
        date_from = (request.query_params.get("date_from") or "").strip()
        date_to = (request.query_params.get("date_to") or "").strip()
        include_path = str(request.query_params.get("include_path", "false")).lower() in ("1", "true", "yes")
        return Response(
            load_vehicle_journeys(
                page=page,
                page_size=page_size,
                q=q,
                min_passes=min_passes,
                date_from=date_from,
                date_to=date_to,
                include_path=include_path,
            )
        )

    @action(detail=False, methods=["get"], url_path=r"vehicle-journeys/(?P<plate_key>[^/]+)")
    def vehicle_journey_detail(self, request, plate_key=None):
        """Full sighting timeline for one number plate (including OCR variants)."""
        from .plate_captures import load_vehicle_journey

        data = load_vehicle_journey(plate_key or "")
        if not data:
            return Response({"detail": "No journey found for this plate."}, status=status.HTTP_404_NOT_FOUND)
        return Response(data)

    @action(detail=True, methods=["get"], url_path="ml-live/detections")
    def ml_live_detections_action(self, request, pk=None):
        camera = self.get_object()
        if not ml_service_enabled():
            return Response(
                {"detail": "ML service is not running. Restart the backend to auto-start models."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not camera.ml_server_id:
            return Response(
                {"detail": "Camera is not assigned to an ML server. Assign it in Camera Distribution first."},
                status=status.HTTP_409_CONFLICT,
            )
        try:
            result = ml_live_detections_for_camera(
                camera,
                purpose=camera.purpose,
                purposes=camera.purpose_list(),
            )
        except MLServiceError as exc:
            if exc.status_code == status.HTTP_409_CONFLICT:
                # Camera is allocated in Django but the ML node's in-memory
                # registry lost it (e.g. ML process restarted). Re-push this
                # camera and retry once instead of surfacing a stale 409.
                try:
                    from ml.camera_sync import route_camera_to_ml_server

                    route_camera_to_ml_server(camera)
                    result = ml_live_detections_for_camera(
                        camera,
                        purpose=camera.purpose,
                        purposes=camera.purpose_list(),
                    )
                except MLServiceError as retry_exc:
                    return Response(
                        {"detail": str(retry_exc)},
                        status=retry_exc.status_code or status.HTTP_503_SERVICE_UNAVAILABLE,
                    )
            else:
                return Response({"detail": str(exc)}, status=exc.status_code or status.HTTP_503_SERVICE_UNAVAILABLE)

        detections = result.get("detections") or []
        detections = filter_detections_for_camera(camera, detections)
        save_param = request.query_params.get("save", "true").lower()
        saved_count = 0
        if save_param in ("true", "1", "yes") and detections:
            saved_count = save_detection_batch(camera, detections)

        return Response(
            {
                "camera_id": camera.pk,
                "camera_code": camera.code,
                "name": camera.name,
                "site_code": camera.nvr.site.code if camera.nvr_id else "",
                "site_name": camera.nvr.site.name if camera.nvr_id else "",
                "nvr_name": camera.nvr.name if camera.nvr_id else "",
                "nvr_ip": camera.nvr.ip_address if camera.nvr_id else "",
                "channel": camera.channel,
                "zone": camera.zone,
                "purpose": camera.purpose,
                "purposes": camera.purpose_list(),
                "purpose_label": camera.purpose_label,
                "detections": detections,
                "count": len(detections),
                "saved_count": saved_count,
            }
        )

    @action(detail=True, methods=["post"], url_path="detect")
    def detect(self, request, pk=None):
        camera = self.get_object()
        if not ml_service_enabled():
            return Response(
                {"detail": "ML service is not running. Restart the backend to auto-start models."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        stream = _capture_stream_url(camera)
        if not stream:
            return Response(
                {"detail": "No stream URL could be generated for this camera."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        frame = capture_jpeg_frame(stream)
        if not frame:
            return Response(
                {"detail": "Could not capture a frame from the camera stream. Check NVR credentials and ffmpeg."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            result = ml_detect_image(frame, filename=f"{camera.code}.jpg", recognize_faces=True)
        except MLServiceError as exc:
            return Response({"detail": str(exc)}, status=exc.status_code or status.HTTP_503_SERVICE_UNAVAILABLE)

        detections = filter_detections_for_camera(camera, result.get("detections") or [])
        saved = []
        clip_enabled = bool(getattr(settings, "DETECTION_CLIP_ENABLED", True))
        for det in detections:
            class_name = str(det.get("class_name", ""))
            label = str(det.get("label", det.get("class_name", "")))
            employee_name, personal_number = resolve_staff_identity(label, class_name)
            event = DetectionEvent.objects.create(
                camera=camera,
                class_name=class_name,
                label=label,
                employee_name=employee_name,
                personal_number=personal_number,
                confidence=float(det.get("confidence", 0)),
                bbox=det.get("bbox") or [],
                is_alert=bool(det.get("alert")),
                clip_status=ClipStatus.PENDING if clip_enabled else ClipStatus.SKIPPED,
            )
            schedule_detection_clip(camera.pk, event.pk)
            saved.append(event)

        return Response(
            {
                "camera_id": camera.pk,
                "camera_code": camera.code,
                "name": camera.name,
                "site_code": camera.nvr.site.code,
                "site_name": camera.nvr.site.name,
                "nvr_name": camera.nvr.name,
                "nvr_ip": camera.nvr.ip_address,
                "channel": camera.channel,
                "detections": detections,
                "count": len(detections),
                "events_saved": len(saved),
            }
        )


class CameraStreamListView(APIView):
    """Dashboard stream metadata from database cameras only."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        if not _request_has_valid_auth(request):
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        cameras = []
        # Dashboard / live walls: allocated cameras only (idle until assigned in Distribution)
        allocated_only = str(request.query_params.get("allocated", "1")).strip().lower() in (
            "1",
            "true",
            "yes",
        )
        qs = Camera.objects.filter(is_active=True).select_related("nvr", "nvr__site", "ml_server")
        if allocated_only:
            qs = qs.filter(ml_server_id__isnull=False)
        for cam in qs.order_by("nvr__site__name", "nvr__name", "channel"):
            cameras.append(
                {
                    "id": cam.pk,
                    "code": cam.code,
                    "name": cam.name,
                    "label": cam.name,
                    "display_label": cam.display_label,
                    "location": cam.location or cam.nvr.site.code,
                    "site_label": cam.nvr.site.name,
                    "site_code": cam.nvr.site.code,
                    "nvr_name": cam.nvr.name,
                    "channel": cam.channel,
                    "channel_label": f"Ch {cam.channel}",
                    "purpose": cam.purpose,
                    "purposes": cam.purpose_list(),
                    "purpose_label": cam.purpose_label,
                    "ml_enabled": cam.ml_enabled,
                    "is_rtsp": cam.is_rtsp,
                    "ml_stream_key": cam.stream_key,
                    "ml_server_id": cam.ml_server_id,
                    "ml_live_stream_url": ml_assigned_mjpeg_public_url(cam, kind="live"),
                    "raw_stream_url": ml_assigned_mjpeg_public_url(cam, kind="raw"),
                    "rtsp_url": cam.effective_stream_url(),
                    "status": cam.status,
                    "is_active": cam.is_active,
                }
            )

        return Response(
            {
                "cameras": cameras,
                "ml_service_enabled": ml_service_enabled(),
                "ml_service_public_url": getattr(settings, "ML_SERVICE_PUBLIC_URL", ""),
            }
        )


class CameraPreviewMjpegView(APIView):
    """Live MJPEG preview for an NVR channel before saving a camera row."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        if not _request_has_valid_auth(request):
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        nvr_id = request.query_params.get("nvr_id")
        channel = request.query_params.get("channel", "1")
        if not nvr_id:
            return Response({"detail": "nvr_id query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not ffmpeg_available():
            return Response(
                {"detail": "ffmpeg is not installed. Set FFMPEG_PATH in backend/.env."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            nvr = Nvr.objects.get(pk=int(nvr_id), is_active=True)
            ch = max(1, int(channel))
        except (Nvr.DoesNotExist, ValueError):
            return Response({"detail": "NVR not found or invalid channel."}, status=status.HTTP_404_NOT_FOUND)

        stream_url = build_rtsp_url_for_preview(nvr, ch)
        if not stream_url:
            return Response({"detail": "Could not build RTSP URL."}, status=status.HTTP_400_BAD_REQUEST)

        response = StreamingHttpResponse(
            generate_mjpeg_frames(stream_url),
            content_type="multipart/x-mixed-replace; boundary=frame",
        )
        response["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response["Pragma"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
