from django.test import TestCase

from visitors.face_gallery import (
    cosine_similarity,
    invalidate_gallery_cache,
    normalize_embedding,
    search_visitor_gallery,
)
from visitors.models import Visitor, VisitorFace


def _make_visitor(**kwargs) -> Visitor:
    defaults = {
        "visitor_type": "general",
        "full_name": "Ahmed Khan",
        "nationality": "pakistan",
        "mobile_number": "03001234567",
        "visit_purpose": "meeting",
        "department_to_visit": "admin",
        "access_zone": "lobby",
    }
    defaults.update(kwargs)
    return Visitor.objects.create(**defaults)


class VisitorGallerySearchTests(TestCase):
    def setUp(self):
        invalidate_gallery_cache()

    def tearDown(self):
        invalidate_gallery_cache()

    def test_normalize_unit_length(self):
        vec = normalize_embedding([3.0, 4.0])
        self.assertAlmostEqual(vec[0] ** 2 + vec[1] ** 2, 1.0, places=5)

    def test_search_matches_enrolled_visitor(self):
        visitor = _make_visitor()
        VisitorFace.objects.create(
            visitor=visitor,
            embedding=normalize_embedding([1.0, 0.0, 0.0]),
            quality_score=0.9,
            is_active=True,
        )
        invalidate_gallery_cache()
        hit = search_visitor_gallery([1.0, 0.0, 0.0], threshold=0.5)
        self.assertIsNotNone(hit)
        self.assertEqual(hit["identity_type"], "visitor")
        self.assertEqual(hit["visitor_id"], visitor.pk)
        self.assertGreaterEqual(hit["confidence"], 0.99)

    def test_search_ignores_inactive_and_staff_keys(self):
        visitor = _make_visitor(full_name="Sara Ali")
        VisitorFace.objects.create(
            visitor=visitor,
            embedding=normalize_embedding([0.0, 1.0, 0.0]),
            is_active=False,
        )
        invalidate_gallery_cache()
        hit = search_visitor_gallery([0.0, 1.0, 0.0], threshold=0.5)
        self.assertIsNone(hit)

    def test_orthogonal_vectors_do_not_match(self):
        visitor = _make_visitor()
        VisitorFace.objects.create(
            visitor=visitor,
            embedding=normalize_embedding([1.0, 0.0]),
            is_active=True,
        )
        invalidate_gallery_cache()
        self.assertAlmostEqual(cosine_similarity([1.0, 0.0], [0.0, 1.0]), 0.0, places=5)
        self.assertIsNone(search_visitor_gallery([0.0, 1.0], threshold=0.4))
