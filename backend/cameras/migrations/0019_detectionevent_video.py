from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cameras", "0018_camera_health_and_roi"),
    ]

    operations = [
        migrations.AddField(
            model_name="detectionevent",
            name="video",
            field=models.FileField(
                blank=True,
                help_text="Optional alert video clip attached to this detection event.",
                null=True,
                upload_to="detection_videos/%Y/%m/%d/",
            ),
        ),
    ]
