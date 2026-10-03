from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ops_central", "0005_ml_server_capacity"),
    ]

    operations = [
        migrations.AlterField(
            model_name="remoteserver",
            name="gpu",
            field=models.CharField(
                blank=True,
                default="",
                help_text="GPU display label e.g. GPU 0 · RTX A6000 (auto-filled from ML /health).",
                max_length=128,
            ),
        ),
        migrations.AddField(
            model_name="remoteserver",
            name="gpu_device",
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text="CUDA device index assigned for this ML node (0, 1, …).",
                null=True,
            ),
        ),
    ]
