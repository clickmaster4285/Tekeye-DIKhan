"""Emit Socket.IO invalidations when domain data changes."""

from __future__ import annotations

import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def _emit(*domains: str, throttle_sec: float = 0.0) -> None:
    try:
        from .sio_app import emit_invalidate

        emit_invalidate(list(domains), throttle_sec=throttle_sec)
    except Exception:
        logger.debug("[realtime] signal emit skipped", exc_info=True)


def _connect(model, *domains: str, throttle_sec: float = 0.0) -> None:
    @receiver(post_save, sender=model, weak=False)
    def _on_save(sender, **kwargs):  # noqa: ARG001
        _emit(*domains, throttle_sec=throttle_sec)

    @receiver(post_delete, sender=model, weak=False)
    def _on_delete(sender, **kwargs):  # noqa: ARG001
        _emit(*domains, throttle_sec=throttle_sec)


try:
    from visitors.models import Visitor, VisitorNotification, VmsListRecord, SecurityAlert, ZoneAccessLog

    _connect(Visitor, "vms", "dashboard")
    _connect(VisitorNotification, "vms", "notifications")
    _connect(VmsListRecord, "vms")
    _connect(SecurityAlert, "vms", "alerts")
    _connect(ZoneAccessLog, "vms")
except Exception:
    logger.debug("[realtime] visitors signals not wired", exc_info=True)

try:
    from cameras.models import Camera, DetectionEvent, NvrDevice, Site

    _connect(Camera, "cameras")
    _connect(NvrDevice, "cameras")
    _connect(Site, "cameras")
    _connect(DetectionEvent, "cameras", "detections", "alerts", throttle_sec=1.0)
except Exception:
    logger.debug("[realtime] cameras signals not wired", exc_info=True)

try:
    from ops_central.models import RemoteServer, AllCitiesCameraPreference

    _connect(RemoteServer, "ops", "cameras")
    _connect(AllCitiesCameraPreference, "ops", "cameras")
except Exception:
    logger.debug("[realtime] ops_central signals not wired", exc_info=True)

try:
    from person_journey.models import JourneyPerson, JourneyEvent, CameraTrack

    _connect(JourneyPerson, "person_journey")
    _connect(JourneyEvent, "person_journey", throttle_sec=2.0)
    _connect(CameraTrack, "person_journey", throttle_sec=2.0)
except Exception:
    logger.debug("[realtime] person_journey signals not wired", exc_info=True)

try:
    from object_tracking.models import GlobalObject, ObjectVisit, ObjectCameraTrack

    _connect(GlobalObject, "object_tracking", throttle_sec=2.0)
    _connect(ObjectVisit, "object_tracking", throttle_sec=2.0)
    _connect(ObjectCameraTrack, "object_tracking", throttle_sec=2.0)
except Exception:
    logger.debug("[realtime] object_tracking signals not wired", exc_info=True)

try:
    from gps_tracking.models import OfficerGpsLatest, OfficerGpsHistory

    # Heartbeats are frequent — throttle so the map stays live without flooding.
    _connect(OfficerGpsLatest, "gps", throttle_sec=2.0)
    _connect(OfficerGpsHistory, "gps", throttle_sec=5.0)
except Exception:
    logger.debug("[realtime] gps_tracking signals not wired", exc_info=True)

try:
    from users.models import User, Attendance, LeaveRequest, PayrollRun

    _connect(User, "users", "hr")
    _connect(Attendance, "hr", "attendance")
    _connect(LeaveRequest, "hr")
    _connect(PayrollRun, "hr")
except Exception:
    logger.debug("[realtime] users/hr signals not wired", exc_info=True)

try:
    from seizure_management.models import (
        SeizureReport,
        NoteSheet,
        NoteSheetNotification,
        DetentionAssessment,
        RecoveryMemo,
    )

    _connect(SeizureReport, "seizure")
    _connect(NoteSheet, "seizure")
    _connect(NoteSheetNotification, "seizure", "notifications")
    _connect(DetentionAssessment, "seizure")
    _connect(RecoveryMemo, "seizure")
except Exception:
    logger.debug("[realtime] seizure signals not wired", exc_info=True)

try:
    from detentions.models import DetentionMemo

    _connect(DetentionMemo, "detentions", "seizure")
except Exception:
    logger.debug("[realtime] detentions signals not wired", exc_info=True)

try:
    from warehouse.models import WarehouseStockItem, MemoDistribution, DestructionAlert

    _connect(WarehouseStockItem, "warehouse")
    _connect(MemoDistribution, "warehouse")
    _connect(DestructionAlert, "warehouse", "alerts")
except Exception:
    logger.debug("[realtime] warehouse signals not wired", exc_info=True)

try:
    from video_recovery.models import VideoRecoveryJob

    _connect(VideoRecoveryJob, "video_recovery")
except Exception:
    logger.debug("[realtime] video_recovery signals not wired", exc_info=True)

try:
    from recognition.models import FaceEnrollment, DetectionSnapshot

    _connect(FaceEnrollment, "recognition", "hr")
    _connect(DetectionSnapshot, "recognition", "detections", "attendance", throttle_sec=1.0)
except Exception:
    logger.debug("[realtime] recognition signals not wired", exc_info=True)
