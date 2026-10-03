from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("recognition", "0001_attendance_insightface_fields"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="faceenrollment",
                    name="embeddings",
                    field=models.JSONField(
                        blank=True,
                        default=list,
                        help_text="ArcFace vectors from the enrollment photos and lighting variants.",
                    ),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE recognition_faceenrollment "
                        "ADD COLUMN IF NOT EXISTS embeddings jsonb NOT NULL DEFAULT '[]'::jsonb;"
                    ),
                    reverse_sql=(
                        "ALTER TABLE recognition_faceenrollment DROP COLUMN IF EXISTS embeddings;"
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="MatchReview",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(max_length=16)),
                ("confidence", models.FloatField(default=0.0)),
                ("source", models.CharField(blank=True, default="", max_length=16)),
                ("camera_id", models.PositiveIntegerField(blank=True, null=True)),
                ("message", models.CharField(blank=True, default="", max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
