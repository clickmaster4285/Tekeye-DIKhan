"""
Global person re-identification: which JourneyPerson (PJ-#####) is this new camera track?

Rules, in order:
  1. Hard exclusions — a person who is live on the SAME camera under another local track right now is a
     different person (two boxes in one frame are two people); impossible camera hops are excluded.
  2. Face (stable over days): match against each person's face gallery.
  3. Appearance / ReID (clothing, same day): match the track-averaged OSNet embedding against each person's
     recent ReID gallery. The bar is calibrated for OSNet (different people score 0.55–0.70), stricter after
     a long gap, and the best candidate must clearly beat the runner-up — an ambiguous track gets a new ID
     instead of being merged into someone else's journey.

Similarities use the mean of the top-k gallery hits (not the single best), so one lucky frame cannot merge
two people.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta

import numpy as np
from django.conf import settings
from django.db.models import F, Window
from django.db.models.functions import RowNumber
from django.utils import timezone

from .models import CameraTrack, JourneyPerson, PersonObservation, PersonStatus, TrackStatus

GALLERY_PER_PERSON = 12
TOP_K = 3
MAX_CANDIDATES = 400


def _cfg(key: str, default: float) -> float:
    try:
        return float(getattr(settings, key, default))
    except (TypeError, ValueError):
        return default


@dataclass
class IdentityDecision:
    person: JourneyPerson | None
    decision: str  # match | uncertain | no_match
    reason: str = ""
    face_score: float = 0.0
    reid_score: float = 0.0
    runner_up: float = 0.0
    topology_score: float = 0.0
    candidates: int = 0
    excluded_live: int = 0
    detail: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            "decision": self.decision,
            "reason": self.reason,
            "face_score": round(self.face_score, 4),
            "reid_score": round(self.reid_score, 4),
            "runner_up": round(self.runner_up, 4),
            "topology_score": round(self.topology_score, 4),
            "combined": round(max(self.face_score, self.reid_score), 4),
            "candidates": self.candidates,
            "excluded_live": self.excluded_live,
            **self.detail,
        }


def _unit(vec) -> np.ndarray | None:
    if not vec:
        return None
    arr = np.asarray(vec, dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(arr))
    return arr / norm if norm > 0 else None


def _gallery_scores(probe: np.ndarray, person_ids: list[int], kind: str, since=None) -> dict[int, float]:
    """Mean of the top-k cosine similarities between probe and each person's most recent observations."""
    if not person_ids:
        return {}
    qs = PersonObservation.objects.filter(journey_person_id__in=person_ids, kind=kind).exclude(embedding=[])
    if since is not None:
        qs = qs.filter(captured_at__gte=since)
    rows = (
        qs.annotate(
            rn=Window(RowNumber(), partition_by=[F("journey_person_id")], order_by=F("captured_at").desc())
        )
        .filter(rn__lte=GALLERY_PER_PERSON)
        .values_list("journey_person_id", "embedding")
    )
    owners: list[int] = []
    vecs: list[list[float]] = []
    dim = probe.shape[0]
    for pid, emb in rows:
        if isinstance(emb, list) and len(emb) == dim:
            owners.append(pid)
            vecs.append(emb)
    if not vecs:
        return {}
    mat = np.asarray(vecs, dtype=np.float32)
    mat /= np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9
    sims = mat @ probe
    per_person: dict[int, list[float]] = {}
    for pid, sim in zip(owners, sims.tolist()):
        per_person.setdefault(pid, []).append(sim)
    return {pid: float(np.mean(sorted(v, reverse=True)[:TOP_K])) for pid, v in per_person.items()}


def live_elsewhere_on_camera(camera_id: int | None, track_id: int | None, now) -> set[int]:
    """Persons with a DIFFERENT local track live on this camera right now — they can't be this track."""
    if camera_id is None:
        return set()
    window = now - timedelta(seconds=_cfg("JOURNEY_SIMULTANEOUS_SECONDS", 4))
    qs = CameraTrack.objects.filter(camera_id=camera_id, status=TrackStatus.ACTIVE, last_seen_at__gte=window)
    if track_id is not None:
        qs = qs.exclude(track_id=track_id)
    return set(qs.values_list("journey_person_id", flat=True))


def identify(
    *,
    face_embedding: list[float] | None,
    reid_embedding: list[float] | None,
    camera_id: int | None,
    track_id: int | None = None,
    person_type: str | None = None,
    exclude_person_ids: set[int] | None = None,
    now=None,
) -> IdentityDecision:
    from .association import topology_travel_score

    now = now or timezone.now()
    face = _unit(face_embedding)
    reid = _unit(reid_embedding)
    if face is None and reid is None:
        return IdentityDecision(None, "no_match", "no embeddings")

    recent_sec = _cfg("JOURNEY_RECENT_WINDOW_SECONDS", 900)
    reid_memory = timedelta(hours=_cfg("JOURNEY_REID_MEMORY_HOURS", 12))
    face_memory = timedelta(days=_cfg("JOURNEY_FACE_MEMORY_DAYS", 30))
    horizon = now - (max(reid_memory, face_memory) if face is not None else reid_memory)

    qs = JourneyPerson.objects.filter(status=PersonStatus.ACTIVE, latest_seen_at__gte=horizon)
    if person_type:
        qs = qs.filter(person_type=person_type)
    candidates = {
        p.pk: p for p in qs.order_by("-latest_seen_at").only(
            "id", "code", "person_type", "latest_seen_at", "latest_camera_id", "status"
        )[:MAX_CANDIDATES]
    }
    excluded = live_elsewhere_on_camera(camera_id, track_id, now) | set(exclude_person_ids or ())
    live_excluded = len(excluded & set(candidates))
    for pid in excluded:
        candidates.pop(pid, None)

    # Physically impossible hops (camera topology) are out, whatever they look like.
    topo: dict[int, float] = {}
    for pid, person in list(candidates.items()):
        gap = max(0.0, (now - person.latest_seen_at).total_seconds()) if person.latest_seen_at else 0.0
        score, impossible = topology_travel_score(person.latest_camera_id, camera_id, gap)
        if impossible and gap <= recent_sec:
            candidates.pop(pid)
        else:
            topo[pid] = score
    if not candidates:
        return IdentityDecision(None, "no_match", "no eligible candidates", excluded_live=live_excluded)
    ids = list(candidates)

    # 1) Face — reliable across days and clothing changes.
    if face is not None:
        face_scores = _gallery_scores(face, ids, "face", since=now - face_memory)
        ranked = sorted(face_scores.items(), key=lambda kv: kv[1], reverse=True)
        if ranked and ranked[0][1] >= _cfg("JOURNEY_FACE_MATCH_THRESHOLD", 0.72):
            pid, best = ranked[0]
            second = ranked[1][1] if len(ranked) > 1 else 0.0
            return IdentityDecision(
                candidates[pid], "match", "face", face_score=best, runner_up=second,
                topology_score=topo.get(pid, 0.0), candidates=len(ids), excluded_live=live_excluded,
            )

    # 2) ReID — same-day clothing appearance, only against recent observations.
    if reid is None:
        return IdentityDecision(None, "no_match", "no face match; no ReID", candidates=len(ids), excluded_live=live_excluded)
    reid_scores = _gallery_scores(reid, ids, "reid", since=now - reid_memory)
    ranked = sorted(reid_scores.items(), key=lambda kv: kv[1], reverse=True)
    if not ranked:
        return IdentityDecision(None, "no_match", "no ReID gallery", candidates=len(ids), excluded_live=live_excluded)
    pid, best = ranked[0]
    second = ranked[1][1] if len(ranked) > 1 else 0.0
    person = candidates[pid]
    gap = (now - person.latest_seen_at).total_seconds() if person.latest_seen_at else float("inf")
    bar = _cfg("JOURNEY_REID_MATCH_THRESHOLD", 0.80) if gap <= recent_sec else _cfg("JOURNEY_REID_LONG_GAP_THRESHOLD", 0.85)
    common = dict(reid_score=best, runner_up=second, topology_score=topo.get(pid, 0.0), candidates=len(ids),
                  excluded_live=live_excluded, detail={"threshold": bar, "gap_seconds": round(gap, 1)})
    if best < bar:
        decision = "uncertain" if best >= bar - 0.05 else "no_match"
        return IdentityDecision(None, decision, f"best ReID {best:.3f} below {bar:.2f}", **common)
    margin = _cfg("JOURNEY_REID_MARGIN", 0.04)
    if best - second < margin:
        # Close runner-ups that were NEVER on camera together with the best match are the same person split
        # into several IDs earlier: take the best one and fold the duplicates into it. (Creating yet another
        # ID here is what made the IDs multiply — every split made the next match "ambiguous" again.)
        close = [(cid, score) for cid, score in ranked[1:] if best - score < margin]
        if not any(persons_were_simultaneous(pid, cid) for cid, _ in close):
            common["detail"]["merge_duplicates"] = [cid for cid, score in close if score >= bar]
            return IdentityDecision(person, "match", "reid (merged duplicates)", **common)
        return IdentityDecision(
            None, "uncertain", f"ambiguous: {candidates[ranked[1][0]].code} scores {second:.3f} vs {best:.3f}", **common
        )
    return IdentityDecision(person, "match", "reid", **common)


def consolidate_recent_persons(*, hours: float | None = None, threshold: float | None = None) -> int:
    """
    Heal split identities: merge recent unknown persons whose averaged appearance clearly matches and who
    were never on the same camera at the same time. Greedy, highest similarity first; a merge is refused if
    any member of one group was ever seen together with any member of the other. Returns merges done.
    """
    from collections import defaultdict

    from .models import PersonType
    from .services import merge_journey_person

    hours = hours if hours is not None else _cfg("JOURNEY_REID_MEMORY_HOURS", 12)
    threshold = threshold if threshold is not None else _cfg("JOURNEY_CONSOLIDATE_THRESHOLD", 0.82)
    since = timezone.now() - timedelta(hours=hours)
    persons = {
        p.pk: p
        for p in JourneyPerson.objects.filter(
            status=PersonStatus.ACTIVE, person_type=PersonType.UNKNOWN, latest_seen_at__gte=since
        )
    }
    if len(persons) < 2:
        return 0
    vecs: dict[int, list] = defaultdict(list)
    rows = PersonObservation.objects.filter(journey_person_id__in=list(persons), kind="reid", captured_at__gte=since)
    for pid, emb in rows.exclude(embedding=[]).values_list("journey_person_id", "embedding"):
        vecs[pid].append(emb)
    ids = []
    cents = []
    for pid, embs in vecs.items():
        try:
            X = np.asarray(embs, dtype=np.float32)
        except ValueError:
            continue
        X /= np.linalg.norm(X, axis=1, keepdims=True) + 1e-9
        m = X.mean(axis=0)
        ids.append(pid)
        cents.append(m / (np.linalg.norm(m) + 1e-9))
    if len(ids) < 2:
        return 0
    S = np.asarray(cents) @ np.asarray(cents).T
    spans: dict[int, list] = defaultdict(list)
    for t in CameraTrack.objects.filter(journey_person_id__in=ids).values(
        "journey_person_id", "camera_id", "started_at", "ended_at", "last_seen_at"
    ):
        spans[t["journey_person_id"]].append(
            (t["camera_id"], t["started_at"], t["ended_at"] or t["last_seen_at"] or t["started_at"])
        )

    def together(a: int, b: int) -> bool:
        return spans_conflict(spans[a], spans[b])

    groups = {pid: {pid} for pid in ids}
    root = {pid: pid for pid in ids}
    pairs = sorted(
        ((float(S[i, j]), ids[i], ids[j]) for i in range(len(ids)) for j in range(i + 1, len(ids)) if S[i, j] >= threshold),
        reverse=True,
    )
    for _score, a, b in pairs:
        ra, rb = root[a], root[b]
        if ra == rb:
            continue
        if any(together(x, y) for x in groups[ra] for y in groups[rb]):
            continue
        # Keep the older person (lower code) as the survivor.
        keep, drop = (ra, rb) if (persons[ra].created_at, ra) <= (persons[rb].created_at, rb) else (rb, ra)
        groups[keep] |= groups.pop(drop)
        for member in groups[keep]:
            root[member] = keep
    merges = 0
    for keep, members in groups.items():
        for pid in members - {keep}:
            merge_journey_person(persons[pid], persons[keep], reason=f"consolidated (appearance >= {threshold:.2f})")
            merges += 1
    return merges


def spans_conflict(a_spans: list, b_spans: list) -> bool:
    """
    Could these two sets of (camera_id, start, end) sightings NOT belong to one person?
      - on the same camera at the same time → two people;
      - on different cameras at the same time for longer than JOURNEY_CROSS_CAMERA_OVERLAP_SECONDS → two people
        (one person can stand where two camera views overlap for a moment, not for many minutes).
    """
    cross_limit = _cfg("JOURNEY_CROSS_CAMERA_OVERLAP_SECONDS", 30)
    for ca, sa, ea in a_spans:
        for cb, sb, eb in b_spans:
            overlap = (min(ea, eb) - max(sa, sb)).total_seconds()
            if overlap < 0:
                continue
            if ca == cb:
                return True
            if cross_limit > 0 and overlap > cross_limit:
                return True
    return False


def _person_spans(person_id: int) -> list:
    return [
        (t["camera_id"], t["started_at"], t["ended_at"] or t["last_seen_at"] or t["started_at"])
        for t in CameraTrack.objects.filter(journey_person_id=person_id).values(
            "camera_id", "started_at", "ended_at", "last_seen_at"
        )
    ]


def persons_were_simultaneous(a_id: int, b_id: int) -> bool:
    """True if the two persons were seen at the same time in a way one person can't be (see spans_conflict)."""
    return spans_conflict(_person_spans(a_id), _person_spans(b_id))
