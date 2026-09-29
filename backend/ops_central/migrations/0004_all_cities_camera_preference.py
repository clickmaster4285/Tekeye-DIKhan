from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("ops_central", "0003_camera_cache"),
    ]

    operations = [
        migrations.CreateModel(
            name="AllCitiesCameraPreference",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("selected_camera_keys", models.JSONField(blank=True, default=list)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="all_cities_camera_preference", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "ops_central_all_cities_camera_preference"},
        ),
    ]
