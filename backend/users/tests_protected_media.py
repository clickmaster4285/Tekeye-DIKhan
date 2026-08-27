import os
import tempfile

from django.test import TestCase
from rest_framework.authtoken.models import Token

from config.media_views import MEDIA_AUTH_COOKIE
from users.models import User


class ProtectedMediaTests(TestCase):
    def setUp(self):
        self._tmpdir = tempfile.mkdtemp(prefix="tekeye_media_")
        self.user = User.objects.create_user(
            username="mediauser",
            password="pass12345",
            email="media@example.com",
            role="ADMIN",
            phone="03000000000",
        )
        self.token = Token.objects.create(user=self.user)
        os.makedirs(os.path.join(self._tmpdir, "detection_clips", "2026", "08", "27"), exist_ok=True)
        self.rel = os.path.join("detection_clips", "2026", "08", "27", "event_106788.jpg")
        with open(os.path.join(self._tmpdir, self.rel), "wb") as fh:
            fh.write(b"\xff\xd8\xff\xd9")

    def test_anonymous_is_rejected(self):
        with self.settings(MEDIA_ROOT=self._tmpdir):
            res = self.client.get("/media/" + self.rel.replace("\\", "/"))
        self.assertEqual(res.status_code, 401)

    def test_token_header_can_read(self):
        with self.settings(MEDIA_ROOT=self._tmpdir):
            res = self.client.get(
                "/media/" + self.rel.replace("\\", "/"),
                HTTP_AUTHORIZATION=f"Token {self.token.key}",
            )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.content, b"\xff\xd8\xff\xd9")

    def test_cookie_can_read(self):
        self.client.cookies[MEDIA_AUTH_COOKIE] = self.token.key
        with self.settings(MEDIA_ROOT=self._tmpdir):
            res = self.client.get("/media/" + self.rel.replace("\\", "/"))
        self.assertEqual(res.status_code, 200)

    def test_path_traversal_is_blocked(self):
        with self.settings(MEDIA_ROOT=self._tmpdir):
            res = self.client.get(
                "/media/../settings.py",
                HTTP_AUTHORIZATION=f"Token {self.token.key}",
            )
        self.assertIn(res.status_code, (404, 400))
