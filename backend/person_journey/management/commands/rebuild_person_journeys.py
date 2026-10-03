"""
Re-run global re-identification over stored tracklets and split wrongly merged unknown persons.

Uses the same rules as live ingest (person_journey/identity.py): calibrated ReID bar, stricter after a long gap,
clear margin over the runner-up, and never one identity for two tracks that were on the same camera at once.

    python manage.py rebuild_person_journeys --hours 24            # dry run: show what would change
    python manage.py rebuild_person_journeys --hours 24 --apply    # rewrite unknown persons' journeys
"""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

import numpy as np
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from person_journey.models import (
    CameraTrack,
    JourneyEvent,
    JourneyPerson,
    PersonObservation,
    PersonStatus,
    PersonTransition,
    PersonType,
)

SAMPLES_PER_TRACK = 8


def _cfg(key: str, default: float) -> float:
    return float(getattr(settings, key, default))


class Cluster:
    def __init__(self, idx: int):
        self.idx = idx
        self.tracks: list[dict] = []
        self.reid: list[np.ndarray] = []
        self.face: list[np.ndarray] = []

    @property
    def last_seen(self):
        return max(t["end"] for t in self.tracks)

    def live_on(self, camera_id, start, end) -> bool:
        return any(t["camera_id"] == camera_id and t["start"] <= end and start <= t["end"] for t in self.tracks)

    @staticmethod
    def score(probe, gallery) -> float:
        if probe is None or not gallery:
            return 0.0
        sims = np.stack(gallery[-12:]) @ probe
        return float(np.mean(np.sort(sims)[::-1][:3]))


def _mean(vecs):
    if not vecs:
        return None
    arr = np.asarray(vecs, dtype=np.float32)
    arr /= np.linalg.norm(arr, axis=1, keepdims=True) + 1e-9
    m = arr.mean(axis=0)
    n = float(np.linalg.norm(m))
    return m / n if n > 0 else None


class Command(BaseCommand):
    help = "Re-identify stored person tracklets and split unknown persons that were merged by mistake."

    def add_arguments(self, parser):
        parser.add_argument("--hours", type=float, default=24.0, help="Rebuild tracklets started in the last N hours.")
        parser.add_argument("--apply", action="store_true", help="Write the result (default is a dry run).")

    def handle(self, *args, **opts):
        now = timezone.now()
        since = now - timedelta(hours=opts["hours"])
        persons = list(
            JourneyPerson.objects.filter(
                person_type=PersonType.UNKNOWN, status=PersonStatus.ACTIVE, tracks__started_at__gte=since
            ).distinct()
        )
        if not persons:
            self.stdout.write("No unknown persons with tracklets in that window.")
            return
        person_ids = [p.pk for p in persons]
        tracks = list(
            CameraTrack.objects.filter(journey_person_id__in=person_ids, started_at__gte=since)
            .order_by("started_at")
            .values("id", "camera_id", "track_id", "journey_person_id", "started_at", "ended_at", "last_seen_at")
        )
        obs = defaultdict(lambda: {"reid": [], "face": []})
        for tid, kind, emb in (
            PersonObservation.objects.filter(tracklet_id__in=[t["id"] for t in tracks])
            .exclude(embedding=[])
            .order_by("captured_at")
            .values_list("tracklet_id", "kind", "embedding")
        ):
            if kind in ("reid", "face") and len(obs[tid][kind]) < SAMPLES_PER_TRACK:
                obs[tid][kind].append(emb)

        reid_bar = _cfg("JOURNEY_REID_MATCH_THRESHOLD", 0.80)
        long_bar = _cfg("JOURNEY_REID_LONG_GAP_THRESHOLD", 0.85)
        margin = _cfg("JOURNEY_REID_MARGIN", 0.04)
        face_bar = _cfg("JOURNEY_FACE_MATCH_THRESHOLD", 0.72)
        recent = _cfg("JOURNEY_RECENT_WINDOW_SECONDS", 900)
        memory = _cfg("JOURNEY_REID_MEMORY_HOURS", 12) * 3600

        clusters: list[Cluster] = []
        assignment: dict[int, Cluster] = {}
        no_embedding: list[dict] = []
        for t in tracks:
            t["start"] = t["started_at"]
            t["end"] = t["ended_at"] or t["last_seen_at"] or t["started_at"]
            reid = _mean(obs[t["id"]]["reid"])
            face = _mean(obs[t["id"]]["face"])
            if reid is None and face is None:
                no_embedding.append(t)
                continue
            eligible = [
                c for c in clusters
                if not c.live_on(t["camera_id"], t["start"], t["end"])
                and (t["start"] - c.last_seen).total_seconds() <= memory
            ]
            chosen = None
            if face is not None:
                ranked = sorted(((Cluster.score(face, c.face), c) for c in eligible), key=lambda x: x[0], reverse=True)
                if ranked and ranked[0][0] >= face_bar:
                    chosen = ranked[0][1]
            if chosen is None and reid is not None:
                ranked = sorted(((Cluster.score(reid, c.reid), c) for c in eligible), key=lambda x: x[0], reverse=True)
                if ranked:
                    best, cand = ranked[0]
                    second = ranked[1][0] if len(ranked) > 1 else 0.0
                    gap = (t["start"] - cand.last_seen).total_seconds()
                    bar = reid_bar if gap <= recent else long_bar
                    if best >= bar and best - second >= margin:
                        chosen = cand
            if chosen is None:
                chosen = Cluster(len(clusters))
                clusters.append(chosen)
            chosen.tracks.append(t)
            if reid is not None:
                chosen.reid.append(reid)
            if face is not None:
                chosen.face.append(face)
            assignment[t["id"]] = chosen

        # Tracks with no embedding stay with whichever cluster already holds their original person's first track.
        self.stdout.write(
            f"{len(tracks)} tracklets of {len(persons)} unknown person(s) since {timezone.localtime(since):%Y-%m-%d %H:%M} "
            f"-> {len(clusters)} distinct people ({len(no_embedding)} tracklets without embeddings left as they are)."
        )
        sizes = sorted((len(c.tracks) for c in clusters), reverse=True)
        self.stdout.write(f"Tracklets per person (largest first): {sizes[:20]}{' ...' if len(sizes) > 20 else ''}")
        if not opts["apply"]:
            self.stdout.write(self.style.WARNING("Dry run - nothing changed. Re-run with --apply to write it."))
            return

        with transaction.atomic():
            original = {p.pk: p for p in persons}
            used_originals: set[int] = set()
            created = 0
            for cluster in clusters:
                first = min(cluster.tracks, key=lambda t: t["start"])
                last = max(cluster.tracks, key=lambda t: t["end"])
                owner = original.get(first["journey_person_id"])
                if owner is not None and owner.pk not in used_originals:
                    person = owner  # the earliest cluster of each old person keeps its PJ code
                    used_originals.add(owner.pk)
                else:
                    from person_journey.services import create_journey_person

                    person = create_journey_person(
                        person_type=PersonType.UNKNOWN,
                        display_name="Unknown",
                        status=PersonStatus.ACTIVE,
                        identity_state="tracking",
                    )
                    person.display_name = f"Unknown — {person.code}"
                    created += 1
                person.latest_seen_at = last["end"]
                person.latest_camera_id = last["camera_id"]
                person.reid_embedding = [float(v) for v in cluster.reid[-1]] if cluster.reid else person.reid_embedding
                person.face_embedding = [float(v) for v in cluster.face[-1]] if cluster.face else person.face_embedding
                person.save()
                track_ids = [t["id"] for t in cluster.tracks]
                CameraTrack.objects.filter(id__in=track_ids).update(journey_person=person)
                PersonObservation.objects.filter(tracklet_id__in=track_ids).update(journey_person=person)
                JourneyEvent.objects.filter(track_id__in=track_ids).update(journey_person=person)
            # Hops between cameras were computed for the wrong identities; drop them (new ones are recorded live).
            PersonTransition.objects.filter(journey_person_id__in=person_ids, entry_time__gte=since).delete()
        self.stdout.write(self.style.SUCCESS(f"Applied: {len(clusters)} people ({created} new PJ codes)."))
