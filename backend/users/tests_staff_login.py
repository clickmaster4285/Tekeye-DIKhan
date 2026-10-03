"""Link an existing Staff row to a new User login (unique ID + password)."""

from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from users.models import Staff, User
from users.staff_login import infer_staff_role, unique_employee_login_id


def _admin():
    return User.objects.create_user(
        username="ciisadmin",
        password="pass12345",
        email="admin@ciis.test",
        phone="03000000000",
        role="ADMIN",
        full_name="CIIS Admin",
        location="",
    )


def _staff(**kwargs):
    defaults = {
        "full_name": "Ahmed Khan",
        "cnic": "17301-1234567-1",
        "designation": "Inspector",
        "department": "Enforcement",
        "emergency_contact": "03001234567",
    }
    defaults.update(kwargs)
    return Staff.objects.create(**defaults)


class StaffLoginLinkTests(TestCase):
    def setUp(self):
        self.admin = _admin()
        self.client = APIClient()
        token, _ = Token.objects.get_or_create(user=self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_unique_id_prefers_name(self):
        staff = _staff(personal_number="PN-7788", employee_id="E99", full_name="Umar Farooq")
        self.assertEqual(unique_employee_login_id(staff), "umar.farooq")

    def test_designation_maps_to_role(self):
        staff = _staff(designation="Deputy Collector", role_access_level=None)
        self.assertEqual(infer_staff_role(staff), "DEPUTY_COLLECTOR")

    def test_login_preview_and_create_user(self):
        staff = _staff(
            personal_number="EMP9001",
            role_access_level="INSPECTOR",
            branch_location="PESHAWAR",
        )
        preview = self.client.get(f"/api/staff/{staff.id}/login-preview/")
        self.assertEqual(preview.status_code, 200, preview.content)
        self.assertEqual(preview.data["username"], "ahmed.khan")
        self.assertEqual(preview.data.get("default_password"), "123456")
        self.assertFalse(preview.data["role_required"])
        self.assertFalse(preview.data["location_required"])

        created = self.client.post(
            f"/api/staff/{staff.id}/create_user/",
            {"password": "secret12"},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(created.data["login_id"], "ahmed.khan")
        staff.refresh_from_db()
        self.assertEqual(staff.user.username, "ahmed.khan")
        self.assertEqual(staff.user.role, "INSPECTOR")
        self.assertEqual(staff.user.location, "PESHAWAR")

    def test_create_user_requires_role_when_missing(self):
        staff = _staff(designation="Officer", personal_number="EMP9002")
        res = self.client.post(
            f"/api/staff/{staff.id}/create_user/",
            {"password": "secret12"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Role", res.data.get("error", ""))

        res = self.client.post(
            f"/api/staff/{staff.id}/create_user/",
            {"password": "secret12", "role": "GUARD", "location": "KOHAT"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        staff.refresh_from_db()
        self.assertEqual(staff.user.role, "GUARD")
        self.assertEqual(staff.user.location, "KOHAT")

    def test_create_user_accepts_edited_name_id(self):
        staff = _staff(
            full_name="Umar Farooq",
            role_access_level="PRAL",
            branch_location="PESHAWAR",
        )
        created = self.client.post(
            f"/api/staff/{staff.id}/create_user/",
            {"password": "secret12", "username": "umar.farooq"},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(created.data["login_id"], "umar.farooq")

    def test_unlinked_list_excludes_linked_staff(self):
        linked_user = User.objects.create_user(
            username="already",
            password="pass12345",
            email="already@ciis.test",
            phone="03001111111",
            role="INSPECTOR",
            full_name="Linked",
            location="PESHAWAR",
        )
        _staff(full_name="Linked Officer", cnic="11111-1111111-1", user=linked_user)
        open_staff = _staff(full_name="Open Officer", cnic="22222-2222222-2", personal_number="OPEN1")
        res = self.client.get("/api/staff/?unlinked=1")
        self.assertEqual(res.status_code, 200, res.content)
        rows = res.data if isinstance(res.data, list) else res.data.get("results", [])
        ids = {row["id"] for row in rows}
        self.assertIn(open_staff.id, ids)
        self.assertEqual(len(ids), 1)
