"""Synthetic metadata regressions. No real catalog identity inventory in Git."""
import copy
from datetime import datetime, timezone
import unittest
from uuid import uuid4

from verify import DATASET, HEAD, RELEASE, IdentityMismatch, candidate_binding, negative_tests, set_comparison, sha, validate_snapshot


def fixture():
    rows, hashes, concepts = [], {}, {}
    for index in range(353):
        fdc = str(9000001 + index)
        hashes[fdc] = sha("SYNTHETIC RAW " + fdc)
        concepts[fdc] = "foundation:ndb:" + str(8000001 + index)
        rows.append(dict(fdc_id=fdc, food_id=str(uuid4()), source_record_id=str(uuid4()), source_version_id=str(uuid4()),
                         source_release_id=RELEASE, raw_content_sha256=hashes[fdc], dataset_id=DATASET, dataset_code="usda_fdc_foundation",
                         concept_key=concepts[fdc], upstream_version_key="fdc:" + fdc, dataset_projection_head_id=HEAD["id"],
                         dataset_head_version=1, food_head_version=1, lifecycle_state="active", lifecycle_status="active", source_status="active",
                         public_food_source_key=concepts[fdc], ownerless_public_active_usda=True,
                         immutable_original_projection_matches=True, approved_primary_link_count=1))
    return dict(observed_at=datetime.now(timezone.utc).isoformat(), transaction_read_only="on", statement_timeout="5s", lock_timeout="1s",
                current_head=copy.deepcopy(HEAD), row_count=353, rows=rows), hashes, set(hashes), concepts


class IdentityTests(unittest.TestCase):
    def test_all_mandatory_identity_negatives_without_changing_nutrient_counts(self):
        result = negative_tests(*fixture())
        self.assertEqual(len(result), 13)
        self.assertTrue(all(row["refused"] and row["nutrient_counts_unchanged"] for row in result))

    def test_exact_353_positive_and_order_independence(self):
        snapshot, hashes, ids, concepts = fixture()
        expected = validate_snapshot(snapshot, hashes, ids, concepts)
        snapshot["rows"].reverse()
        self.assertEqual(validate_snapshot(snapshot, hashes, ids, concepts), expected)

    def test_both_directions_and_values(self):
        snapshot, hashes, ids, concepts = fixture()
        frozen = copy.deepcopy(snapshot["rows"])
        altered = copy.deepcopy(frozen)
        altered[0]["food_id"] = str(uuid4())
        self.assertEqual(set_comparison(frozen, altered), dict(missing=0, additional=0, changed=1))
        self.assertEqual(set_comparison(frozen, frozen[1:]), dict(missing=1, additional=0, changed=0))
        self.assertEqual(set_comparison(frozen[1:], frozen), dict(missing=0, additional=1, changed=0))
        with self.assertRaises(IdentityMismatch):
            set_comparison(frozen, frozen + frozen[:1])
        snapshot["rows"] = altered
        with self.assertRaisesRegex(IdentityMismatch, "frozen_identity_relationship_mismatch"):
            validate_snapshot(snapshot, hashes, ids, concepts, frozen)

    def test_no_synthetic_success_from_counts_alone(self):
        snapshot, hashes, ids, concepts = fixture()
        digest = validate_snapshot(snapshot, hashes, ids, concepts)
        snapshot["rows"][0]["source_version_id"] = str(uuid4())
        self.assertNotEqual(validate_snapshot(snapshot, hashes, ids, concepts), digest)

    def test_read_only_timeouts_and_scope_are_required(self):
        for field, value in [("transaction_read_only", "off"), ("statement_timeout", "0"), ("lock_timeout", "0")]:
            snapshot, hashes, ids, concepts = fixture()
            snapshot[field] = value
            with self.assertRaises(IdentityMismatch):
                validate_snapshot(snapshot, hashes, ids, concepts)

    def test_candidate_identity_and_release_are_external_context(self):
        snapshot, _, _, _ = fixture()
        row = snapshot["rows"][0]
        candidate = dict(fdc_id=row["fdc_id"], record_identity={key: row[key] for key in ("fdc_id", "source_record_id", "source_version_id", "raw_content_sha256")}, source_identity=dict(source_release_id=RELEASE))
        candidate_binding(candidate, snapshot["rows"])
        candidate["source_identity"]["source_release_id"] = str(uuid4())
        with self.assertRaisesRegex(IdentityMismatch, "candidate_release_mismatch"):
            candidate_binding(candidate, snapshot["rows"])


if __name__ == "__main__":
    unittest.main()
