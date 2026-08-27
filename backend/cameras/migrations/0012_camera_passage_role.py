from django.db import migrations, models


def ensure_passage_role_column(apps, schema_editor):
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'cameras_camera'
              AND column_name = 'passage_role'
            """
        )
        if cursor.fetchone() is None:
            cursor.execute(
                "ALTER TABLE cameras_camera ADD COLUMN passage_role VARCHAR(32) NOT NULL DEFAULT ''"
            )
        else:
            cursor.execute("ALTER TABLE cameras_camera ALTER COLUMN passage_role SET DEFAULT ''")
            cursor.execute("UPDATE cameras_camera SET passage_role = '' WHERE passage_role IS NULL")
            cursor.execute("ALTER TABLE cameras_camera ALTER COLUMN passage_role SET NOT NULL")


class Migration(migrations.Migration):
    dependencies = [
        ("cameras", "0011_alter_detectionevent_clip_and_more"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunPython(ensure_passage_role_column, migrations.RunPython.noop)],
            state_operations=[
                migrations.AddField(
                    model_name="camera",
                    name="passage_role",
                    field=models.CharField(
                        blank=True,
                        default="",
                        help_text="Optional passage role for camera routing and grouping.",
                        max_length=32,
                    ),
                )
            ],
        )
    ]
