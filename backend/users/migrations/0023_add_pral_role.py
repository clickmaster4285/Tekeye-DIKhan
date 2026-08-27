# Add PRAL role choice

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0022_user_allowed_modules"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("ADMIN", "Admin"),
                    ("IT_SUPERADMIN", "IT Super Admin"),
                    ("LOCATION_ADMIN", "Location Administrator"),
                    ("OPERATION_MANAGER", "Operation Manager"),
                    ("INSPECTOR", "Inspector"),
                    ("COLLECTOR", "Collector"),
                    ("DEPUTY_COLLECTOR", "Deputy Collector"),
                    ("ASSISTANT_COLLECTOR", "Assistant Collector"),
                    ("RECEPTIONIST", "Receptionist"),
                    ("GUARD", "Guard"),
                    ("HR", "Human Resource"),
                    ("WAREHOUSE_OFFICER", "Warehouse Officer"),
                    ("WAREHOUSE_SUPERINTENDENT", "Warehouse Superintendent"),
                    ("WAREHOUSE_IN_CHARGE", "Warehouse In-Charge"),
                    ("EXAMINATION_OFFICER", "Examination Officer"),
                    ("STOCK_CONTROLLER", "Stock Controller"),
                    ("IT_ADMIN", "IT Administrator"),
                    ("AUDITOR", "Auditor"),
                    ("PRAL", "PRAL"),
                    ("DETECTION_OFFICER", "Detection Officer"),
                    ("FIR_OFFICER", "FIR Officer"),
                    ("INVESTIGATION_OFFICER", "Investigation Officer"),
                    ("SEIZING_OFFICER", "Seizing Officer"),
                ],
                max_length=30,
            ),
        ),
    ]
