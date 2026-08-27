from django.db import migrations, models


def _column_names(connection, table_name):
    with connection.cursor() as cursor:
        return {
            col.name
            for col in connection.introspection.get_table_description(cursor, table_name)
        }


def ensure_purposes_column(apps, schema_editor):
    connection = schema_editor.connection
    if "purposes" in _column_names(connection, "cameras_camera"):
        return
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


def copy_purpose_to_purposes(apps, schema_editor):
    ensure_purposes_column(apps, schema_editor)
    Camera = apps.get_model("cameras", "Camera")
    for cam in Camera.objects.all().iterator():
        purpose = (cam.purpose or "surveillance").strip().lower() or "surveillance"
        cam.purposes = [purpose]
        cam.save(update_fields=["purposes"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("cameras", "0012_camera_passage_role"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="camera",
                    name="purposes",
                    field=models.JSONField(
                        blank=True,
                        default=list,
                        help_text="AI purposes enabled on this camera (multiple models allowed).",
                    ),
                ),
            ],
            database_operations=[
                migrations.RunPython(ensure_purposes_column, migrations.RunPython.noop),
            ],
        ),
        migrations.AlterField(
            model_name="camera",
            name="purpose",
            field=models.CharField(
                choices=[
                    ("surveillance", "General Surveillance"),
                    ("object_detection", "Object Detection (YOLO)"),
                    ("face_recognition", "Face Recognition"),
                    ("attendance", "Attendance Check-in"),
                    ("anpr", "ANPR / Vehicle"),
                    ("zone_monitoring", "Zone Access Monitoring"),
                    ("thermal", "Thermal Anomaly"),
                ],
                default="surveillance",
                help_text="Primary AI purpose (first entry of purposes).",
                max_length=32,
            ),
        ),
        migrations.RunPython(copy_purpose_to_purposes, noop_reverse),
    ]
