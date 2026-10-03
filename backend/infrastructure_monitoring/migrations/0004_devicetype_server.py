from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("infrastructure_monitoring", "0003_infranvrlog"),
    ]

    operations = [
        migrations.AlterField(
            model_name="infraalertrule",
            name="device_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("camera", "Camera"),
                    ("nvr", "NVR"),
                    ("ups", "UPS"),
                    ("inverter", "Inverter"),
                    ("network", "Network Device"),
                    ("server", "Server"),
                ],
                default="",
                help_text="Empty = all device types",
                max_length=16,
            ),
        ),
        migrations.AlterField(
            model_name="infradevice",
            name="device_type",
            field=models.CharField(
                choices=[
                    ("camera", "Camera"),
                    ("nvr", "NVR"),
                    ("ups", "UPS"),
                    ("inverter", "Inverter"),
                    ("network", "Network Device"),
                    ("server", "Server"),
                ],
                db_index=True,
                max_length=16,
            ),
        ),
        migrations.AlterField(
            model_name="infradevice",
            name="network_role",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Network: switch/router/firewall/ap. Server: app/db/web/file/domain/other.",
                max_length=64,
            ),
        ),
    ]
