"""Offline verification of a scoped, read-only public-catalog observation.

No database client, credentials, network, or nutrient-definition implementation.
Detailed inventories and diagnostics must remain in the ignored restricted folder.
"""
import argparse
import copy
from datetime import datetime
import json
import os
from pathlib import Path
import re
import sys
from uuid import UUID, uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "nutrition-usda-full35-local-qual-001"))
from oracle import REJECTS, canonical, fingerprint, load_source, sha  # noqa: E402

CLASSIFICATION = "AUTHORITATIVE_EXISTING_PUBLIC_CATALOG_IDENTITIES"
PROJECT = "hskfanrqwtqknzpquwhg"
DATASET = "0890fd0c-0b19-4360-8088-6b1bd6be6000"
RELEASE = "a2e1699b-6f72-4153-b2f1-5cbf30c53281"
HEAD = dict(id="2562de58-1c1c-4ce4-acca-3dd468cc045c", version=1,
            dataset_id=DATASET, environment="production",
            fingerprint="2195ba23c041f7ec5e6daba178501aa65320c6c85fa65604e9a496bba00c7e69")
TUPLE_FIELDS = ("fdc_id", "food_id", "source_record_id", "source_version_id", "source_release_id", "raw_content_sha256")
AUDIT_HASH = "cb936ff5e4edb42c84ecc724c758f42d6982812215c4be69e374564d3c158c64"


class IdentityMismatch(ValueError):
    """Messages contain categories only, never identity values."""


def require(condition, category):
    if not condition:
        raise IdentityMismatch(category)


def tuple_set(rows):
    return [[row[key] for key in TUPLE_FIELDS] for row in sorted(rows, key=lambda row: int(row["fdc_id"]))]


def set_comparison(expected, actual):
    left = {row["fdc_id"]: row for row in expected}
    right = {row["fdc_id"]: row for row in actual}
    require(len(left) == len(expected) and len(right) == len(actual), "duplicate_fdc_id")
    return dict(missing=len(left.keys() - right.keys()), additional=len(right.keys() - left.keys()),
                changed=sum(left[key] != right[key] for key in left.keys() & right.keys()))


def validate_snapshot(snapshot, hashes, accepted_ids, concepts, frozen=None):
    require(snapshot["transaction_read_only"] == "on", "read_only_required")
    require(snapshot["statement_timeout"] == "5s" and snapshot["lock_timeout"] == "1s", "bounded_timeouts_required")
    require(datetime.fromisoformat(snapshot["observed_at"]).tzinfo is not None, "observation_time_required")
    require(snapshot["current_head"] == HEAD, "unexpected_dataset_head")
    rows = snapshot["rows"]
    require(snapshot["row_count"] == len(rows) == 353, "cardinality_mismatch")
    for key in TUPLE_FIELDS[:4]:
        require(len({row[key] for row in rows}) == 353, "duplicate_" + key)
    require({row["fdc_id"] for row in rows} == set(accepted_ids), "accepted_membership_mismatch")
    for row in rows:
        for key in ("food_id", "source_record_id", "source_version_id"):
            try:
                valid = str(UUID(row[key])) == row[key]
            except (ValueError, TypeError, AttributeError):
                valid = False
            require(valid, "invalid_" + key)
        fdc = row["fdc_id"]
        require(row["upstream_version_key"] == "fdc:" + fdc, "upstream_fdc_mismatch")
        require(row["raw_content_sha256"] == hashes[fdc], "source_raw_hash_mismatch")
        require(row["source_release_id"] == RELEASE, "source_release_mismatch")
        require(row["dataset_id"] == DATASET and row["dataset_code"] == "usda_fdc_foundation", "dataset_mismatch")
        require(row["dataset_projection_head_id"] == HEAD["id"] and row["dataset_head_version"] == row["food_head_version"] == 1, "unexpected_food_head")
        require(row["lifecycle_state"] == row["lifecycle_status"] == row["source_status"] == "active", "inactive_source")
        require(row["ownerless_public_active_usda"] is True, "public_scope_mismatch")
        require(row["immutable_original_projection_matches"] is True, "original_projection_mismatch")
        require(row["approved_primary_link_count"] == 1, "ambiguous_public_link")
        require(row["public_food_source_key"] == row["concept_key"], "public_concept_link_mismatch")
        if concepts[fdc] is not None:
            require(row["concept_key"] == concepts[fdc], "source_concept_mismatch")
        else:
            require(re.fullmatch(r"foundation:generated:[0-9a-f-]{36}", row["concept_key"]) is not None, "reviewed_generated_concept_required")
            require(str(UUID(row["concept_key"].removeprefix("foundation:generated:"))) == row["concept_key"].removeprefix("foundation:generated:"), "invalid_generated_concept")
    if frozen is not None:
        require(set_comparison(frozen, rows) == dict(missing=0, additional=0, changed=0), "frozen_identity_relationship_mismatch")
    return fingerprint(tuple_set(rows))


def candidate_binding(candidate, frozen):
    expected = {row["fdc_id"]: row for row in frozen}.get(candidate["fdc_id"])
    require(expected is not None, "candidate_fdc_mismatch")
    require(candidate["record_identity"] == {key: expected[key] for key in ("fdc_id", "source_record_id", "source_version_id", "raw_content_sha256")}, "candidate_identity_mismatch")
    require(candidate["source_identity"]["source_release_id"] == expected["source_release_id"], "candidate_release_mismatch")


def negative_tests(snapshot, hashes, accepted_ids, concepts):
    frozen = copy.deepcopy(snapshot["rows"])
    edits = [
        ("food_uuid_substitution", lambda s: s["rows"][0].update(food_id=str(uuid4()))),
        ("source_record_uuid_substitution", lambda s: s["rows"][0].update(source_record_id=str(uuid4()))),
        ("source_version_uuid_substitution", lambda s: s["rows"][0].update(source_version_id=str(uuid4()))),
        ("original_raw_hash_changed", lambda s: s["rows"][0].update(raw_content_sha256="f" * 64)),
        ("fdc_id_replaced", lambda s: s["rows"][0].update(fdc_id="9999999", upstream_version_key="fdc:9999999")),
        ("duplicate_source_version", lambda s: s["rows"][0].update(source_version_id=s["rows"][1]["source_version_id"])),
        ("different_source_release", lambda s: s["rows"][0].update(source_release_id=str(uuid4()))),
        ("accepted_source_row_missing", lambda s: s["rows"].pop()),
        ("unexpected_current_head", lambda s: s["current_head"].update(id=str(uuid4()))),
        ("original_projection_link_changed", lambda s: s["rows"][0].update(immutable_original_projection_matches=False)),
        ("public_food_concept_link_changed", lambda s: s["rows"][0].update(public_food_source_key="foundation:ndb:9999999")),
        ("public_scope_changed", lambda s: s["rows"][0].update(ownerless_public_active_usda=False)),
    ]
    results = []
    for name, edit in edits:
        altered = copy.deepcopy(snapshot)
        edit(altered)
        try:
            validate_snapshot(altered, hashes, accepted_ids, concepts, frozen)
        except IdentityMismatch as error:
            results.append(dict(test=name, refused=True, category=str(error), nutrient_counts_unchanged=True))
        else:
            raise IdentityMismatch("negative_test_failed_" + name)
    sample = dict(fdc_id=frozen[0]["fdc_id"], record_identity={key: frozen[0][key] for key in ("fdc_id", "source_record_id", "source_version_id", "raw_content_sha256")}, source_identity=dict(source_release_id=RELEASE))
    candidate_binding(sample, frozen)
    sample["record_identity"]["source_version_id"] = frozen[1]["source_version_id"]
    try:
        candidate_binding(sample, frozen)
    except IdentityMismatch as error:
        results.append(dict(test="otherwise_identical_candidate_wrong_identity", refused=True, category=str(error), nutrient_counts_unchanged=True))
    else:
        raise IdentityMismatch("negative_candidate_test_failed")
    return results


def private_write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    require(path.parent.stat().st_mode & 0o077 == 0, "restricted_directory_required")
    # Exclusive creation prevents silently replacing the frozen observation.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as stream:
        stream.write(canonical(value) + "\n")


def main():
    parser = argparse.ArgumentParser()
    for name in ("retrieval", "archive", "public-ids", "output"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    retrieval_path = Path(args.retrieval)
    require(retrieval_path.stat().st_mode & 0o077 == 0, "restricted_retrieval_required")
    packet = json.loads(retrieval_path.read_text())
    require(packet["classification"] == CLASSIFICATION and packet["project_id"] == PROJECT and packet["region"] == "eu-west-1", "authorized_observation_required")
    records, hashes, custody = load_source(args.archive)
    audit_bytes = Path(args.public_ids).read_bytes()
    require(sha(audit_bytes) == AUDIT_HASH, "historical_membership_custody")
    accepted_ids = {str(value) for value in json.loads(audit_bytes)[0]["audit"]["public_fdc_ids"]}
    require(accepted_ids == {str(int(row["fdcId"])) for row in records if int(row["fdcId"]) not in REJECTS}, "historical_membership_mismatch")
    concepts = {str(int(row["fdcId"])): None if row.get("ndbNumber") is None else "foundation:ndb:" + str(row["ndbNumber"]) for row in records}
    preflight, aggregate = packet["preflight"], packet["cardinality"]
    require(preflight["dataset"]["id"] == DATASET and preflight["dataset"]["approval_status"] == "approved" and preflight["dataset"]["data_type"] == "foundation", "dataset_preflight_mismatch")
    release = preflight["release"]
    require(release["id"] == RELEASE and release["dataset_id"] == DATASET and not release["transformed"], "release_preflight_mismatch")
    require(release["sha256"] == custody["archive_sha256"] and release["manifest_fingerprint"] == "ad3a51cbb0b3c6bbafd98d8bd59d996e10ac8cc4d82f22d8695d3a2838a8c2b0", "release_custody_mismatch")
    require(preflight["head"]["head_matches_pointer"] is True and preflight["head"]["initial_promotion"] is True and not preflight["head"]["lifecycle_update"] and not preflight["head"]["has_predecessor"], "historical_head_origin_mismatch")
    for key in ("dataset_food_heads", "unique_foods", "unique_records", "unique_versions", "public_ownerless_active_usda_generic", "source_concept_links", "approved_primary_links", "approved_release_versions", "original_head_versions", "all_active", "valid_fdc_keys", "reverse_public_membership"):
        require(aggregate[key] == 353, "aggregate_" + key)
    require(aggregate["reverse_unlinked_public_members"] == 0, "reverse_public_membership_mismatch")
    snapshot = packet["snapshot"]
    digest = validate_snapshot(snapshot, hashes, accepted_ids, concepts)
    rows = sorted(snapshot["rows"], key=lambda row: int(row["fdc_id"]))
    results = negative_tests(snapshot, hashes, accepted_ids, concepts)
    inventory = dict(classification=CLASSIFICATION, project_id=PROJECT, region="eu-west-1", observed_at=snapshot["observed_at"], current_head=snapshot["current_head"], tuple_fields=list(TUPLE_FIELDS), canonical_tuple_set_sha256=digest, rows=rows)
    summary = dict(classification=CLASSIFICATION, historical_identity_qualified=True, project_id=PROJECT, region="eu-west-1", observed_at=snapshot["observed_at"], current_head=snapshot["current_head"], row_count=353,
                   unique_fdc_ids=353, unique_food_ids=353, unique_source_records=353, unique_source_versions=353, source_releases=1,
                   canonical_tuple_set_sha256=digest, accepted_raw_set_sha256=custody["accepted_raw_set_hash"], full_raw_set_sha256=custody["full_raw_set_hash"], custody=custody,
                   expected_versus_actual=dict(missing=0, additional=0, changed=0), raw_hash_mismatches=0, source_concept_mismatches=0, immutable_original_projection_matches=353,
                   reverse_public_membership=353, reverse_unlinked_public_members=0, read_only=True, statement_timeout="5s", lock_timeout="1s", negative_tests=results,
                   point_in_time_only=True, fresh_drift_check_required_before_mutation=True)
    root = Path(args.output)
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    private_write(root / "inventory.json", inventory)
    private_write(root / "identity-comparison.json", summary)
    print(canonical(summary))


if __name__ == "__main__":
    main()
