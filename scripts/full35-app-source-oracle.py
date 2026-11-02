"""Prepare the existing independent official-source oracle outside Git."""
import argparse
import importlib.util
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--archive", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()
spec = importlib.util.spec_from_file_location("accepted_independent_oracle", "scripts/nutrition-usda-full35-local-qual-001/oracle.py")
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)
records, hashes, custody = oracle.load_source(args.archive)
matrix = oracle.read_matrix("docs/nutrition-usda-full35-mapping-spec.md")
result = oracle.oracle(records, hashes, matrix)
precisions = {row["code"]: row["precision"] for row in matrix}
foods = {}
for row in result["positions"]:
    food = foods.setdefault(str(row["fdc_id"]), {"reference": {}, "scaled": {str(q): {} for q in [50, 100, 200]}})
    food["reference"][row["code"]] = row["value"]
    for quantity in [50, 100, 200]:
        food["scaled"][str(quantity)][row["code"]] = oracle.scaled(row, quantity, precisions[row["code"]])
target = Path(args.output)
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(foods, sort_keys=True) + "\n")
print(json.dumps({"foods": len(foods), "states": len(result["positions"]), "custody": custody,
                  "positions_sha256": result["positions_sha256"], "additions_sha256": result["additions_sha256"]}))
