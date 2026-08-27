from django.db import migrations, models


PURPOSE_ALIASES = {
    "object_detection": "general_objects",
    "surveillance": "general_objects",
    "zone_monitoring": "general_objects",
    "thermal": "smoke_fire",
}


def remap_purposes(apps, schema_editor):
    Camera = apps.get_model("cameras", "Camera")
    allowed = {
        "general_objects",
        "custom_objects",
        "smoke_fire",
        "weapon",
        "face_recognition",
        "attendance",
        "anpr",
    }
    for cam in Camera.objects.all().iterator():
        raw = cam.purposes if isinstance(cam.purposes, list) else []
        if not raw and cam.purpose:
            raw = [cam.purpose]
        out = []
        for item in raw:
            code = PURPOSE_ALIASES.get(str(item or "").strip().lower(), str(item or "").strip().lower())
            if code in allowed and code not in out:
                out.append(code)
        if not out:
            out = ["general_objects"]
        cam.purposes = out
        cam.purpose = out[0]
        cam.save(update_fields=["purposes", "purpose"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("cameras", "0013_camera_purposes"),
    ]

    operations = [
        migrations.AlterField(
            model_name="camera",
            name="purpose",
            field=models.CharField(
                choices=[
                    ("general_objects", "General Objects (YOLO)"),
                    ("custom_objects", "Custom Objects"),
                    ("smoke_fire", "Fire & Smoke"),
                    ("weapon", "Weapon Detection"),
                    ("face_recognition", "Face Recognition"),
                    ("attendance", "Attendance Check-in"),
                    ("anpr", "ANPR / License Plates"),
                    ("object_detection", "General Objects (YOLO)"),
                    ("surveillance", "General Objects (YOLO)"),
                    ("zone_monitoring", "General Objects (YOLO)"),
                    ("thermal", "Fire & Smoke"),
                ],
                default="general_objects",
                help_text="Primary AI purpose (first entry of purposes).",
                max_length=32,
            ),
        ),
        migrations.RunPython(remap_purposes, noop_reverse),
    ]
