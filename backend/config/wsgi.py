"""
WSGI config for config project.

Socket.IO is mounted on the same HTTP port as Django so browsers can use
same-origin /socket.io for realtime invalidations.
"""
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.wsgi import get_wsgi_application

django_app = get_wsgi_application()

try:
    from realtime.sio_app import wrap_wsgi

    application = wrap_wsgi(django_app)
except Exception:
    # Fallback if realtime deps missing — API still works without sockets.
    application = django_app
