from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("cameras", "0016_alter_camera_resolution"),
        ("ops_central", "0004_all_cities_camera_preference"),
    ]

    operations = [
        migrations.AddField(
            model_name="remoteserver",
            name="gpu",
            field=models.CharField(
                blank=True,
                default="",
                help_text="GPU label e.g. P4000",
                max_length=64,
            ),
        ),
        migrations.AddField(
            model_name="remoteserver",
            name="max_cameras",
            field=models.PositiveIntegerField(
                default=25,
                help_text="Soft capacity limit for distribution UI and auto-balance.",
            ),
        ),
        migrations.AddField(
            model_name="remoteserver",
            name="site",
            field=models.ForeignKey(
                blank=True,
                help_text="Optional site this ML node primarily serves (e.g. D.I. Khan).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="ml_servers",
                to="cameras.site",
            ),
        ),
    ]
