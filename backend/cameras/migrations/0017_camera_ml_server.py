from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("ops_central", "0005_ml_server_capacity"),
        ("cameras", "0016_alter_camera_resolution"),
    ]

    operations = [
        migrations.AddField(
            model_name="camera",
            name="ml_server",
            field=models.ForeignKey(
                blank=True,
                help_text="ML node that should run this camera (set by IT Super Admin).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assigned_cameras",
                to="ops_central.remoteserver",
            ),
        ),
    ]
