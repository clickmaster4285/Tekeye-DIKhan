from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from gps_tracking.models import OfficerGpsHistory
from logs.enforcement import monitor_mobile_devices, user_capabilities
from logs.models import MobileAccessSession, MobileAlert, MobileDevice, MobileEventReceipt
from users.models import Staff, User


def _user(username, role, **kwargs):
    defaults = {
        "password": "pass12345",
        "email": f"{username}@ciis.test",
        "phone": "03000000000",
        "role": role,
        "full_name": username.replace("_", " ").title(),
        "location": kwargs.pop("location", "PESHAWAR"),
    }
    defaults.update(kwargs)
    password = defaults.pop("password")
    user = User.objects.create_user(username=username, password=password, **defaults)
    return user


class MobileEnforcementTests(TestCase):
    def setUp(self):
        self.geo = patch("logs.middleware.get_geo", return_value=(None, None))
        self.geo.start()
        self.addCleanup(self.geo.stop)
        self.client = APIClient()
        self.officer = _user("ahmed", "INSPECTOR")
        self.other = _user("ali", "INSPECTOR")
        self.admin = _user("admin", "ADMIN")
        self.loc_admin = _user("locadmin", "LOCATION_ADMIN", location="PESHAWAR")
        self.kohat_admin = _user("kohatadmin", "LOCATION_ADMIN", location="KOHAT")
        Staff.objects.create(
            user=self.officer,
            full_name="Ahmed Khan",
            cnic="11111-1111111-1",
            designation="Inspector",
            department="Enforcement",
            emergency_contact="0300",
        )

    def _login(self, user, device_uuid="dev-ahmed-1", extra=None):
        payload = {
            "username": user.username,
            "password": "pass12345",
            "device_uuid": device_uuid,
            "device_name": "Pixel",
            "platform": "Android",
            "browser": "Chrome",
            "os_version": "14",
            "app_version": "0.1.0",
            "pwa_version": "0.1.0",
        }
        if extra:
            payload.update(extra)
        res = self.client.post("/api/auth/login/", payload, format="json")
        return res

    def _auth(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_login_creates_device_and_session(self):
        res = self._login(self.officer)
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(res.data.get("mobile_session"))
        self.assertEqual(MobileDevice.objects.filter(user=self.officer).count(), 1)
        self.assertEqual(
            MobileAccessSession.objects.filter(user=self.officer, status="ACTIVE").count(),
            1,
        )

    def test_same_device_login_does_not_duplicate(self):
        self._login(self.officer)
        self._login(self.officer)
        self.assertEqual(MobileDevice.objects.filter(user=self.officer).count(), 1)
        self.assertEqual(
            MobileAccessSession.objects.filter(user=self.officer, status="ACTIVE").count(),
            1,
        )
        self.assertEqual(MobileAccessSession.objects.filter(user=self.officer).count(), 2)

    def test_portal_login_without_device_does_not_register(self):
        res = self.client.post(
            "/api/auth/login/",
            {"username": self.admin.username, "password": "pass12345"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data.get("mobile_session"))
        self.assertEqual(MobileDevice.objects.filter(user=self.admin).count(), 0)

    def test_logout_ends_session(self):
        login = self._login(self.officer)
        session_id = login.data["mobile_session"]["session_id"]
        self._auth(self.officer)
        res = self.client.post(
            "/api/auth/logout/",
            {"session_id": session_id, "device_uuid": "dev-ahmed-1"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        session = MobileAccessSession.objects.get(session_id=session_id)
        self.assertEqual(session.status, "LOGGED_OUT")
        self.assertIsNotNone(session.ended_at)

    def test_logout_invalidates_mobile_session_not_token(self):
        login = self._login(self.officer)
        token = login.data["token"]
        session_id = login.data["mobile_session"]["session_id"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        self.client.post("/api/auth/logout/", {"session_id": session_id}, format="json")
        self.assertTrue(Token.objects.filter(key=token).exists())
        ping = self.client.post(
            "/api/gps/ping/",
            {
                "latitude": 34.01234,
                "longitude": 71.52491,
                "accuracy": 12,
                "session_id": session_id,
                "device_uuid": "dev-ahmed-1",
            },
            format="json",
        )
        self.assertEqual(ping.status_code, 401)
        self.assertEqual(ping.data.get("code"), "SESSION_REVOKED")

    def test_revoked_session_cannot_send_gps(self):
        login = self._login(self.officer)
        session_id = login.data["mobile_session"]["session_id"]
        self._auth(self.admin)
        res = self.client.post("/api/mobile-sessions/revoke/", {"session_id": session_id}, format="json")
        self.assertEqual(res.status_code, 200)
        self._auth(self.officer)
        ping = self.client.post(
            "/api/gps/ping/",
            {
                "latitude": 34.01234,
                "longitude": 71.52491,
                "accuracy": 12,
                "session_id": session_id,
                "device_uuid": "dev-ahmed-1",
            },
            format="json",
        )
        self.assertEqual(ping.status_code, 401)

    def test_revoked_device_cannot_send_gps(self):
        login = self._login(self.officer)
        device_id = login.data["mobile_session"]["device_id"]
        session_id = login.data["mobile_session"]["session_id"]
        self._auth(self.admin)
        self.client.post(f"/api/mobile-devices/{device_id}/revoke/", {}, format="json")
        self._auth(self.officer)
        ping = self.client.post(
            "/api/gps/ping/",
            {
                "latitude": 34.01234,
                "longitude": 71.52491,
                "accuracy": 12,
                "session_id": session_id,
                "device_uuid": "dev-ahmed-1",
            },
            format="json",
        )
        self.assertEqual(ping.status_code, 403)

    def test_field_staff_cannot_view_other_gps(self):
        self._auth(self.officer)
        res = self.client.get(f"/api/gps/history/{self.other.pk}/")
        self.assertEqual(res.status_code, 404)

    def test_admin_can_view_permitted_staff(self):
        self._auth(self.admin)
        live = self.client.get("/api/gps/live/")
        self.assertEqual(live.status_code, 200)
        devices = self.client.get("/api/mobile-devices/")
        self.assertEqual(devices.status_code, 200)

    def test_location_admin_scope(self):
        self._login(self.officer, "dev-ahmed-1")
        kohat = _user("kohat_officer", "INSPECTOR", location="KOHAT")
        self._login(kohat, "dev-kohat-1")
        self._auth(self.kohat_admin)
        res = self.client.get("/api/mobile-devices/")
        usernames = {row["username"] for row in res.data["results"]}
        self.assertIn("kohat_officer", usernames)
        self.assertNotIn("ahmed", usernames)

    def test_heartbeat_updates_last_seen(self):
        login = self._login(self.officer)
        session_id = login.data["mobile_session"]["session_id"]
        self._auth(self.officer)
        res = self.client.post(
            "/api/mobile/heartbeat/",
            {
                "device_uuid": "dev-ahmed-1",
                "session_id": session_id,
                "battery_level": 72,
                "gps_status": "active",
                "app_state": "foreground",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        device = MobileDevice.objects.get(device_uuid="dev-ahmed-1")
        self.assertIsNotNone(device.last_seen_at)
        self.assertEqual(device.battery_level, 72)

    def test_gps_updates_last_gps(self):
        login = self._login(self.officer)
        session_id = login.data["mobile_session"]["session_id"]
        self._auth(self.officer)
        res = self.client.post(
            "/api/mobile/gps/",
            {
                "latitude": 34.01234,
                "longitude": 71.52491,
                "accuracy": 10,
                "session_id": session_id,
                "device_uuid": "dev-ahmed-1",
                "event_id": "gps-1",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        device = MobileDevice.objects.get(device_uuid="dev-ahmed-1")
        self.assertIsNotNone(device.last_gps_at)
        self.assertAlmostEqual(device.last_latitude, 34.01234)

    def test_stale_and_offline_alerts_deduped(self):
        login = self._login(self.officer)
        device = MobileDevice.objects.get(device_uuid="dev-ahmed-1")
        past = timezone.now() - timedelta(seconds=400)
        device.last_heartbeat_at = past
        device.last_seen_at = past
        device.save()
        session = MobileAccessSession.objects.get(session_id=login.data["mobile_session"]["session_id"])
        session.last_heartbeat_at = past
        session.save()
        monitor_mobile_devices()
        monitor_mobile_devices()
        self.assertEqual(
            MobileAlert.objects.filter(user=self.officer, alert_type="DEVICE_OFFLINE", is_active=True).count(),
            1,
        )
        device.refresh_from_db()
        self.assertEqual(device.status, "OFFLINE")

    def test_reconnect_resolves_outage(self):
        self.test_stale_and_offline_alerts_deduped()
        session = MobileAccessSession.objects.filter(user=self.officer).order_by("-started_at").first()
        self._auth(self.officer)
        self.client.post(
            "/api/mobile/heartbeat/",
            {"device_uuid": "dev-ahmed-1", "session_id": session.session_id, "gps_status": "active"},
            format="json",
        )
        self.assertFalse(
            MobileAlert.objects.filter(user=self.officer, alert_type="DEVICE_OFFLINE", is_active=True).exists()
        )
        self.assertTrue(
            MobileAlert.objects.filter(user=self.officer, alert_type="DEVICE_RECONNECTED").exists()
        )

    def test_gps_permission_denied_event(self):
        login = self._login(self.officer)
        self._auth(self.officer)
        res = self.client.post(
            "/api/mobile-events/",
            {
                "event": "GPS_PERMISSION_DENIED",
                "device_uuid": "dev-ahmed-1",
                "session_id": login.data["mobile_session"]["session_id"],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(
            MobileAlert.objects.filter(user=self.officer, alert_type="GPS_PERMISSION_DENIED", is_active=True).exists()
        )

    @override_settings(CIIS_MULTI_DEVICE_POLICY="ALLOW_WITH_ALERT")
    def test_multiple_device_login_creates_alert(self):
        self._login(self.officer, "dev-ahmed-1")
        res = self._login(self.officer, "dev-ahmed-2")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(
            MobileAlert.objects.filter(user=self.officer, alert_type="MULTIPLE_DEVICE_LOGIN", is_active=True).exists()
        )
        self.assertTrue(MobileAlert.objects.filter(user=self.officer, alert_type="NEW_DEVICE").exists())

    @override_settings(CIIS_MULTI_DEVICE_POLICY="BLOCK", CIIS_MAX_ACTIVE_MOBILE_DEVICES=1)
    def test_multiple_device_login_can_block(self):
        self._login(self.officer, "dev-ahmed-1")
        res = self._login(self.officer, "dev-blocked")
        self.assertEqual(res.status_code, 400)

    def test_duplicate_event_id_ignored(self):
        login = self._login(self.officer)
        session_id = login.data["mobile_session"]["session_id"]
        self._auth(self.officer)
        payload = {
            "latitude": 34.01234,
            "longitude": 71.52491,
            "accuracy": 10,
            "session_id": session_id,
            "device_uuid": "dev-ahmed-1",
            "event_id": "same-event",
        }
        first = self.client.post("/api/mobile/gps/", payload, format="json")
        second = self.client.post("/api/mobile/gps/", payload, format="json")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data.get("duplicate"))
        self.assertEqual(OfficerGpsHistory.objects.filter(user=self.officer).count(), 1)
        self.assertEqual(MobileEventReceipt.objects.filter(event_id="same-event").count(), 1)

    def test_admin_revoke_terminates_session(self):
        login = self._login(self.officer)
        session_id = login.data["mobile_session"]["session_id"]
        self._auth(self.admin)
        res = self.client.post("/api/mobile-sessions/revoke/", {"session_id": session_id}, format="json")
        self.assertEqual(res.status_code, 200)
        session = MobileAccessSession.objects.get(session_id=session_id)
        self.assertEqual(session.status, "REVOKED")

    def test_staff_list_installed_and_logged_in(self):
        self._login(self.officer)
        self._auth(self.admin)
        res = self.client.get("/api/staff/")
        self.assertEqual(res.status_code, 200)
        rows = res.data["results"] if isinstance(res.data, dict) else res.data
        ahmed = next(r for r in rows if r.get("full_name") == "Ahmed Khan")
        self.assertTrue(ahmed["mobile_app_installed"])
        self.assertTrue(ahmed["mobile_logged_in"])

    def test_future_roles_use_capabilities_map(self):
        caps = user_capabilities(self.admin)
        self.assertIn("can_view_mobile_devices", caps)
        self.assertIn("can_manage_roles", caps)
        self.assertTrue(caps["can_acknowledge_alerts"])
        inspector_caps = user_capabilities(self.officer)
        self.assertFalse(inspector_caps["can_manage_mobile_devices"])

    def test_extended_offline_alert(self):
        self._login(self.officer)
        device = MobileDevice.objects.get(device_uuid="dev-ahmed-1")
        past = timezone.now() - timedelta(seconds=700)
        device.last_heartbeat_at = past
        device.last_seen_at = past
        device.save()
        monitor_mobile_devices()
        self.assertTrue(
            MobileAlert.objects.filter(user=self.officer, alert_type="DEVICE_OFFLINE_EXTENDED", is_active=True).exists()
        )
