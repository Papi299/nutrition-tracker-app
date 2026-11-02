"""Independent Stage5 Decimal oracle. No application/importer code is imported."""
import argparse
from decimal import Decimal, ROUND_HALF_UP, localcontext
import json
from pathlib import Path

# Independently transcribed HIST-01 manifest contract; tests compare every code.
CODES = """energy_kcal protein_g carbohydrates_g fat_g fiber_g sugars_g
added_sugars_g saturated_fat_g monounsaturated_fat_g polyunsaturated_fat_g
trans_fat_g cholesterol_mg sodium_mg potassium_mg calcium_mg iron_mg
magnesium_mg phosphorus_mg zinc_mg copper_mg manganese_mg selenium_ug
vitamin_a_rae_ug vitamin_c_mg vitamin_d_ug vitamin_e_mg vitamin_k_ug thiamin_mg
riboflavin_mg niacin_mg pantothenic_acid_mg vitamin_b6_mg folate_dfe_ug
vitamin_b12_ug choline_mg""".split()
WITHHELD = {"added_sugars_g", "folate_dfe_ug", "vitamin_k_ug"}


def decimal_text(value):
    return format(value, "f").rstrip("0").rstrip(".") if "." in format(value, "f") else format(value, "f")


def scale(code, amount, quantity, reference="100"):
    if amount is None:
        return None
    precision = 0 if code == "energy_kcal" else 2 if code in CODES[1:4] else 4
    with localcontext() as context:
        context.prec = 80
        result = (Decimal(amount) * Decimal(quantity) / Decimal(reference)).quantize(
            Decimal(1).scaleb(-precision), rounding=ROUND_HALF_UP)
    return decimal_text(result)


def vectors():
    cases = []
    for index, code in enumerate(CODES):
        raw = "100.5" if index == 0 else "1.005" if index < 4 else "0.1234"
        maximum = "2147483647" if index == 0 else "999999.99" if index < 4 else "9999999999.9999"
        for quantity in ["50", "100", "200"]:
            cases.append({"code": code, "amount": raw, "quantity": quantity, "expected": scale(code, raw, quantity)})
        for quantity in ["50", "100", "200"]:
            distinct = f"{index + 1}.1234"
            cases.append({"code": code, "amount": distinct, "quantity": quantity, "expected": scale(code, distinct, quantity)})
        cases.append({"code": code, "amount": maximum, "quantity": "100", "expected": maximum})
    profile = {code: None if code in WITHHELD else "100.5" if i == 0 else "1.005" if i < 4 else f"{i + 1}.1234"
               for i, code in enumerate(CODES)}
    return {"contract": "synthetic-application-scaling-only/v1", "codes": CODES,
            "cases": cases, "sourcePolicyProfile": profile,
            "profileExpected": {q: {code: scale(code, amount, q) for code, amount in profile.items()}
                                for q in ["50", "100", "200"]}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    target = Path("tests/fixtures/full35-app-oracle.json")
    expected = json.dumps(vectors(), ensure_ascii=False, indent=2) + "\n"
    if args.check:
        assert target.read_text() == expected, "Independent Decimal fixture differs; regenerate and review."
        print(f"Independent Decimal oracle: {len(vectors()['cases'])} vectors verified.")
    else:
        target.write_text(expected)
