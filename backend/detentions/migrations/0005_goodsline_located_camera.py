import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cameras", "0017_detectionevent_infer_frame_size"),
        ("detentions", "0004_drop_char_length_limits"),
    ]

    operations = [
        migrations.AddField(
            model_name="detentionmemogoodsline",
            name="located_camera",
            field=models.ForeignKey(
                blank=True,
                help_text="Camera where this detained item was located/detected.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="detained_goods",
                to="cameras.camera",
            ),
        ),
        migrations.AddField(
            model_name="detentionmemogoodsline",
            name="detected_at",
            field=models.DateTimeField(
                blank=True,
                help_text="When the item was detected or found at the located camera.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="detentionmemogoodsline",
            name="detection_event",
            field=models.ForeignKey(
                blank=True,
                help_text="Optional AI DetectionEvent that sourced this goods line.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="detention_goods_lines",
                to="cameras.detectionevent",
            ),
        ),
    ]
