from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0023_add_pral_role"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="location",
            field=models.CharField(
                blank=True,
                choices=[
                    ("PESHAWAR", "Peshawar (Head Office)"),
                    ("KOHAT", "Kohat"),
                    ("NOWSHERA", "Nowshera"),
                    ("MARDAN", "Mardan"),
                    ("DI_KHAN", "DI Khan"),
                    ("SWH_RATTA_KULACHI", "SWH Ratta Kulachi"),
                ],
                default="",
                max_length=20,
            ),
        ),
    ]
