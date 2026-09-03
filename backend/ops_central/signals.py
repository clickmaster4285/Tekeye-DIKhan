"""Keep Central Ops camera caches in sync with the local camera registry."""

from __future__ import annotations

import logging

from django.db.models.signals import post_delete
from django.dispatch import receiver

from cameras.models import Camera

from .cache import prune_camera_from_all_server_caches

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=Camera)
def camera_deleted_prune_ops_cache(sender, instance: Camera, **kwargs) -> None:
    try:
        prune_camera_from_all_server_caches(
            camera_id=instance.pk,
            stream_key=instance.stream_key,
            code=(instance.code or "").strip(),
        )
    except Exception:
        logger.exception(
            "[ops-cache] Failed to prune server caches after camera %s delete",
            instance.pk,
        )
