"""Reverse-geocode GPS coordinates to human-readable place names.

Uses Photon (Komoot/OSM) with Django cache so trail reports do not hammer the
upstream API. Falls back to Nominatim when Photon has no result.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from typing import Iterable

from django.core.cache import cache

logger = logging.getLogger(__name__)

# ~11 m grid — nearby trail points share one lookup.
COORD_DECIMALS = 4
CACHE_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days
CACHE_PREFIX = "gps:revgeo:v2:"
MAX_POINTS_PER_REQUEST = 80
USER_AGENT = "TekEye-Peshawar-GPS/1.0 (customs enforcement; contact=ops)"


def coord_key(lat: float, lng: float) -> str:
    return f"{round(float(lat), COORD_DECIMALS):.{COORD_DECIMALS}f},{round(float(lng), COORD_DECIMALS):.{COORD_DECIMALS}f}"


def _cache_get(key: str) -> str | None:
    value = cache.get(f"{CACHE_PREFIX}{key}")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _cache_set(key: str, name: str) -> None:
    if name:
        cache.set(f"{CACHE_PREFIX}{key}", name, CACHE_TTL_SECONDS)


def _http_get_json(url: str, timeout: float = 8.0) -> dict | list | None:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Accept-Language": "en",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
        logger.debug("Reverse geocode request failed for %s: %s", url, exc)
        return None


def _unique_parts(*parts: str | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for part in parts:
        text = (part or "").strip()
        if not text:
            continue
        low = text.lower()
        if low in seen:
            continue
        seen.add(low)
        out.append(text)
    return out


def _is_mostly_latin(text: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return True
    latin = sum(1 for c in letters if ("A" <= c <= "Z") or ("a" <= c <= "z"))
    return latin / len(letters) >= 0.6


def _format_photon(props: dict) -> str:
    parts = _unique_parts(
        props.get("name"),
        props.get("street") or props.get("road"),
        props.get("district") or props.get("suburb") or props.get("neighbourhood"),
        props.get("city") or props.get("town") or props.get("village") or props.get("county"),
        props.get("state"),
    )
    # Prefer Latin/English segments when OSM returns mixed scripts.
    latin_parts = [p for p in parts if _is_mostly_latin(p)]
    chosen = latin_parts[:4] if latin_parts else parts[:4]
    return ", ".join(chosen)


def _format_nominatim(payload: dict) -> str:
    addr = payload.get("address") if isinstance(payload.get("address"), dict) else {}
    parts = _unique_parts(
        addr.get("amenity") or addr.get("building") or addr.get("shop"),
        addr.get("road") or addr.get("pedestrian") or addr.get("path"),
        addr.get("neighbourhood") or addr.get("suburb") or addr.get("quarter"),
        addr.get("village") or addr.get("town") or addr.get("city") or addr.get("county"),
        addr.get("state"),
    )
    latin_parts = [p for p in parts if _is_mostly_latin(p)]
    if latin_parts:
        return ", ".join(latin_parts[:4])
    if parts:
        return ", ".join(parts[:4])
    display = (payload.get("display_name") or "").strip()
    if display:
        bits = [b.strip() for b in display.split(",") if b.strip() and _is_mostly_latin(b)]
        if not bits:
            bits = [b.strip() for b in display.split(",") if b.strip()]
        return ", ".join(bits[:4])
    return ""

def _reverse_photon(lat: float, lng: float) -> str:
    qs = urllib.parse.urlencode(
        {
            "lat": f"{lat:.6f}",
            "lon": f"{lng:.6f}",
            "lang": "en",
        }
    )
    data = _http_get_json(f"https://photon.komoot.io/reverse?{qs}")
    if not isinstance(data, dict):
        return ""
    features = data.get("features")
    if not isinstance(features, list) or not features:
        return ""
    props = features[0].get("properties") if isinstance(features[0], dict) else None
    if not isinstance(props, dict):
        return ""
    return _format_photon(props)


def _reverse_nominatim(lat: float, lng: float) -> str:
    qs = urllib.parse.urlencode(
        {
            "lat": f"{lat:.6f}",
            "lon": f"{lng:.6f}",
            "format": "jsonv2",
            "addressdetails": 1,
            "zoom": 18,
            "accept-language": "en",
        }
    )
    data = _http_get_json(f"https://nominatim.openstreetmap.org/reverse?{qs}")
    if not isinstance(data, dict):
        return ""
    return _format_nominatim(data)


def reverse_geocode_one(lat: float, lng: float) -> str:
    """Resolve one coordinate pair; uses cache. Empty string if unknown."""
    key = coord_key(lat, lng)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    name = _reverse_photon(lat, lng) or _reverse_nominatim(lat, lng)
    if name:
        _cache_set(key, name)
    return name


def reverse_geocode_batch(points: Iterable[dict]) -> list[dict]:
    """
    Resolve many points. Returns one result per unique rounded key (insertion order).

    Each item: {key, latitude, longitude, locationName}
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    seen: set[str] = set()
    unique: list[tuple[str, float, float]] = []

    for raw in points:
        try:
            lat = float(raw.get("latitude") if "latitude" in raw else raw.get("lat"))
            lng = float(raw.get("longitude") if "longitude" in raw else raw.get("lng") or raw.get("lon"))
        except (TypeError, ValueError, AttributeError):
            continue
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            continue
        key = coord_key(lat, lng)
        if key in seen:
            continue
        seen.add(key)
        unique.append((key, round(lat, COORD_DECIMALS), round(lng, COORD_DECIMALS)))
        if len(unique) >= MAX_POINTS_PER_REQUEST:
            break

    # Serve cache hits immediately; only hit upstream for misses.
    results_by_key: dict[str, dict] = {}
    to_fetch: list[tuple[str, float, float]] = []
    for key, lat, lng in unique:
        cached = _cache_get(key)
        if cached is not None:
            results_by_key[key] = {
                "key": key,
                "latitude": lat,
                "longitude": lng,
                "locationName": cached,
            }
        else:
            to_fetch.append((key, lat, lng))

    def _fetch(item: tuple[str, float, float]) -> tuple[str, float, float, str]:
        key, lat, lng = item
        return key, lat, lng, reverse_geocode_one(lat, lng)

    if to_fetch:
        # Modest parallelism — Photon tolerates light concurrent load; cache fills fast after first report.
        workers = min(6, len(to_fetch))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(_fetch, item) for item in to_fetch]
            for fut in as_completed(futures):
                try:
                    key, lat, lng, name = fut.result()
                except Exception as exc:
                    logger.debug("Reverse geocode worker failed: %s", exc)
                    continue
                results_by_key[key] = {
                    "key": key,
                    "latitude": lat,
                    "longitude": lng,
                    "locationName": name or "",
                }

    return [
        results_by_key.get(
            key,
            {"key": key, "latitude": lat, "longitude": lng, "locationName": ""},
        )
        for key, lat, lng in unique
    ]