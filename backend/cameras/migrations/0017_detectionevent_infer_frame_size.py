from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cameras", "0016_camera_ml_server"),
    ]

    operations = [
        migrations.AddField(
            model_name="detectionevent",
            name="infer_frame_height",
            field=models.PositiveIntegerField(
                blank=True,
                help_text="Frame height the bbox was measured in (ML infer / scaled RTSP).",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="detectionevent",
            name="infer_frame_width",
            field=models.PositiveIntegerField(
                blank=True,
                help_text="Frame width the bbox was measured in (ML infer / scaled RTSP).",
                null=True,
            ),
        ),
    ]
