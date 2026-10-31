"""Independent Decimal oracle: normative MAP-04/06, never TS mapping code.

No network/database access. Official inputs and detailed results stay outside Git.
Canonical raw numbers implement JSON's shortest-decimal contract after an exact
Decimal -> binary64 -> shortest-decimal equality check; decimals never get rounded.
"""

import argparse
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
from pathlib import Path
import re
import zipfile


ARCHIVE_HASH = "186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a"
JSON_HASH = "27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc"
REJECTS = {2727566, 2727567, 2727568, 2727569, 2727570, 2727571, 2727575, 2727576, 2747656, 2747673}
MEMBER = "FoodData_Central_foundation_food_json_2026-04-30.json"


def sha(data):
    return hashlib.sha256(data if isinstance(data, bytes) else data.encode()).hexdigest()


def decimal_text(value):
    value = Decimal(value)
    assert value.is_finite()
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return "0" if value == 0 else text


def canonical(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, Decimal)):
        return decimal_text(value)
    if isinstance(value, float):
        return decimal_text(Decimal(str(value)))
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, list):
        return "[" + ",".join(canonical(x) for x in value) + "]"
    if isinstance(value, dict):
        return "{" + ",".join(canonical(k) + ":" + canonical(value[k]) for k in sorted(value)) + "}"
    raise TypeError(type(value))


def fingerprint(value):
    return sha(canonical(value))


def exact_object(pairs):
    result = {}
    for key, value in pairs:
        assert key not in result, "duplicate JSON key"
        result[key] = value
    return result


def read_matrix(spec):
    """Read the reviewed Markdown contract; no implementation-generated matrix."""
    rows = []
    for line in Path(spec).read_text().splitlines():
        if not line.startswith("| `") or " / " not in line:
            continue
        fields = [x.strip() for x in line.strip("|").split("|")]
        if len(fields) != 10 or fields[3] not in {"D", "U", "H"}:
            continue
        code, group = fields[0].replace("`", "").split(" / ")
        unit, precision = fields[2].split(" / ")
        definitions = re.findall(r"(\d+): (.*?)(?= > \d+: |$)", fields[1])
        rows.append(dict(code=code, group=group, unit=unit, precision=int(precision),
                         classification=fields[3], definitions=[(int(i), n) for i, n in definitions],
                         definition=fields[4], excluded=fields[5],
                         reported=int(fields[6].split("/")[0]), public=int(fields[6].split("/")[1]),
                         zero=int(fields[7]), source_missing=int(fields[8]), safe=int(fields[9])))
    assert len(rows) == len({r["code"] for r in rows}) == 35
    assert Counter(r["classification"] for r in rows) == {"D": 32, "U": 2, "H": 1}
    assert sum(len(r["definitions"]) for r in rows if r["classification"] == "D") == 33
    return rows


def load_source(path):
    archive = Path(path).read_bytes()
    assert len(archive) == 469303 and sha(archive) == ARCHIVE_HASH, "archive custody"
    with zipfile.ZipFile(path) as z:
        entries = z.infolist()
        assert len(entries) == 1 and entries[0].filename == MEMBER
        assert entries[0].file_size == 6721650 and entries[0].compress_type == 8
        assert not entries[0].flag_bits & 1
        raw = z.read(MEMBER)  # zipfile independently verifies CRC.
    assert len(raw) == 6721650 and sha(raw) == JSON_HASH, "member custody"
    numbers = []

    def number(lexeme):
        value = Decimal(lexeme)
        assert value.is_finite() and Decimal(str(float(value))) == value, "decimal round-trip"
        numbers.append(value)
        return value

    root = json.loads(raw, parse_float=number, parse_int=number, object_pairs_hook=exact_object)
    assert list(root) == ["FoundationFoods"]
    collection = root["FoundationFoods"]
    assert len(collection) == 395 and collection[363:] == [None] * 32
    records = collection[:363]
    assert all(r["dataType"] == "Foundation" and r["foodClass"] == "FinalFood" for r in records)
    assert len({r["fdcId"] for r in records}) == 363
    hashes = {str(int(r["fdcId"])): fingerprint(r) for r in records}
    raw_set = lambda ids: sha("\n".join(f"{i}:{hashes[i]}" for i in sorted(ids, key=int)))
    assert raw_set(hashes) == "c53100dd52fa09df408b4e9e7682f43192616689d0afaed7029e8c1b4344cf12"
    accepted = [r for r in records if int(r["fdcId"]) not in REJECTS]
    assert len(accepted) == 353
    assert raw_set([str(int(r["fdcId"])) for r in accepted]) == "95749cc4e604e3a94c6d07bf0bcf0c640f1688abadebcbfd5d157cf2c3b262d4"
    return records, hashes, dict(archive_sha256=sha(archive), member_sha256=sha(raw), archive_bytes=len(archive),
                               member_bytes=len(raw), numeric_lexemes=len(numbers), all_numeric_lexemes_exact=True,
                               full_raw_set_hash=raw_set(hashes), accepted_raw_set_hash=raw_set([str(int(r["fdcId"])) for r in accepted]))


def state(record, row, raw_hash, record_index):
    code, unit = row["code"], row["unit"]
    result = dict(fdc_id=str(int(record["fdcId"])), code=code, value=None, source_id=None,
                  source_unit=None, application_unit=unit, basis="per_100g", semantic="missing",
                  derivation_code=None, derivation_description=None, source_name=None,
                  footnote=None, loq=None, raw_field_path=None, raw_hash=raw_hash,
                  missing_reason={"D": "source_absent", "U": "unavailable_in_approved_source", "H": "semantic_hold"}[row["classification"]])
    if row["classification"] != "D":
        return result, []
    evidence = []
    for source_id, name in row["definitions"]:
        matches = [(i, n) for i, n in enumerate(record["foodNutrients"]) if n["nutrient"]["id"] == source_id]
        assert len(matches) <= 1, "duplicate eligible source ID"
        if not matches:
            continue
        index, item = matches[0]
        nutrient = item["nutrient"]
        assert nutrient["name"] == name
        assert nutrient["unitName"] in {"g": {"g", "G"}, "mg": {"mg", "MG"}, "ug": {"ug", "UG", "µg"}, "kcal": {"kcal", "KCAL"}}[unit]
        value = Decimal(item["amount"])
        assert value.is_finite() and value >= 0 and value <= Decimal("9999999999.9999")
        assert value == value.quantize(Decimal("0.0001")), "numeric(14,4)"
        assert not item.get("loq", 0) and not re.match(r"\s*<", item.get("footnote", "")), "trace"
        derivation = item.get("foodNutrientDerivation", {})
        semantic = "explicit_zero" if value == 0 else "source_calculated" if derivation.get("code") in {"NC", "AS"} else "source_reported"
        selected = dict(result, value=decimal_text(value), source_id=str(source_id), source_unit=nutrient["unitName"],
                        semantic=semantic, missing_reason=None, derivation_code=derivation.get("code"),
                        derivation_description=derivation.get("description"), source_name=name,
                        footnote=item.get("footnote"), loq=decimal_text(item["loq"]) if "loq" in item else None,
                        raw_field_path=f"FoundationFoods[{record_index}].foodNutrients[{index}]")
        evidence.append(selected)
    return (evidence[0] if evidence else result), evidence


def tuple_key(row):
    return int(row["fdc_id"]), row["code"]


def compare_sets(expected, actual):
    """Bidirectional comparison keyed independently of importer fingerprints/counts."""
    def keyed(rows):
        result = {}
        for row in rows:
            key = tuple_key(row)
            assert key not in result, "duplicate tuple"
            result[key] = row
        return result
    left, right = keyed(expected), keyed(actual)
    return [dict(fdc_id=str(k[0]), code=k[1], expected=left.get(k), actual=right.get(k))
            for k in sorted(left.keys() | right.keys()) if left.get(k) != right.get(k)]


def oracle(records, hashes, matrix):
    positions, all_evidence, coverage = [], [], []
    energy = Counter()
    for row in matrix:
        values, reported, reported_zero = [], 0, 0
        for index, record in enumerate(records):
            fdc = int(record["fdcId"])
            # Independent original rejection rule; not membership subtraction alone.
            negatives = [n for n in record["foodNutrients"] if n["nutrient"]["id"] in {1003, 1004, 1005, 2047, 2048} and n.get("amount", 0) < 0]
            assert bool(negatives) == (fdc in REJECTS)
            if row["classification"] != "D":
                items = [n for n in record["foodNutrients"] if int(n["nutrient"]["id"]) in {i for i, _ in row["definitions"]} and "amount" in n]
                reported += bool(items)
                if fdc not in REJECTS:
                    reported_zero += bool(items) and items[0]["amount"] == 0
            elif fdc in REJECTS:
                # R counts numeric source values, including excluded negative carbohydrates.
                reported += any(n["nutrient"]["id"] in {i for i, _ in row["definitions"]} and "amount" in n for n in record["foodNutrients"])
            if fdc in REJECTS:
                continue
            item, evidence = state(record, row, hashes[str(fdc)], index)
            positions.append(item)
            all_evidence.extend(evidence)
            values.append(item)
            if row["classification"] == "D":
                reported += item["value"] is not None
            if row["code"] == "energy_kcal" and item["source_id"]:
                energy[item["source_id"]] += 1
        count = Counter(x["semantic"] for x in values)
        present = [x for x in values if x["value"] is not None]
        source_public = len(present) if row["classification"] == "D" else sum(any(n["nutrient"]["id"] in {i for i, _ in row["definitions"]} and "amount" in n for n in r["foodNutrients"]) for r in records if int(r["fdcId"]) not in REJECTS)
        source_zero = count["explicit_zero"] if row["classification"] == "D" else int(reported_zero)
        assert (reported, source_public, source_zero, len(present)) == (row["reported"], row["public"], row["zero"], row["safe"]), row["code"]
        coverage.append(dict(code=row["code"], classification=row["classification"], source_ids=[i for i, _ in row["definitions"]],
                             source_definitions=[n for _, n in row["definitions"]], definition=row["definition"], application_unit=row["unit"],
                             reported=reported, accepted_reported=source_public, reported_zero=source_zero, present=len(present),
                             positive=len(present)-count["explicit_zero"], explicit_zero=count["explicit_zero"], missing=count["missing"],
                             withheld=353 if row["classification"] != "D" else 0,
                             source_reported=count["source_reported"], source_calculated=count["source_calculated"],
                             derivations=dict(sorted(Counter(x["derivation_code"] or "absent" for x in present).items())),
                             selected_methods=dict(sorted(Counter(x["source_id"] for x in present).items())),
                             maximum=max((Decimal(x["value"]) for x in present),default=Decimal(0)).__str__(),
                             maximum_fractional_precision=max((max(0,-Decimal(x["value"]).as_tuple().exponent) for x in present),default=0)))
    positions.sort(key=tuple_key)
    all_evidence.sort(key=lambda x:(*tuple_key(x),int(x["source_id"])))
    additions = [x for x in positions if x["value"] is not None and x["code"] not in {"energy_kcal", "protein_g", "carbohydrates_g", "fat_g"}]
    assert len(positions) == 12355 and len(additions) == 5062
    assert sum(x["value"] is not None for x in positions) == 6261
    assert sum(x["value"] is None for x in positions) == 6094
    assert sum(x["withheld"] for x in coverage) == 1059
    assert sum(x["explicit_zero"] for x in coverage) == 320
    assert energy == {"2048":191,"2047":25}
    return dict(positions=positions, evidence=all_evidence, additions=additions, coverage=coverage,
                positions_sha256=fingerprint(positions), additions_sha256=fingerprint(additions), energy=dict(energy))


def scaled(row, quantity, precision):
    if row["value"] is None:
        return None
    value = Decimal(row["value"]) * Decimal(quantity) / 100
    return decimal_text(value.quantize(Decimal(1).scaleb(-precision), rounding=ROUND_HALF_UP))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--spec", default="docs/nutrition-usda-full35-mapping-spec.md")
    args = parser.parse_args()
    records, hashes, custody = load_source(args.archive)
    result = oracle(records, hashes, read_matrix(args.spec))
    result.update(custody=custody, raw_hashes=hashes, matrix_sha256=sha(Path(args.spec).read_bytes()),
                  historical_uuid_verification="not_established_by_source_oracle")
    Path(args.output).write_text(canonical(result)+"\n")
    print(json.dumps(dict(positions=len(result["positions"]),present=6261,additions=len(result["additions"]),
                          additions_sha256=result["additions_sha256"], positions_sha256=result["positions_sha256"])))


if __name__ == "__main__":
    main()
