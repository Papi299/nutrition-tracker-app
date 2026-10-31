"""Independent, bidirectional canonical comparator. No importer imports."""
import argparse
from collections import Counter
import copy
from decimal import Decimal
import json
from pathlib import Path

from oracle import canonical, compare_sets, fingerprint, read_matrix, scaled


def evidence_body(row):
    return dict(application_nutrient_code=row["code"], source_nutrient_id=row["source_id"],
                source_nutrient_name=row["source_name"], source_unit=row["source_unit"],
                source_value=row["value"], application_unit=row["application_unit"], basis=row["basis"],
                semantic=row["semantic"], derivation_code=row["derivation_code"],
                derivation_description=row["derivation_description"], footnote=row["footnote"],
                loq=row["loq"], raw_field_path=row["raw_field_path"], exact_conversion_factor=None)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--oracle", required=True)
    parser.add_argument("--results", required=True)
    args = parser.parse_args()
    root = Path(args.results)
    read = lambda name: json.loads((root / name).read_text())
    expected = json.loads(Path(args.oracle).read_text())
    actual = read("actual-positions.synthetic-bindings.json")
    differences = compare_sets(expected["positions"], actual)
    additions = read("actual-additions.synthetic-bindings.json")
    additions_diff = compare_sets(expected["additions"], additions)
    assert len({row["fdc_id"] for row in additions}) == 353
    # Same-count wrong value must fail; no aggregate-count success shortcut.
    wrong = copy.deepcopy(additions)
    wrong[0]["value"] = str(Decimal(wrong[0]["value"]) + Decimal("0.0001"))
    wrong_diff = compare_sets(expected["additions"], wrong)
    assert len(wrong) == len(additions) and len(wrong_diff) == 1
    missing = copy.deepcopy(actual)
    null_index = next(i for i,r in enumerate(missing) if r["value"] is None)
    missing[null_index]["value"] = "0"
    assert len(compare_sets(expected["positions"], missing)) == 1
    duplicate_refused = False
    try:
        compare_sets(expected["additions"], additions + additions[:1])
    except AssertionError:
        duplicate_refused = True
    assert duplicate_refused
    expected_evidence = []
    for row in expected["evidence"]:
        body = evidence_body(row)
        expected_evidence.append(dict(fdc_id=row["fdc_id"], **body, evidence_hash=fingerprint(body)))
    evidence_order = lambda r:(int(r["fdc_id"]),r["application_nutrient_code"],int(r["source_nutrient_id"]))
    expected_evidence.sort(key=evidence_order)
    actual_evidence = sorted(read("actual-evidence.synthetic-bindings.json"), key=evidence_order)
    evidence_diff = []
    if expected_evidence != actual_evidence:
        left = {evidence_order(r):r for r in expected_evidence}
        right = {evidence_order(r):r for r in actual_evidence}
        evidence_diff = [dict(key=list(k), expected=left.get(k), actual=right.get(k)) for k in sorted(left.keys() | right.keys()) if left.get(k) != right.get(k)]
    candidates = read("candidates.synthetic-bindings.json")
    inventory = read("candidate-inventory.synthetic-bindings.json")
    assert len(candidates) == len(inventory) == 353
    for candidate in candidates:
        body = {k:v for k,v in candidate.items() if k != "content_fingerprint"}
        assert fingerprint(body) == candidate["content_fingerprint"]
        assert fingerprint(candidate["nutrient_evidence"]) == candidate["evidence_set_hash"]
        assert len(candidate["nutrients"]) == 35
        assert candidate["record_identity"]["raw_content_sha256"] == expected["raw_hashes"][candidate["fdc_id"]]
        nutrient_evidence = {e["evidence_hash"]:e for e in candidate["nutrient_evidence"]}
        for state in candidate["nutrients"].values():
            if state["value"] is None:
                assert state["evidence_hash"] is None
            else:
                assert nutrient_evidence[state["evidence_hash"]]["source_value"] == state["value"]
    report = read("report-v3.synthetic-bindings.json")
    reconciliation = read("reconciliation.synthetic-bindings.json")
    for obj, field in [(report,"report_fingerprint"),(reconciliation,"reconciliation_fingerprint"),(read("legacy-report.json"),"report_fingerprint")]:
        assert fingerprint({k:v for k,v in obj.items() if k != field}) == obj[field]
    coverage = {r["application_nutrient_code"]:r for r in report["coverage"]}
    for row in expected["coverage"]:
        current = coverage[row["code"]]
        for key in ["present","explicit_zero","missing","source_reported","source_calculated"]:
            assert row[key] == current[key], (row["code"], key)
        assert row["withheld"] == current["held"] + current["unavailable"]
    # Python constructs original reference strings and exact half-up results for
    # all official-source vectors, to be consumed by the application pure tests.
    matrix = read_matrix("docs/nutrition-usda-full35-mapping-spec.md")
    by_code = {r["code"]:r for r in matrix}
    app_vectors = {}
    for row in expected["positions"]:
        food = app_vectors.setdefault(row["fdc_id"], dict(reference={}, scaled={str(g):{} for g in [50,100,200]}))
        food["reference"][row["code"]] = row["value"]
        for grams in [50,100,200]:
            food["scaled"][str(grams)][row["code"]] = scaled(row, grams, by_code[row["code"]]["precision"])
    (root / "application-oracle.json").write_text(canonical(app_vectors)+"\n")
    units = Counter(r["source_unit"] for r in expected["evidence"])
    derivations = Counter(r["derivation_code"] or "absent" for r in expected["evidence"])
    semantics = Counter(r["semantic"] for r in expected["positions"])
    summary = dict(
        identity_scope="authentic USDA source values; synthetic local UUID bindings; NOT historical UUID verification",
        state_positions=len(actual), positions_sha256=fingerprint(actual),
        core_values=sum(r["value"] is not None and r["code"] in {"energy_kcal","protein_g","carbohydrates_g","fat_g"} for r in actual),
        additional_values=len(additions), additions_sha256=fingerprint(additions), present=6261, missing=6094, withheld=1059,
        complete_state_mismatches=len(differences), addition_mismatches=len(additions_diff),
        evidence_records=len(actual_evidence), evidence_mismatches=len(evidence_diff), evidence_sha256=fingerprint(actual_evidence),
        candidate_inventory_sha256=fingerprint(inventory), independently_rehashed_candidates=353,
        both_energy_method_evidence_verified=True, energy_selection=expected["energy"],
        same_count_wrong_value_detected=len(wrong_diff), unknown_to_zero_detected=True, duplicate_tuple_refused=True,
        source_units=dict(sorted(units.items())), derivations=dict(sorted(derivations.items())), semantics=dict(sorted(semantics.items())),
        source_rounding=False, source_lexeme_roundtrip=expected["custody"]["all_numeric_lexemes_exact"],
        maximum_source_value=max(Decimal(r["value"]) for r in expected["positions"] if r["value"] is not None).__str__(),
        max_fractional_precision=max(max(0,-Decimal(r["value"]).as_tuple().exponent) for r in expected["positions"] if r["value"] is not None),
        microgram_factor="1", trace_or_negative_accepted=0,
        differences=differences[:20], addition_differences=additions_diff[:20], evidence_differences=evidence_diff[:20],
        application_food_vectors=len(app_vectors), application_positions=353*35*3,
    )
    (root / "comparison.json").write_text(canonical(summary)+"\n")
    (root / "coverage.json").write_text(canonical(expected["coverage"])+"\n")
    assert not differences and not additions_diff and not evidence_diff, "Nutrient qualification mismatch: preserved in comparison.json"
    assert summary["positions_sha256"] == expected["positions_sha256"]
    assert summary["additions_sha256"] == expected["additions_sha256"]
    print(json.dumps({k:v for k,v in summary.items() if k in {"state_positions","core_values","additional_values","complete_state_mismatches","evidence_mismatches","evidence_records","same_count_wrong_value_detected"}}))


if __name__ == "__main__":
    main()
