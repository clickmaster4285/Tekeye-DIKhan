"""Serve /media/ only to logged-in users (token header or auth cookie)."""

from __future__ import annotations

from django.conf import settings
from django.core.exceptions import SuspiciousFileOperation
from django.http import Http404, HttpResponse, HttpResponseRedirect
from django.views.static import serve
from rest_framework.authtoken.models import Token
from urllib.parse import quote

MEDIA_AUTH_COOKIE = "tekeye_auth_token"


def attach_media_auth_cookie(response: HttpResponse, token_key: str, request=None) -> HttpResponse:
    """Allow same-origin <img> / new-tab requests to send the API token."""
    response.set_cookie(
        MEDIA_AUTH_COOKIE,
        token_key,
        httponly=False,
        samesite="Lax",
        path="/",
        secure=bool(request and request.is_secure()),
    )
    return response


def clear_media_auth_cookie(response: HttpResponse) -> HttpResponse:
    response.delete_cookie(MEDIA_AUTH_COOKIE, path="/", samesite="Lax")
    return response


def _token_key_from_request(request) -> str:
    auth = (request.META.get("HTTP_AUTHORIZATION") or "").strip()
    if auth.lower().startswith("token "):
        return auth[6:].strip()
    return (request.COOKIES.get(MEDIA_AUTH_COOKIE) or "").strip()


def media_user_from_request(request):
    key = _token_key_from_request(request)
    if not key:
        return None
    try:
        token = Token.objects.select_related("user").get(key=key)
    except Token.DoesNotExist:
        return None
    user = token.user
    if not user.is_active or getattr(user, "is_deleted", False):
        return None
    return user


def _safe_media_next(path: str) -> str | None:
    value = (path or "").strip()
    if not value.startswith("/media/"):
        return None
    if value.startswith("//") or "\\" in value or "://" in value:
        return None
    return value


def _login_redirect(request) -> HttpResponseRedirect:
    next_path = _safe_media_next(request.get_full_path() or "") or "/media/"
    return HttpResponseRedirect("/login?next=" + quote(next_path, safe="/"))


def _unauthorized(request) -> HttpResponse:
    accept = (request.headers.get("Accept") or "").lower()
    if "text/html" in accept:
        return _login_redirect(request)
    return HttpResponse("Authentication required", status=401, content_type="text/plain")


def protected_media(request, path: str):
    if request.method not in ("GET", "HEAD"):
        return HttpResponse(status=405)
    if media_user_from_request(request) is None:
        return _unauthorized(request)
    if not path or path.endswith("/"):
        raise Http404("Not found")
    try:
        response = serve(request, path, document_root=settings.MEDIA_ROOT)
    except SuspiciousFileOperation:
        raise Http404("Not found")
    response["Cache-Control"] = "private, no-store"
    return response
