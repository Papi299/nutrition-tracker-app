"""Small synthetic comparator regressions; no official food copied into Git."""
import copy
from decimal import Decimal
from pathlib import Path
import unittest

from oracle import canonical, compare_sets, read_matrix, scaled


class IndependentOracleTests(unittest.TestCase):
    def test_matrix_is_the_normative_35_row_specification(self):
        matrix = read_matrix(Path(__file__).resolve().parents[2] / "docs/nutrition-usda-full35-mapping-spec.md")
        self.assertEqual(len(matrix), 35)
        self.assertEqual(sum(r["safe"] for r in matrix), 6261)
        self.assertEqual(sum(r["safe"] for r in matrix if r["group"] != "core"), 5062)

    def test_canonical_exact_decimals_and_unicode(self):
        self.assertEqual(canonical({"z":Decimal("1.2300"), "a":[Decimal("0.0001"),"µg"]}), '{"a":[0.0001,"µg"],"z":1.23}')

    def test_equal_counts_wrong_value_are_not_equality(self):
        expected = [dict(fdc_id="9000001", code="fiber_g", value="1.2345")]
        actual = copy.deepcopy(expected)
        actual[0]["value"] = "1.2346"
        self.assertEqual(len(compare_sets(expected, actual)), 1)
        self.assertEqual(compare_sets(expected, copy.deepcopy(expected)), [])

    def test_both_directions_missing_extra_unknown_zero_and_method(self):
        expected = [dict(fdc_id="9000001", code="energy_kcal", value=None, source_id=None)]
        for actual in [[], [dict(expected[0], value="0")], [dict(expected[0], source_id="2047")],
                       expected + [dict(fdc_id="9000002",code="energy_kcal",value="1",source_id="2048")]]:
            self.assertTrue(compare_sets(expected, actual))

    def test_duplicate_keys_fail(self):
        row = dict(fdc_id="9000001",code="fiber_g",value="0")
        with self.assertRaises(AssertionError):
            compare_sets([row], [row,row])

    def test_original_decimal_half_up_and_unknown(self):
        self.assertEqual([scaled({"value":"100.5"},g,0) for g in [50,100,200]], ["50","101","201"])
        self.assertEqual([scaled({"value":"1.005"},g,2) for g in [50,100,200]], ["0.5","1.01","2.01"])
        self.assertEqual([scaled({"value":"0.1234"},g,4) for g in [50,100,200]], ["0.0617","0.1234","0.2468"])
        self.assertIsNone(scaled({"value":None},200,4))


if __name__ == "__main__":
    unittest.main()
