from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("infrastructure_monitoring", "0004_devicetype_server"),
    ]

    operations = [
        migrations.CreateModel(
            name="InfraServerLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("log_time", models.DateTimeField(db_index=True)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("error", "Error"),
                            ("access", "Access"),
                            ("system", "System"),
                            ("security", "Security"),
                            ("application", "Application"),
                            ("other", "Other"),
                        ],
                        db_index=True,
                        default="other",
                        max_length=32,
                    ),
                ),
                ("level", models.CharField(blank=True, db_index=True, default="", max_length=32)),
                ("source", models.CharField(blank=True, default="", max_length=200)),
                ("user", models.CharField(blank=True, default="", max_length=128)),
                ("remote_host", models.CharField(blank=True, default="", max_length=64)),
                ("event_id", models.CharField(blank=True, default="", max_length=64)),
                ("message", models.TextField(blank=True, default="")),
                ("raw", models.JSONField(blank=True, default=dict)),
                ("fingerprint", models.CharField(db_index=True, max_length=64)),
                ("fetched_at", models.DateTimeField(auto_now_add=True)),
                (
                    "device",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="server_logs",
                        to="infrastructure_monitoring.infradevice",
                    ),
                ),
            ],
            options={
                "ordering": ["-log_time", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="infraserverlog",
            index=models.Index(fields=["device", "-log_time"], name="infrastruct_device__srvlog_idx"),
        ),
        migrations.AddIndex(
            model_name="infraserverlog",
            index=models.Index(
                fields=["device", "category", "-log_time"],
                name="infrastruct_device__srvcat_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="infraserverlog",
            constraint=models.UniqueConstraint(
                fields=("device", "fingerprint"),
                name="uniq_infra_server_log_fingerprint",
            ),
        ),
    ]
