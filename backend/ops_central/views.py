"""Central Ops — Super Admin remote server registry and live stream proxy."""

from __future__ import annotations

from urllib.parse import urljoin

import requests
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import is_ops_viewer

from .client import (
    delete_remote_camera,
    fetch_ml_cameras,
    fetch_remote_cameras,
    fetch_remote_detection_events,
    mark_server_health,
    probe_health,
    probe_ml_health,
    unregister_ml_camera_remote,
)
from .models import ConnectionMode, RemoteServer
from .permissions import IsITSuperAdminOnly, IsOpsViewer
from .serializers import QuickConnectSerializer, RemoteServerSerializer
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


def _attach_proxy_urls(server_id: int | None, cameras: list[dict]) -> list[dict]:
    """Rewrite stream URLs to hub proxy endpoints."""
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
            elif cam_id is not None:
                row["ml_live_stream_url"] = (
                    f"/api/ops/servers/{server_id}/mjpeg/?camera_id={cam_id}&kind=live"
                )
        out.append(row)
    return out


def _is_local_hub_server(server: RemoteServer) -> bool:
    ml = (server.resolved_ml_base_url() or "").lower()
    base = (server.normalized_base_url() or "").lower()
    local_hosts = ("127.0.0.1", "localhost", "::1")
    return any(host in ml or host in base for host in local_hosts)


def _parse_camera_id(value) -> int | None:
    if value is None or value == "":
        return None
    try:
        parsed = int(value)
        return parsed if parsed > 0 else None
    except (TypeError, ValueError):
        return None


def _resolve_stream_key(stream_key: str, camera_id, code: str) -> str:
    key = (stream_key or "").strip()
    if key:
        return key
    cid = _parse_camera_id(camera_id)
    if cid:
        return f"cam-{cid}"
    code = (code or "").strip()
    if code:
        return code if code.startswith("cam-") else f"cam-{code}"
    return ""


def _camera_matches_entry(
    cam: dict,
    *,
    stream_key: str,
    camera_id: int | None,
    code: str,
) -> bool:
    if stream_key and (cam.get("ml_stream_key") or cam.get("code") or "") == stream_key:
        return True
    if camera_id is not None and cam.get("id") == camera_id:
        return True
    if code and (cam.get("code") or "") == code:
        return True
    if stream_key.startswith("cam-"):
        sid = stream_key[4:]
        if sid.isdigit() and cam.get("id") == int(sid):
            return True
    return False


def _prune_server_camera_cache(
    server: RemoteServer,
    *,
    stream_key: str,
    camera_id: int | None,
    code: str,
) -> list[dict]:
    cached = list(server.cached_cameras or [])
    if not cached:
        return cached
    pruned = [
        cam
        for cam in cached
        if isinstance(cam, dict)
        and not _camera_matches_entry(
            cam,
            stream_key=stream_key,
            camera_id=camera_id,
            code=code,
        )
    ]
    if len(pruned) != len(cached):
        server.cached_cameras = pruned
        server.save(update_fields=["cached_cameras", "updated_at"])
    return pruned


class RemoteServerViewSet(viewsets.ModelViewSet):
    queryset = RemoteServer.objects.all()
    serializer_class = RemoteServerSerializer
    permission_classes = [IsOpsViewer]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "remove_camera"):
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
        serializer.save(created_by=self.request.user, auth_token=token or "ml-only")

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
        if server.is_ml_mode():
            result = probe_ml_health(server.resolved_ml_base_url())
        else:
            token = self._effective_token(server)
            result = probe_health(server.normalized_base_url(), token)
        mark_server_health(server, ok=result.get("ok", False), error=result.get("error", ""))
        server.refresh_from_db()
        return Response(
            {
                **result,
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
                server, _ = RemoteServer.objects.update_or_create(
                    name=name,
                    defaults={
                        "connection_mode": ConnectionMode.ML,
                        "base_url": ml_base,
                        "ml_base_url": ml_base,
                        "auth_token": "ml-only",
                        "is_active": True,
                        "created_by": request.user,
                        "cached_cameras": cams.get("cameras") or [],
                        "cameras_fetched_at": timezone.now(),
                    },
                )
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
    """Proxy annotated MJPEG from a saved remote server's ML service."""

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
        if kind == "raw":
            path = f"/live/cam/{stream_key}/mjpeg/raw"
        else:
            path = f"/live/cam/{stream_key}/mjpeg"

        candidates = [
            urljoin(ml_base.rstrip("/") + "/", path.lstrip("/")),
            urljoin(server.normalized_base_url() + "/", f"ml{path}"),
        ]

        upstream = None
        last_err = ""
        for url in candidates:
            try:
                upstream = requests.get(
                    url,
                    stream=True,
                    timeout=(10, 60),
                    headers={"Accept": "*/*"},
                )
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
