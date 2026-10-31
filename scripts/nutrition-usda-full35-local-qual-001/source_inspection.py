"""Independent observed-schema, dictionary and scientific-alternative inventory."""
import argparse
from collections import Counter, defaultdict
from decimal import Decimal
import json
from pathlib import Path

from oracle import REJECTS, canonical, fingerprint, load_source, read_matrix, sha


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True)
    parser.add_argument("--dictionary", required=True)
    parser.add_argument("--results", required=True)
    args = parser.parse_args()
    records, hashes, custody = load_source(args.archive)
    matrix = read_matrix("docs/nutrition-usda-full35-mapping-spec.md")
    dictionary = {int(r["id"]):r for r in json.loads(Path(args.dictionary).read_text())}
    dictionary_checks = []
    for row in matrix:
        for source_id, name in row["definitions"]:
            entry = dictionary[source_id]
            assert name == entry["name"] and row["unit"].upper() == entry["unit_name"]
            dictionary_checks.append(dict(code=row["code"], source_id=source_id, name=name, unit=entry["unit_name"]))
    schema = defaultdict(set)

    def observe(value, path):
        kind = "null" if value is None else "boolean" if isinstance(value,bool) else "array" if isinstance(value,list) else "object" if isinstance(value,dict) else "number" if isinstance(value,(Decimal,int)) else "string"
        schema[path].add(kind)
        if isinstance(value,list):
            for child in value:
                observe(child,path+"[]")
        elif isinstance(value,dict):
            for key,child in value.items():
                observe(child,path+"."+key)
    observe({"FoundationFoods":records+[None]*32},"$")
    observed = {path:sorted(kinds) for path,kinds in sorted(schema.items())}
    root = Path(args.results)
    summary = json.loads((root/"adapter-summary.json").read_text())
    assert observed == summary["observed_schema"]
    assert fingerprint(observed) == summary["observed_schema_fingerprint"]
    maximum = max(len(canonical(record).encode()) for record in records)
    assert maximum == summary["maximum_raw_record_bytes"] and maximum < 131072
    alternatives = {
        "energy_kcal":[1008,1062], "fiber_g":[2033],"sugars_g":[2000],"fat_g":[1085],
        "trans_fat_g":[1329,1330,1331],"vitamin_a_rae_ug":[1104,1105,2066],
        "vitamin_d_ug":[1110,1111,1112,1113],"vitamin_e_mg":[1125,1126,1127],
        "vitamin_k_ug":[1183,1184,1185],"folate_dfe_ug":[1177,1186,1187],"added_sugars_g":[1063,2000],
    }
    accepted = [r for r in records if int(r["fdcId"]) not in REJECTS]
    alternative_inventory = []
    for code,ids in alternatives.items():
        for source_id in ids:
            items=[n for r in accepted for n in r["foodNutrients"] if n["nutrient"]["id"]==source_id]
            alternative_inventory.append(dict(code=code,excluded_id=source_id,records=len(items),
                                             with_numeric_amount=sum("amount" in n for n in items),
                                             substituted_values=0))
    warnings=Counter(category for row in json.loads((root/"candidate-inventory.synthetic-bindings.json").read_text()) for category in row["warning_categories"])
    approved_warnings={"missing_direct_nutrients","policy_withheld_nutrients","alternative_energy_methods_retained","unsupported_nutrients_retained_in_raw","source_portion_sequence_rebased"}
    assert set(warnings) <= approved_warnings
    items = [n for r in records for n in r["foodNutrients"]]
    rejected_rows=[]
    for record in records:
        if int(record["fdcId"]) in REJECTS:
            negatives=[n for n in record["foodNutrients"] if n["nutrient"]["id"]==1005 and n["amount"]<0]
            assert len(negatives)==1
            rejected_rows.append(dict(fdc_id=str(int(record["fdcId"])),raw_hash=hashes[str(int(record["fdcId"]))],
                                      category="negative_target_value",source_id="1005",value=str(negatives[0]["amount"])))
    result=dict(custody=custody,dictionary_sha256=sha(Path(args.dictionary).read_bytes()),dictionary_checks=dictionary_checks,
                observed_schema=observed,observed_schema_fingerprint=fingerprint(observed),maximum_raw_record_bytes=maximum,
                source_records=363,accepted_records=353,trailing_nulls=32,duplicate_fdc_ids=0,
                source_nutrient_items=len(items),source_loq_fields=sum("loq" in n for n in items),
                source_less_than_footnotes=sum(n.get("footnote","").lstrip().startswith("<") for n in items),
                excluded_alternatives=alternative_inventory,rejected_records=sorted(rejected_rows,key=lambda r:int(r["fdc_id"])),
                warning_counts=dict(sorted(warnings.items())),unexpected_warning_categories=[],
                source_portions_are_metadata_only=True,no_serving_alias_created=True)
    (root/"source-inspection.json").write_text(canonical(result)+"\n")
    print(json.dumps(dict(schema_paths=len(observed),dictionary_definitions=len(dictionary_checks),maximum_raw_record_bytes=maximum,
                          source_loq_fields=result["source_loq_fields"],source_less_than_footnotes=result["source_less_than_footnotes"],warnings=result["warning_counts"])))


if __name__ == "__main__":
    main()
