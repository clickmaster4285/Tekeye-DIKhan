"""Central Ops — Super Admin remote server registry and live stream proxy."""

from __future__ import annotations

from concurrent.futures import ALL_COMPLETED, ThreadPoolExecutor, wait
from urllib.parse import urlencode, urljoin

import requests
from django.http import HttpResponse, StreamingHttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import is_ops_viewer

from .cache import (
    parse_camera_id as _parse_camera_id,
    prune_server_camera_cache as _prune_server_camera_cache,
    resolve_stream_key as _resolve_stream_key,
)
from .client import (
    apply_detected_gpu,
    delete_remote_camera,
    fetch_ml_cameras,
    fetch_remote_cameras,
    fetch_remote_detection_events,
    mark_server_health,
    probe_health,
    probe_ml_health,
    unregister_ml_camera_remote,
)
from .models import ConnectionMode, RemoteServer, AllCitiesCameraPreference
from .permissions import IsITSuperAdminOnly, IsOpsViewer
from .serializers import QuickConnectSerializer, RemoteServerSerializer
from .go2rtc import (
    ensure_stream as _go2rtc_ensure_stream,
    exchange_webrtc_sdp as _go2rtc_exchange_sdp,
    go2rtc_configured as _go2rtc_configured,
    health_ok as _go2rtc_health_ok,
    stream_name_for as _go2rtc_stream_name,
    warm_stream as _go2rtc_warm_stream,
)
from .utils import (
    ensure_default_remote_server,
    resolve_remote_token,
    token_for_user,
)


def _token_key_from_request(request) -> str:
    auth = (request.META.get("HTTP_AUTHORIZATION") or "").strip()
    if auth.lower().startswith("token "):
        return auth[6:].strip()
    return (request.query_params.get("token") or request.GET.get("token") or "").strip()


def _ops_user_from_request(request):
    """Resolve Super Admin / IT Super Admin from session/DRF auth or ?token=."""
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False) and is_ops_viewer(user):
        return user
    key = _token_key_from_request(request)
    if not key:
        return None
    try:
        token = Token.objects.select_related("user").get(key=key)
    except Token.DoesNotExist:
        return None
    if is_ops_viewer(token.user) and token.user.is_active:
        return token.user
    return None


_OPS_CAMERAS_CACHE_TTL_SEC = 120


def _cache_is_fresh(server: RemoteServer, *, refresh: bool) -> bool:
    if refresh or not server.cached_cameras:
        return False
    fetched_at = server.cameras_fetched_at
    if not fetched_at:
        return False
    age = (timezone.now() - fetched_at).total_seconds()
    return age < _OPS_CAMERAS_CACHE_TTL_SEC


def _resolve_stream_rtsp_url(server: RemoteServer, stream_key: str) -> str:
    """Resolve RTSP URL for ops stream proxy / go2rtc (server-side only — not sent to browser)."""
    key = (stream_key or "").strip()
    if not key:
        return ""
    for cam in server.cached_cameras or []:
        if not isinstance(cam, dict):
            continue
        cam_key = (cam.get("ml_stream_key") or cam.get("code") or "").strip()
        cam_id = cam.get("id")
        alt = f"cam-{cam_id}" if cam_id else ""
        if key not in (cam_key, alt):
            continue
        url = (cam.get("rtsp_url") or cam.get("stream_url") or "").strip()
        if url:
            return url
    # Hub DB knows NVR credentials for local cameras (and often for distributed cams).
    try:
        from cameras.models import Camera

        cam_id = int(key[4:]) if key.startswith("cam-") and key[4:].isdigit() else None
        if cam_id:
            camera = (
                Camera.objects.filter(pk=cam_id, is_active=True)
                .select_related("nvr", "nvr__site")
                .first()
            )
            if camera:
                return (camera.effective_stream_url() or "").strip()
    except Exception:
        pass
    return ""


def _cached_camera_purposes(server: RemoteServer, stream_key: str) -> list[str]:
    for cam in server.cached_cameras or []:
        if not isinstance(cam, dict):
            continue
        cam_key = (cam.get("ml_stream_key") or cam.get("code") or "").strip()
        cam_id = cam.get("id")
        if stream_key not in (cam_key, f"cam-{cam_id}" if cam_id else ""):
            continue
        purposes = cam.get("purposes")
        if isinstance(purposes, list):
            out = [str(p).strip() for p in purposes if str(p).strip()]
            if out:
                return out
        purpose = str(cam.get("purpose") or "").strip()
        return [purpose] if purpose else []
    return []


def _reregister_ml_camera(server: RemoteServer, ml_base: str, stream_key: str, rtsp_url: str) -> bool:
    """Re-add one camera to the ML live registry (e.g. after an ML restart emptied it)."""
    if not (ml_base and stream_key and rtsp_url):
        return False
    from ml.client import MLServiceError, ml_register_cameras_bulk_at

    purposes = _cached_camera_purposes(server, stream_key)
    entry = {"key": stream_key, "rtsp_url": rtsp_url}
    if purposes:
        entry["purpose"] = purposes[0]
        entry["purposes"] = purposes
    try:
        ml_register_cameras_bulk_at(ml_base, [entry], timeout=(5, 15))
    except MLServiceError:
        return False
    return True


def _ml_stream_upstream_candidates(
    *,
    ml_base: str,
    django_base: str,
    stream_key: str,
    kind: str,
    rtsp_url: str = "",
) -> list[str]:
    kind_l = (kind or "live").strip().lower()
    if kind_l in ("jpeg", "snapshot"):
        path = f"/live/cam/{stream_key}/jpeg"
    elif kind_l in ("jpeg_raw", "raw_jpeg"):
        path = f"/live/cam/{stream_key}/jpeg/raw"
    elif kind_l == "raw":
        path = f"/live/cam/{stream_key}/mjpeg/raw"
    else:
        path = f"/live/cam/{stream_key}/mjpeg"
    params: dict[str, str] = {}
    if (rtsp_url or "").strip():
        params["rtsp_url"] = rtsp_url.strip()
    qs = f"?{urlencode(params)}" if params else ""
    urls = [urljoin(ml_base.rstrip("/") + "/", path.lstrip("/")) + qs]
    if django_base and django_base.rstrip("/") != ml_base.rstrip("/"):
        urls.append(urljoin(django_base.rstrip("/") + "/", f"ml{path}") + qs)
    return urls


# Backward-compatible alias
def _ml_mjpeg_upstream_candidates(
    *,
    ml_base: str,
    django_base: str,
    stream_key: str,
    kind: str,
    rtsp_url: str = "",
) -> list[str]:
    return _ml_stream_upstream_candidates(
        ml_base=ml_base,
        django_base=django_base,
        stream_key=stream_key,
        kind=kind,
        rtsp_url=rtsp_url,
    )


def _attach_proxy_urls(server_id: int | None, cameras: list[dict]) -> list[dict]:
    """Rewrite stream URLs to hub proxy endpoints."""
    from django.conf import settings

    webrtc_on = (
        bool(getattr(settings, "GO2RTC_ENABLED", False))
        and _go2rtc_configured()
        and _go2rtc_health_ok()
    )
    out = []
    for cam in cameras:
        row = dict(cam)
        key = (row.get("ml_stream_key") or "").strip()
        cam_id = row.get("id")
        if server_id is not None:
            if key:
                row["ml_live_stream_url"] = (
                    f"/api/ops/servers/{server_id}/mjpeg/?stream_key={key}&kind=live"
                )
                row["raw_stream_url"] = (
                    f"/api/ops/servers/{server_id}/mjpeg/?stream_key={key}&kind=raw"
                )
                # Direct NVR viewing (1080p/4K) — not the ML 720p AI buffer
                row["view_stream_url"] = (
                    f"/api/ops/servers/{server_id}/view/?stream_key={key}"
                )
                if webrtc_on:
                    row["webrtc_stream_url"] = (
                        f"/api/ops/servers/{server_id}/webrtc/?stream_key={key}"
                    )
            elif cam_id is not None:
                row["ml_live_stream_url"] = (
                    f"/api/ops/servers/{server_id}/mjpeg/?camera_id={cam_id}&kind=live"
                )
                row["view_stream_url"] = (
                    f"/api/ops/servers/{server_id}/view/?camera_id={cam_id}"
                )
                if webrtc_on:
                    row["webrtc_stream_url"] = (
                        f"/api/ops/servers/{server_id}/webrtc/?camera_id={cam_id}"
                    )
        out.append(row)
    return out


def _is_local_hub_server(server: RemoteServer) -> bool:
    ml = (server.resolved_ml_base_url() or "").lower()
    base = (server.normalized_base_url() or "").lower()
    local_hosts = ("127.0.0.1", "localhost", "::1")
    return any(host in ml or host in base for host in local_hosts)


class RemoteServerViewSet(viewsets.ModelViewSet):
    queryset = RemoteServer.objects.all()
    serializer_class = RemoteServerSerializer
    permission_classes = [IsOpsViewer]

    def get_permissions(self):
        if self.action in (
            "create",
            "update",
            "partial_update",
            "destroy",
            "remove_camera",
        ):
            return [IsITSuperAdminOnly()]
        return [IsOpsViewer()]

    def list(self, request, *args, **kwargs):
        ensure_default_remote_server(request.user)
        # Keep default server token in sync with current viewer login (django mode)
        default = (
            RemoteServer.objects.filter(name="Local Server").first()
            or RemoteServer.objects.filter(name="Local This Server").first()
        )
        if default:
            tok = token_for_user(request.user)
            if tok and default.auth_token != tok:
                default.auth_token = tok
                default.save(update_fields=["auth_token", "updated_at"])
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        mode = serializer.validated_data.get("connection_mode") or ConnectionMode.ML
        token = ""
        if mode != ConnectionMode.ML:
            token = resolve_remote_token(self.request, serializer.validated_data.get("auth_token"))
        server = serializer.save(created_by=self.request.user, auth_token=token or "ml-only")
        # Persist real probe result so UI does not stay "offline" after a successful save.
        if server.is_ml_mode():
            result = probe_ml_health(server.resolved_ml_base_url())
            if result.get("ok"):
                apply_detected_gpu(
                    server,
                    result,
                    preferred_index=server.gpu_device,
                    force=not (server.gpu or "").strip(),
                )
        else:
            result = probe_health(server.normalized_base_url(), token)
        mark_server_health(server, ok=bool(result.get("ok")), error=result.get("error", ""))

    def _effective_token(self, server: RemoteServer) -> str:
        if server.is_ml_mode():
            return ""
        stored = (server.auth_token or "").strip()
        if stored and stored not in ("pending", "ml-only"):
            return stored
        tok = token_for_user(self.request.user)
        if tok:
            server.auth_token = tok
            server.save(update_fields=["auth_token", "updated_at"])
        return tok

    @action(detail=True, methods=["post"], url_path="test")
    def test_connection(self, request, pk=None):
        server = self.get_object()
        gpus: list = []
        if server.is_ml_mode():
            result = probe_ml_health(server.resolved_ml_base_url())
            if result.get("ok"):
                preferred = request.data.get("gpu_device") if isinstance(request.data, dict) else None
                try:
                    preferred_idx = int(preferred) if preferred is not None and str(preferred).strip() != "" else None
                except (TypeError, ValueError):
                    preferred_idx = None
                gpus = apply_detected_gpu(
                    server,
                    result,
                    preferred_index=preferred_idx,
                    force=preferred_idx is not None,
                )
        else:
            token = self._effective_token(server)
            result = probe_health(server.normalized_base_url(), token)
        mark_server_health(server, ok=result.get("ok", False), error=result.get("error", ""))
        server.refresh_from_db()
        return Response(
            {
                **result,
                "gpus": gpus or result.get("gpus") or [],
                "server": RemoteServerSerializer(server).data,
            }
        )

    @action(detail=True, methods=["get"], url_path="cameras")
    def cameras(self, request, pk=None):
        server = self.get_object()
        if not server.is_active:
            return Response({"detail": "Server is inactive."}, status=status.HTTP_400_BAD_REQUEST)

        if server.is_ml_mode():
            result = fetch_ml_cameras(server.resolved_ml_base_url(), server_name=server.name)
        else:
            token = self._effective_token(server)
            result = fetch_remote_cameras(server.normalized_base_url(), token)

        mark_server_health(
            server,
            ok=result.get("ok", False),
            error=result.get("error", ""),
        )
        if not result.get("ok"):
            return Response(result, status=status.HTTP_502_BAD_GATEWAY)

        cameras = _attach_proxy_urls(server.pk, result.get("cameras") or [])
        server.cached_cameras = result.get("cameras") or []
        server.cameras_fetched_at = timezone.now()
        server.save(update_fields=["cached_cameras", "cameras_fetched_at", "updated_at"])
        return Response(
            {
                "ok": True,
                "server_id": server.pk,
                "server_name": server.name,
                "connection_mode": server.connection_mode,
                "source": result.get("source"),
                "cameras": cameras,
                "count": len(cameras),
            }
        )

    @action(detail=True, methods=["get"], url_path="detection-events")
    def detection_events(self, request, pk=None):
        server = self.get_object()
        if server.is_ml_mode():
            return Response(
                {
                    "ok": True,
                    "results": [],
                    "count": 0,
                    "detail": "Detection history is not available for ML-only nodes.",
                }
            )
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = min(100, max(1, int(request.query_params.get("page_size", 25))))
        except (TypeError, ValueError):
            page_size = 25
        is_alert_q = request.query_params.get("is_alert")
        is_alert = None
        if is_alert_q is not None:
            is_alert = str(is_alert_q).lower() in ("1", "true", "yes")

        token = self._effective_token(server)
        result = fetch_remote_detection_events(
            server.normalized_base_url(),
            token,
            page=page,
            page_size=page_size,
            is_alert=is_alert,
        )
        if not result.get("ok"):
            return Response(result, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result)

    @action(detail=True, methods=["post"], url_path="remove-camera")
    def remove_camera(self, request, pk=None):
        """Remove a camera from this server (remote delete + hub cache prune)."""
        server = self.get_object()
        stream_key = _resolve_stream_key(
            (request.data.get("stream_key") or request.data.get("ml_stream_key") or ""),
            request.data.get("camera_id"),
            (request.data.get("code") or ""),
        )
        camera_id = _parse_camera_id(request.data.get("camera_id"))
        code = (request.data.get("code") or "").strip()
        if not stream_key and camera_id is None and not code:
            return Response(
                {"detail": "stream_key, camera_id, or code is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if camera_id is None and stream_key.startswith("cam-"):
            camera_id = _parse_camera_id(stream_key[4:])

        removed_remote = False
        warnings: list[str] = []

        # Local hub — delete from Django registry (signals unregister ML/journey).
        if _is_local_hub_server(server) and camera_id is not None:
            from cameras.models import Camera

            local = Camera.objects.filter(pk=camera_id).first()
            if local:
                local.delete()
                removed_remote = True

        if not removed_remote:
            if server.is_ml_mode():
                ml_result = unregister_ml_camera_remote(server.resolved_ml_base_url(), stream_key)
                if ml_result.get("ok"):
                    removed_remote = True
                else:
                    warnings.append(ml_result.get("error") or "ML unregister failed")
            elif camera_id is not None:
                token = self._effective_token(server)
                dj_result = delete_remote_camera(server.normalized_base_url(), token, camera_id)
                if dj_result.get("ok"):
                    removed_remote = True
                else:
                    warnings.append(dj_result.get("error") or "Remote delete failed")
                ml_base = server.resolved_ml_base_url()
                if ml_base and stream_key:
                    ml_result = unregister_ml_camera_remote(ml_base, stream_key)
                    if ml_result.get("ok"):
                        removed_remote = True
                    elif not dj_result.get("ok"):
                        warnings.append(ml_result.get("error") or "ML unregister failed")

        remaining = _prune_server_camera_cache(
            server,
            stream_key=stream_key,
            camera_id=camera_id,
            code=code,
        )
        return Response(
            {
                "ok": True,
                "removed_remote": removed_remote,
                "warnings": warnings,
                "remaining_count": len(remaining),
            }
        )


class AllCitiesCameraSelectionAPIView(APIView):
    """Load / save the current user's All Cities camera checkbox selection."""

    permission_classes = [IsOpsViewer]

    def get(self, request):
        pref, _ = AllCitiesCameraPreference.objects.get_or_create(user=request.user)
        keys = pref.selected_camera_keys if isinstance(pref.selected_camera_keys, list) else []
        return Response({"selected_camera_keys": keys})

    def put(self, request):
        raw = request.data.get("selected_camera_keys", [])
        if not isinstance(raw, list):
            return Response(
                {"detail": "selected_camera_keys must be a list of strings."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        keys = [str(k).strip() for k in raw if str(k).strip()]
        # De-dupe while preserving order
        seen: set[str] = set()
        unique: list[str] = []
        for key in keys:
            if key in seen:
                continue
            seen.add(key)
            unique.append(key)
        pref, _ = AllCitiesCameraPreference.objects.get_or_create(user=request.user)
        pref.selected_camera_keys = unique
        pref.save(update_fields=["selected_camera_keys", "updated_at"])
        return Response({"selected_camera_keys": pref.selected_camera_keys})


class AllCitiesStreamsAPIView(APIView):
    """Aggregate live cameras from every active connected Central Ops server."""

    permission_classes = [IsOpsViewer]

    def get(self, request):
        ensure_default_remote_server(request.user)
        refresh = str(request.query_params.get("refresh", "")).lower() in ("1", "true", "yes")
        servers = list(RemoteServer.objects.filter(is_active=True).order_by("name"))
        servers_out: list[dict] = []
        cameras_out: list[dict] = []

        def fetch_server(server: RemoteServer) -> dict:
            if server.is_ml_mode():
                return fetch_ml_cameras(
                    server.resolved_ml_base_url(),
                    server_name=server.name,
                )
            token = (server.auth_token or "").strip()
            if not token or token in ("pending", "ml-only"):
                token = token_for_user(request.user) or ""
            return fetch_remote_cameras(server.normalized_base_url(), token)

        live_results: dict = {}
        # Soft load: never block on servers that already have any camera cache.
        # Only contact remotes when refresh=1 or the cache is empty (first paint).
        # TTL freshness still applies on refresh paths via _cache_is_fresh.
        servers_to_fetch = [
            server
            for server in servers
            if refresh or not (server.cached_cameras and len(server.cached_cameras) > 0)
        ]
        # Keep soft loads snappy for mobile / WAN; hard refresh gets a bit more time.
        overall_fetch_timeout = 10.0 if refresh else 6.0
        if servers_to_fetch:
            executor = ThreadPoolExecutor(max_workers=min(8, len(servers_to_fetch)))
            try:
                future_to_id = {
                    executor.submit(fetch_server, server): server.pk
                    for server in servers_to_fetch
                }
                done, not_done = wait(
                    future_to_id.keys(),
                    timeout=overall_fetch_timeout,
                    return_when=ALL_COMPLETED,
                )
                for future in done:
                    server_id = future_to_id[future]
                    try:
                        live_results[server_id] = future.result(timeout=0)
                    except Exception as exc:  # noqa: BLE001 — surface remote failures per server
                        live_results[server_id] = {
                            "ok": False,
                            "error": str(exc) or "Failed to fetch cameras",
                            "cameras": [],
                        }
                for future in not_done:
                    server_id = future_to_id[future]
                    future.cancel()
                    live_results[server_id] = {
                        "ok": False,
                        "error": "Timed out contacting ML server",
                        "cameras": [],
                    }
            finally:
                executor.shutdown(wait=False, cancel_futures=True)

        for server in servers:
            entry: dict = {
                "id": server.pk,
                "name": server.name,
                "location_code": server.location_code or "",
                "connection_mode": server.connection_mode,
                "ml_base_url": server.resolved_ml_base_url(),
                "last_health": server.last_health or "",
                "last_error": server.last_error or "",
                "ok": False,
                "source": "",
                "error": "",
                "camera_count": 0,
            }
            raw_cameras: list = []

            # Soft load: serve any existing cache immediately (ignore TTL) so mobile
            # clients never wait on distant ML nodes when we already know the cameras.
            soft_cache_ok = (not refresh) and bool(server.cached_cameras)
            use_cache = soft_cache_ok or _cache_is_fresh(server, refresh=refresh)
            if use_cache:
                raw_cameras = list(server.cached_cameras or [])
                entry["ok"] = True
                entry["source"] = "cache"
            else:
                result = live_results.get(server.pk, {"ok": False, "error": "Failed to fetch cameras"})

                mark_server_health(
                    server,
                    ok=result.get("ok", False),
                    error=result.get("error", ""),
                )
                server.refresh_from_db()
                entry["last_health"] = server.last_health or ""
                entry["last_error"] = server.last_error or ""

                if result.get("ok"):
                    raw_cameras = list(result.get("cameras") or [])
                    server.cached_cameras = raw_cameras
                    server.cameras_fetched_at = timezone.now()
                    server.save(
                        update_fields=["cached_cameras", "cameras_fetched_at", "updated_at"]
                    )
                    entry["ok"] = True
                    entry["source"] = result.get("source") or "live"
                else:
                    entry["error"] = result.get("error") or "Failed to fetch cameras"
                    if server.cached_cameras:
                        raw_cameras = list(server.cached_cameras or [])
                        entry["source"] = "cache_fallback"
                        entry["ok"] = True
                        # Cameras are shown from cache — don't alarm the wall UI
                        entry["error"] = ""

            cameras = _attach_proxy_urls(server.pk, raw_cameras)
            for cam in cameras:
                row = dict(cam)
                row["server_id"] = server.pk
                row["server_name"] = server.name
                row["location_code"] = server.location_code or ""
                cameras_out.append(row)

            entry["camera_count"] = len(cameras)
            servers_out.append(entry)

        return Response(
            {
                "ok": True,
                "servers": servers_out,
                "cameras": cameras_out,
                "count": len(cameras_out),
                "server_count": len(servers_out),
            }
        )


class ProbeMlGpusAPIView(APIView):
    """Discover CUDA GPUs on an ML node or this Django host (IT Super Admin)."""

    permission_classes = [IsITSuperAdminOnly]

    def post(self, request):
        return self._probe(request)

    def get(self, request):
        return self._probe(request)

    def _probe(self, request):
        from .client import list_host_gpus_nvidia_smi, _is_local_ml_url
        from .utils import ensure_ml_url

        raw_url = ""
        if hasattr(request, "data") and isinstance(request.data, dict):
            raw_url = (request.data.get("ml_base_url") or request.data.get("url") or "").strip()
        if not raw_url:
            raw_url = (
                request.query_params.get("ml_base_url")
                or request.query_params.get("url")
                or ""
            ).strip()

        # No URL → list GPUs on this Django machine (nvidia-smi).
        if not raw_url:
            host_gpus = list_host_gpus_nvidia_smi()
            if not host_gpus:
                return Response(
                    {
                        "ok": False,
                        "error": "No NVIDIA GPUs found on this host (nvidia-smi empty or missing).",
                        "ml_base_url": "",
                        "gpus": [],
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )
            return Response(
                {
                    "ok": True,
                    "ml_base_url": "",
                    "gpus": host_gpus,
                    "ml_device": host_gpus[0]["index"],
                    "cuda_available": True,
                    "cuda_device_name": host_gpus[0].get("name"),
                    "cuda_device_count": len(host_gpus),
                    "source": "host_nvidia_smi",
                    "error": None,
                }
            )

        ml_base = ensure_ml_url(raw_url)
        result = probe_ml_health(ml_base)
        data = result.get("data") if isinstance(result.get("data"), dict) else {}
        gpus = list(result.get("gpus") or [])

        # Local ML: prefer full host inventory (sees all GPUs even if CUDA_VISIBLE_DEVICES pins one).
        if _is_local_ml_url(ml_base):
            host_gpus = list_host_gpus_nvidia_smi()
            if host_gpus and len(host_gpus) >= max(len(gpus), 1):
                gpus = host_gpus

        if not result.get("ok") and not gpus:
            # Last resort for any URL that points at this box by LAN IP
            host_gpus = list_host_gpus_nvidia_smi()
            if host_gpus:
                gpus = host_gpus
            else:
                return Response(
                    {
                        "ok": False,
                        "error": result.get("error") or "ML unreachable",
                        "ml_base_url": ml_base,
                        "gpus": [],
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        return Response(
            {
                "ok": True if gpus else bool(result.get("ok")),
                "ml_base_url": ml_base,
                "gpus": gpus,
                "ml_device": data.get("ml_device"),
                "cuda_available": data.get("cuda_available") if data else bool(gpus),
                "cuda_device_name": data.get("cuda_device_name")
                if data
                else (gpus[0]["name"] if gpus else None),
                "cuda_device_count": data.get("cuda_device_count") if data else len(gpus),
                "source": "ml_health" if result.get("ok") else "host_nvidia_smi",
                "error": None if gpus else (result.get("error") or None),
            }
        )


class QuickConnectView(APIView):
    """Connect to an ML node (default) or remote Django; save + list that server's cameras."""

    permission_classes = [IsITSuperAdminOnly]

    def post(self, request):
        ser = QuickConnectSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        mode = ser.validated_data.get("connection_mode") or ConnectionMode.ML
        base = (ser.validated_data.get("base_url") or "").rstrip("/")
        ml_base = (ser.validated_data.get("ml_base_url") or "").strip().rstrip("/")
        name = (ser.validated_data.get("name") or "").strip() or "ML Server"
        do_save = bool(ser.validated_data.get("save", True))

        # ——— ML-only: cameras from this ML server only ———
        if mode == ConnectionMode.ML:
            if not ml_base:
                return Response(
                    {"ok": False, "error": "ML server URL is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            health = probe_ml_health(ml_base)
            if not health.get("ok"):
                return Response(
                    {
                        "ok": False,
                        "error": health.get("error") or "ML connection failed",
                        "health": health,
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            cams = fetch_ml_cameras(ml_base, server_name=name)
            if not cams.get("ok"):
                return Response(cams, status=status.HTTP_502_BAD_GATEWAY)

            server_id = None
            if do_save:
                defaults = {
                    "connection_mode": ConnectionMode.ML,
                    "base_url": ml_base,
                    "ml_base_url": ml_base,
                    "auth_token": "ml-only",
                    "is_active": True,
                    "created_by": request.user,
                    "cached_cameras": cams.get("cameras") or [],
                    "cameras_fetched_at": timezone.now(),
                }
                site_id = ser.validated_data.get("site")
                if site_id is not None:
                    defaults["site_id"] = site_id
                gpu = (ser.validated_data.get("gpu") or "").strip()
                if gpu:
                    defaults["gpu"] = gpu
                gpu_device = ser.validated_data.get("gpu_device")
                if gpu_device is not None:
                    defaults["gpu_device"] = int(gpu_device)
                max_cameras = ser.validated_data.get("max_cameras")
                if max_cameras:
                    defaults["max_cameras"] = int(max_cameras)
                server, _ = RemoteServer.objects.update_or_create(
                    name=name,
                    defaults=defaults,
                )
                if health.get("ok"):
                    apply_detected_gpu(
                        server,
                        health,
                        preferred_index=server.gpu_device,
                        force=not (server.gpu or "").strip(),
                    )
                mark_server_health(server, ok=True, error="")
                server_id = server.pk
                cameras = _attach_proxy_urls(server_id, cams.get("cameras") or [])
            else:
                from urllib.parse import quote

                cameras = []
                for cam in cams.get("cameras") or []:
                    row = dict(cam)
                    key = (row.get("ml_stream_key") or "").strip()
                    if key:
                        row["ml_live_stream_url"] = (
                            f"/api/ops/ephemeral-mjpeg/?base_url={quote(ml_base, safe='')}"
                            f"&ml_base_url={quote(ml_base, safe='')}"
                            f"&stream_key={quote(key, safe='')}"
                            f"&kind=live"
                        )
                    cameras.append(row)

            return Response(
                {
                    "ok": True,
                    "connection_mode": ConnectionMode.ML,
                    "base_url": ml_base,
                    "ml_base_url": ml_base,
                    "server_id": server_id,
                    "server_name": name,
                    "cameras": cameras,
                    "count": len(cameras),
                    "health": health,
                }
            )

        # ——— Django mode (full remote Tekeye) ———
        token = resolve_remote_token(request, ser.validated_data.get("auth_token"))
        if not token:
            return Response(
                {"ok": False, "error": "No auth token available for your account. Log in again."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not base:
            return Response(
                {"ok": False, "error": "Django server URL is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        health = probe_health(base, token)
        if not health.get("ok"):
            return Response(
                {"ok": False, "error": health.get("error") or "Connection failed", "health": health},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        cams = fetch_remote_cameras(base, token)
        if not cams.get("ok"):
            return Response(cams, status=status.HTTP_502_BAD_GATEWAY)

        from urllib.parse import quote, urlparse, urlunparse

        ml_root = ml_base
        if not ml_root:
            parsed = urlparse(base)
            if parsed.port == 8000 and parsed.hostname:
                ml_root = urlunparse((parsed.scheme, f"{parsed.hostname}:8100", "", "", "", ""))
            else:
                ml_root = base

        server_id = None
        if do_save:
            server, _created = RemoteServer.objects.update_or_create(
                name=name,
                defaults={
                    "connection_mode": ConnectionMode.DJANGO,
                    "base_url": base,
                    "ml_base_url": ml_root if ml_base else "",
                    "auth_token": token,
                    "is_active": True,
                    "created_by": request.user,
                    "cached_cameras": cams.get("cameras") or [],
                    "cameras_fetched_at": timezone.now(),
                },
            )
            if not ml_base and not server.ml_base_url:
                server.ml_base_url = ml_root
                server.save(update_fields=["ml_base_url", "updated_at"])
            mark_server_health(server, ok=True, error="")
            server_id = server.pk
            cameras = _attach_proxy_urls(server_id, cams.get("cameras") or [])
        else:
            cameras = []
            for cam in cams.get("cameras") or []:
                row = dict(cam)
                key = (row.get("ml_stream_key") or "").strip()
                if key:
                    row["ml_live_stream_url"] = (
                        f"/api/ops/ephemeral-mjpeg/?base_url={quote(base, safe='')}"
                        f"&ml_base_url={quote(ml_root, safe='')}"
                        f"&stream_key={quote(key, safe='')}"
                        f"&kind=live"
                        f"&remote_token={quote(token, safe='')}"
                    )
                cameras.append(row)

        return Response(
            {
                "ok": True,
                "connection_mode": ConnectionMode.DJANGO,
                "base_url": base,
                "ml_base_url": ml_root,
                "server_id": server_id,
                "server_name": name,
                "cameras": cameras,
                "count": len(cameras),
                "health": health,
            }
        )


class RemoteMjpegProxyView(APIView):
    """Proxy MJPEG (or single JPEG snapshot) from a saved remote server's ML service."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, pk):
        if _ops_user_from_request(request) is None:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            server = RemoteServer.objects.get(pk=pk, is_active=True)
        except RemoteServer.DoesNotExist:
            return Response({"detail": "Server not found."}, status=status.HTTP_404_NOT_FOUND)

        stream_key = (request.query_params.get("stream_key") or "").strip()
        camera_id = (request.query_params.get("camera_id") or "").strip()
        kind = (request.query_params.get("kind") or "live").strip().lower()
        if not stream_key and camera_id:
            stream_key = f"cam-{camera_id}"
        if not stream_key:
            return Response(
                {"detail": "stream_key or camera_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ml_base = server.resolved_ml_base_url()
        rtsp_url = _resolve_stream_rtsp_url(server, stream_key)
        candidates = _ml_stream_upstream_candidates(
            ml_base=ml_base,
            django_base=server.normalized_base_url(),
            stream_key=stream_key,
            kind=kind,
            rtsp_url=rtsp_url,
        )
        is_jpeg = kind in ("jpeg", "snapshot", "jpeg_raw", "raw_jpeg")

        def open_upstream():
            last_err = ""
            not_registered = False
            for url in candidates:
                try:
                    resp = requests.get(
                        url,
                        stream=not is_jpeg,
                        timeout=(8, 12) if is_jpeg else (10, 60),
                        headers={"Accept": "image/jpeg,*/*" if is_jpeg else "*/*"},
                    )
                except requests.RequestException as exc:
                    last_err = str(exc)
                    continue
                if resp.status_code == 200:
                    return resp, "", False
                # ML answers 409/404 when the camera is missing from its live registry
                if resp.status_code in (404, 409):
                    not_registered = True
                last_err = f"{url} → HTTP {resp.status_code}"
                resp.close()
            return None, last_err, not_registered

        upstream, last_err, not_registered = open_upstream()
        if upstream is None and not_registered and _reregister_ml_camera(
            server, ml_base, stream_key, rtsp_url
        ):
            upstream, last_err, _ = open_upstream()

        if upstream is None:
            return Response(
                {"detail": f"Could not open remote stream: {last_err}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if is_jpeg:
            try:
                body = upstream.content
            finally:
                upstream.close()
            response = HttpResponse(body, content_type="image/jpeg")
            response["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response["Pragma"] = "no-cache"
            return response

        content_type = upstream.headers.get(
            "Content-Type", "multipart/x-mixed-replace; boundary=frame"
        )

        def generate():
            try:
                for chunk in upstream.iter_content(chunk_size=16 * 1024):
                    if chunk:
                        yield chunk
            finally:
                upstream.close()

        response = StreamingHttpResponse(generate(), content_type=content_type)
        response["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response["Pragma"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class RemoteWebRtcProxyView(APIView):
    """
    Viewing path: RTSP (via go2rtc) → WebRTC SDP answer for the browser.
    POST body = SDP offer (application/sdp or text/plain). Auth via session or ?token=.
    Falls back with 503 when GO2RTC_URL is unset — UI should use MJPEG.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, pk: int):
        """Capability probe for All Cities UI."""
        if _ops_user_from_request(request) is None:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        from django.conf import settings

        enabled = bool(getattr(settings, "GO2RTC_ENABLED", False)) and _go2rtc_configured()
        return Response(
            {
                "webrtc_enabled": enabled,
                "video_mode": getattr(settings, "GO2RTC_VIDEO_MODE", "h264"),
            }
        )

    def post(self, request, pk: int):
        if _ops_user_from_request(request) is None:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        from django.conf import settings

        if not (getattr(settings, "GO2RTC_ENABLED", False) and _go2rtc_configured()):
            return Response(
                {
                    "detail": "WebRTC viewing path is not configured. Set GO2RTC_URL and start go2rtc.",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            server = RemoteServer.objects.get(pk=pk, is_active=True)
        except RemoteServer.DoesNotExist:
            return Response({"detail": "Server not found."}, status=status.HTTP_404_NOT_FOUND)

        stream_key = (request.query_params.get("stream_key") or "").strip()
        camera_id = (request.query_params.get("camera_id") or "").strip()
        if not stream_key and camera_id:
            stream_key = f"cam-{camera_id}"
        if not stream_key:
            return Response(
                {"detail": "stream_key or camera_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rtsp_url = _resolve_stream_rtsp_url(server, stream_key)
        if not rtsp_url:
            return Response(
                {
                    "detail": (
                        f"No RTSP URL for {stream_key}. "
                        "Ensure the camera is synced and NVR credentials are set."
                    ),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        name = _go2rtc_stream_name(pk, stream_key)
        # ensure_stream registers + warms; skip duplicate warm if already hot
        if not _go2rtc_ensure_stream(name, rtsp_url):
            return Response(
                {"detail": "Could not register stream with go2rtc. Is go2rtc running?"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        # Ensure still warm (ensure_stream may have returned last-resort without warm)
        if not _go2rtc_warm_stream(name):
            return Response(
                {
                    "detail": (
                        f"go2rtc could not decode {stream_key}. "
                        "Check NVR RTSP / ffmpeg on the go2rtc host."
                    ),
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Body may be raw SDP or JSON {"sdp": "..."}
        offer = ""
        content_type = (request.content_type or "").lower()
        if "application/json" in content_type:
            offer = (request.data.get("sdp") or request.data.get("offer") or "").strip()
        else:
            raw = request.body
            if isinstance(raw, (bytes, bytearray)):
                offer = raw.decode("utf-8", errors="replace").strip()
            else:
                offer = str(raw or "").strip()
        if not offer:
            return Response({"detail": "SDP offer required in body."}, status=status.HTTP_400_BAD_REQUEST)

        answer, err = _go2rtc_exchange_sdp(name, offer)
        if not answer:
            return Response(
                {"detail": err or "WebRTC negotiation failed."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return HttpResponse(answer, content_type="application/sdp")


class RemoteViewStreamView(APIView):
    """
    High-quality viewing path: NVR main RTSP → ffmpeg MJPEG (not ML 720p).
    GET ?stream_key=cam-N&kind=mjpeg|jpeg&max_width=1920 (0 = native 4K)
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, pk: int):
        if _ops_user_from_request(request) is None:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            server = RemoteServer.objects.get(pk=pk, is_active=True)
        except RemoteServer.DoesNotExist:
            return Response({"detail": "Server not found."}, status=status.HTTP_404_NOT_FOUND)

        stream_key = (request.query_params.get("stream_key") or "").strip()
        camera_id = (request.query_params.get("camera_id") or "").strip()
        if not stream_key and camera_id:
            stream_key = f"cam-{camera_id}"
        if not stream_key:
            return Response(
                {"detail": "stream_key or camera_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rtsp_url = _resolve_stream_rtsp_url(server, stream_key)
        if not rtsp_url:
            return Response(
                {"detail": f"No RTSP URL for {stream_key}."},
                status=status.HTTP_404_NOT_FOUND,
            )

        from django.conf import settings
        from cameras.stream_utils import (
            capture_view_jpeg_frame,
            ffmpeg_available,
            generate_view_mjpeg_frames,
        )

        if not ffmpeg_available():
            return Response(
                {"detail": "ffmpeg is not available on the hub."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        kind = (request.query_params.get("kind") or "mjpeg").strip().lower()
        try:
            max_width = int(
                request.query_params.get("max_width")
                or getattr(settings, "VIEW_STREAM_MAX_WIDTH", 1920)
            )
        except (TypeError, ValueError):
            max_width = 1920
        max_width = max(0, max_width)
        fps = int(getattr(settings, "VIEW_STREAM_FPS", 15))
        q = int(getattr(settings, "VIEW_STREAM_JPEG_QUALITY", 3))

        if kind in ("jpeg", "snapshot", "frame"):
            body = capture_view_jpeg_frame(rtsp_url, max_width=max_width)
            if not body:
                return Response(
                    {"detail": "Could not capture frame from NVR."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            response = HttpResponse(body, content_type="image/jpeg")
            response["Cache-Control"] = "no-cache, no-store, must-revalidate"
            return response

        response = StreamingHttpResponse(
            generate_view_mjpeg_frames(
                rtsp_url,
                max_width=max_width,
                fps=fps,
                jpeg_quality=q,
            ),
            content_type="multipart/x-mixed-replace; boundary=frame",
        )
        response["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response["Pragma"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class EphemeralMjpegProxyView(APIView):
    """Proxy MJPEG for quick-connect (base_url + stream_key in query). ADMIN only."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        if _ops_user_from_request(request) is None:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        base = (request.query_params.get("base_url") or "").strip().rstrip("/")
        ml_base = (request.query_params.get("ml_base_url") or "").strip().rstrip("/") or base
        stream_key = (request.query_params.get("stream_key") or "").strip()
        kind = (request.query_params.get("kind") or "live").strip().lower()
        token = (request.query_params.get("remote_token") or "").strip()

        if not stream_key:
            return Response(
                {"detail": "ml_base_url (or base_url) and stream_key are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not ml_base:
            return Response(
                {"detail": "ml_base_url or base_url is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not (ml_base.startswith("http://") or ml_base.startswith("https://")):
            return Response({"detail": "Invalid ML URL."}, status=status.HTTP_400_BAD_REQUEST)

        path = f"/live/cam/{stream_key}/mjpeg/raw" if kind == "raw" else f"/live/cam/{stream_key}/mjpeg"
        candidates = [
            urljoin(ml_base.rstrip("/") + "/", path.lstrip("/")),
        ]
        if base and base != ml_base:
            candidates.append(urljoin(base + "/", f"ml{path}"))
        headers = {"Accept": "*/*"}
        if token:
            headers["Authorization"] = f"Token {token}"

        upstream = None
        last_err = ""
        for url in candidates:
            try:
                upstream = requests.get(url, stream=True, timeout=(10, 60), headers=headers)
                if upstream.status_code == 200:
                    break
                last_err = f"{url} → HTTP {upstream.status_code}"
                upstream.close()
                upstream = None
            except requests.RequestException as exc:
                last_err = str(exc)
                upstream = None

        if upstream is None:
            return Response(
                {"detail": f"Could not open remote stream: {last_err}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        content_type = upstream.headers.get(
            "Content-Type", "multipart/x-mixed-replace; boundary=frame"
        )

        def generate():
            try:
                for chunk in upstream.iter_content(chunk_size=16 * 1024):
                    if chunk:
                        yield chunk
            finally:
                upstream.close()

        response = StreamingHttpResponse(generate(), content_type=content_type)
        response["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response["Pragma"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
