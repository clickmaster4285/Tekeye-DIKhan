from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("logs", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="useractivitylog",
            name="source",
            field=models.CharField(db_index=True, default="web", max_length=20),
        ),
    ]
