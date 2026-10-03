# Generated manually — separate tracklet IDs from global person IDs

from django.db import migrations, models


def migrate_person_and_tracklet_ids(apps, schema_editor):
    """
    1. Rewrite legacy P/V/U codes → PJ-##### (global person id).
    2. Backfill CameraTrack.tracklet_id as C##-T#####.
    3. Sync DetectionEvent.person_qr when linked.
    """
    JourneyPerson = apps.get_model("person_journey", "JourneyPerson")
    CameraTrack = apps.get_model("person_journey", "CameraTrack")

    # Map old → new codes using stable pk order so collisions are impossible.
    people = list(JourneyPerson.objects.order_by("pk"))
    used = set()
    for person in people:
        new_code = f"PJ-{person.pk:05d}"
        # Extremely unlikely, but skip if somehow taken by another row we already wrote.
        if new_code in used:
            new_code = f"PJ-{person.pk:05d}X"
        used.add(new_code)
        old = person.code
        if old == new_code:
            continue
        # Two-phase rename if target already exists as someone else's legacy code.
        if JourneyPerson.objects.filter(code=new_code).exclude(pk=person.pk).exists():
            person.code = f"__tmp_{person.pk}"
            person.save(update_fields=["code"])
        person.code = new_code
        person.save(update_fields=["code"])
        if isinstance(person.display_name, str) and old and old in person.display_name:
            person.display_name = person.display_name.replace(old, new_code)
            person.save(update_fields=["display_name"])
        try:
            from cameras.models import DetectionEvent

            DetectionEvent.objects.filter(person_identity_id=person.pk).update(person_qr=new_code)
        except Exception:
            pass

    for track in CameraTrack.objects.all().iterator():
        cam = track.camera_id
        tid = track.track_id
        if cam is None or tid is None:
            continue
        cam_width = 2 if cam < 100 else len(str(cam))
        label = f"C{cam:0{cam_width}d}-T{tid}"
        if track.tracklet_id != label:
            track.tracklet_id = label
            track.save(update_fields=["tracklet_id"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("person_journey", "0002_rename_person_journey_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="cameratrack",
            name="tracklet_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Stable tracklet label, e.g. C01-T18492.",
                max_length=64,
            ),
        ),
        migrations.AlterField(
            model_name="cameratrack",
            name="track_id",
            field=models.PositiveIntegerField(
                help_text="Local ByteTrack id on this camera only — not a global person id.",
            ),
        ),
        migrations.AlterField(
            model_name="journeyperson",
            name="code",
            field=models.CharField(
                db_index=True,
                help_text="Global person ID, e.g. PJ-00042. Not a camera track id.",
                max_length=32,
                unique=True,
            ),
        ),
        migrations.AddIndex(
            model_name="cameratrack",
            index=models.Index(fields=["tracklet_id", "status"], name="person_jour_trackle_idx"),
        ),
        migrations.RunPython(migrate_person_and_tracklet_ids, noop_reverse),
    ]
