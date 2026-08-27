from django.test import TestCase

from .models import Camera, Nvr, Site


class CameraPassageRoleTests(TestCase):
    def test_camera_creation_defaults_passage_role_to_empty_string(self):
        site = Site.objects.create(code="TEST", name="Test Site")
        nvr = Nvr.objects.create(site=site, name="Test NVR", ip_address="127.0.0.1")

        camera = Camera.objects.create(
            nvr=nvr,
            channel=1,
            name="Entry Camera",
            location=site.code,
        )

        self.assertEqual(camera.passage_role, "")
