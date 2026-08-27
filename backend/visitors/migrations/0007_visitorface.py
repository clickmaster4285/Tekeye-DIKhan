from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("visitors", "0006_alter_visitor_access_zone"),
    ]

    operations = [
        migrations.CreateModel(
            name="VisitorFace",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(blank=True, upload_to="visitor_faces/%Y/%m/%d/")),
                ("embedding", models.JSONField(blank=True, default=list)),
                ("quality_score", models.FloatField(default=0.0)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "visitor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="faces",
                        to="visitors.visitor",
                    ),
                ),
            ],
            options={
                "ordering": ["created_at", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="visitorface",
            index=models.Index(fields=["visitor", "is_active"], name="visitors_vi_visitor_7a8c1e_idx"),
        ),
    ]
