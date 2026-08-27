# Repair leaf: add cameras_camera.purposes if a previous migrate skipped it.
# Depends on 0014 — deploy the full cameras/migrations/ folder (0001–0015).
from django.db import migrations


PURPOSE_ALIASES = {
    "object_detection": "general_objects",
    "surveillance": "general_objects",
    "zone_monitoring": "general_objects",
    "thermal": "smoke_fire",
}

ALLOWED_PURPOSES = {
    "general_objects",
    "custom_objects",
    "smoke_fire",
    "weapon",
    "face_recognition",
    "attendance",
    "anpr",
}


def _column_names(connection, table_name):
    with connection.cursor() as cursor:
        return {
            col.name
            for col in connection.introspection.get_table_description(cursor, table_name)
        }


def ensure_camera_purposes(apps, schema_editor):
    """Add cameras_camera.purposes if a previous migrate dropped it or never created it."""
    connection = schema_editor.connection
    table = "cameras_camera"
    if "purposes" not in _column_names(connection, table):
        with connection.cursor() as cursor:
            if connection.vendor == "postgresql":
                cursor.execute(
                    "ALTER TABLE cameras_camera "
                    "ADD COLUMN purposes jsonb NOT NULL DEFAULT '[]'::jsonb"
                )
            else:
                cursor.execute(
                    "ALTER TABLE cameras_camera "
                    "ADD COLUMN purposes text NOT NULL DEFAULT '[]'"
                )

    Camera = apps.get_model("cameras", "Camera")
    for cam in Camera.objects.all().iterator():
        raw = cam.purposes if isinstance(getattr(cam, "purposes", None), list) else []
        if not raw and cam.purpose:
            raw = [cam.purpose]
        out = []
        for item in raw:
            code = PURPOSE_ALIASES.get(
                str(item or "").strip().lower(),
                str(item or "").strip().lower(),
            )
            if code in ALLOWED_PURPOSES and code not in out:
                out.append(code)
        if not out:
            out = ["general_objects"]
        if getattr(cam, "purposes", None) != out or cam.purpose != out[0]:
            cam.purposes = out
            cam.purpose = out[0]
            cam.save(update_fields=["purposes", "purpose"])


class Migration(migrations.Migration):

    dependencies = [
        ("cameras", "0014_camera_model_purposes"),
    ]

    operations = [
        migrations.RunPython(ensure_camera_purposes, migrations.RunPython.noop),
    ]
