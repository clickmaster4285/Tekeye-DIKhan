import logging
import os
from django.apps import AppConfig
from django.db import OperationalError, IntegrityError
from django.db.models.signals import post_migrate

logger = logging.getLogger(__name__)


def create_initial_admin(sender, **kwargs):
    """Create a default superuser if no superuser exists (runs after migrate)."""
    from .models import User

    try:
        if User.objects.filter(is_superuser=True).exists():
            return

        password = os.getenv("INITIAL_ADMIN_PASSWORD", "").strip()
        if not password:
            logger.warning(
                "No superuser exists and INITIAL_ADMIN_PASSWORD is unset — skipping auto-create. "
                "Set INITIAL_ADMIN_PASSWORD in backend/.env then re-run migrate, or use createsuperuser."
            )
            return

        username = os.getenv("INITIAL_ADMIN_USERNAME", "admin")
        email = os.getenv("INITIAL_ADMIN_EMAIL", "admin@example.com")
        phone = os.getenv("INITIAL_ADMIN_PHONE", "0000000000")

        User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
            role="ADMIN",
            phone=phone,
            location=os.getenv("INITIAL_ADMIN_LOCATION", ""),
        )
        logger.info("Created initial superuser %s", username)
    except (OperationalError, IntegrityError):
        pass


class UsersConfig(AppConfig):
    name = "users"

    def ready(self):
        post_migrate.connect(create_initial_admin, sender=self)
        from . import signals  # noqa: F401
