from django.test import SimpleTestCase

from person_journey.identities import (
    format_person_code,
    format_tracklet_id,
    is_global_person_code,
    parse_person_code_seq,
)


class IdentityHelpersTests(SimpleTestCase):
    def test_global_person_code_format(self):
        self.assertEqual(format_person_code(42), "PJ-00042")
        self.assertEqual(format_person_code(1), "PJ-00001")
        self.assertTrue(is_global_person_code("PJ-00042"))
        self.assertFalse(is_global_person_code("P42"))
        self.assertFalse(is_global_person_code("C01-T18492"))

    def test_parse_legacy_and_pj_codes(self):
        self.assertEqual(parse_person_code_seq("PJ-00042"), 42)
        self.assertEqual(parse_person_code_seq("P42"), 42)
        self.assertEqual(parse_person_code_seq("V55"), 55)
        self.assertEqual(parse_person_code_seq("U300"), 300)

    def test_tracklet_id_is_not_person_id(self):
        self.assertEqual(format_tracklet_id(1, 18492), "C01-T18492")
        self.assertEqual(format_tracklet_id(2, 93281), "C02-T93281")
        self.assertEqual(format_tracklet_id(7, 11283), "C07-T11283")
        self.assertNotEqual(format_tracklet_id(1, 42), format_person_code(42))
        self.assertEqual(format_tracklet_id(None, 1), "")
        self.assertEqual(format_tracklet_id(1, None), "")
