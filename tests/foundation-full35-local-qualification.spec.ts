import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { nutrientCodesV1, nutrientManifestV1, parseNutrientReferenceValues, scaleNutrientAmount, type NutrientReferenceValuesV1 } from "@/lib/nutrition-snapshots";
import { allNutrientFields, convertFoodQuantity, nutrientCodeForField, scaleAllFoodNutrients, type AllFoodNutrientReference } from "@/lib/food-selection/nutrient-scaling";

function reference(nutrients: NutrientReferenceValuesV1): AllFoodNutrientReference {
  return { food_id:"00000000-0000-4000-8000-000000000001", nutrient_basis:"per_100g",
    serving_quantity:100, serving_unit:"g", calories:999, protein_g:999, carbohydrates_g:999, fat_g:999,
    nutrients, reference_fingerprint:"synthetic-application-only" };
}

test("independent Python comparator rejects equal-count wrong values, method changes and unknown-to-zero", () => {
  const result = execFileSync("python3", ["scripts/nutrition-usda-full35-local-qual-001/test_oracle.py"], { encoding:"utf8", stdio:"pipe" });
  expect(result).toBe("");
});

test("manual/custom SYNTHETIC all-35 vector scales once from original reference decimals", () => {
  const vector = Object.fromEntries(nutrientCodesV1.map(code=>[code,
    code === "energy_kcal" ? "100.5" : ["protein_g","carbohydrates_g","fat_g"].includes(code) ? "1.005" : "0.1234"])) as NutrientReferenceValuesV1;
  expect(parseNutrientReferenceValues(vector)).toEqual({ok:true,data:vector});
  const expected = [["50","0.5","0.0617"],["101","1.01","0.1234"],["201","2.01","0.2468"]];
  for (const [index,grams] of [50,100,200].entries()) {
    const result = scaleAllFoodNutrients(reference(vector),grams,"g");
    expect(result.ok).toBe(true); if(!result.ok) throw new Error(result.code);
    expect(Object.keys(result.values)).toEqual(allNutrientFields);
    for (const field of allNutrientFields) {
      const code = nutrientCodeForField(field), precision = nutrientManifestV1.find(n=>n.code===code)!.precision;
      expect(result.values[field]).toBe(expected[index][precision===0?0:precision===2?1:2]);
    }
  }
});

test("USDA-shaped SYNTHETIC vector preserves all withheld unknowns and explicit zeros at every quantity", () => {
  const vector = Object.fromEntries(nutrientCodesV1.map(code=>[code,"0"])) as NutrientReferenceValuesV1;
  for (const code of ["added_sugars_g","vitamin_k_ug","folate_dfe_ug"] as const) vector[code]=null;
  for(const grams of [50,100,200]) {
    const result=scaleAllFoodNutrients(reference(vector),grams,"g");
    expect(result.ok).toBe(true); if(!result.ok) throw new Error(result.code);
    for(const field of allNutrientFields) expect(result.values[field]).toBe(vector[nutrientCodeForField(field)]===null?"":"0");
  }
  expect(scaleNutrientAmount("fiber_g","9999999999.9999",200,100)).toEqual({ok:false,code:"amount_out_of_range"});
});

test("existing physical conversions and serving limitations preserve exact quantity", () => {
  const values=Object.fromEntries(nutrientCodesV1.map(code=>[code,"1"])) as NutrientReferenceValuesV1;
  const food=reference(values);
  for(const [from,to,amount,expected] of [["kg","g","0.05","50"],["mg","g","50000","50"],["g","kg","50","0.05"],["l","ml","0.05","50"]]) {
    expect(convertFoodQuantity(food,amount,from,to)).toEqual({ok:true,quantity:expected});
  }
  expect(convertFoodQuantity(food,"1","mg","kg")).toMatchObject({ok:false,code:"quantity_precision"});
  for(const unit of ["oz","lb","cup","serving","ml"]) expect(scaleAllFoodNutrients(food,"1",unit)).toMatchObject({ok:false,code:"incompatible_unit"});
  const verified={...food,catalog_serving_quantity:50,catalog_serving_unit:"g"};
  expect(scaleAllFoodNutrients(verified,1,"serving")).toEqual(scaleAllFoodNutrients(food,50,"g"));
  const volume={...food,nutrient_basis:"per_100ml",serving_unit:"ml"};
  expect(scaleAllFoodNutrients(volume,"0.05","l")).toEqual(scaleAllFoodNutrients(volume,50,"ml"));
  const custom={...food,nutrient_basis:"per_serving",serving_quantity:1,serving_unit:"cup"};
  expect(scaleAllFoodNutrients(custom,2,"cup").ok).toBe(true);
  expect(scaleAllFoodNutrients(custom,200,"g")).toMatchObject({ok:false,code:"incompatible_unit"});
});

test("optional local authentic-source vectors match independent Python Decimal scaling at 50/100/200 g", () => {
  const path=".ingestion-workspace/full35-local-qual-001/application-oracle.json";
  test.skip(!existsSync(path),"Official source stays outside Git; link the local application oracle as documented in the harness.");
  const foods=JSON.parse(readFileSync(path,"utf8")) as Record<string,{reference:NutrientReferenceValuesV1;scaled:Record<string,NutrientReferenceValuesV1>}>;
  expect(Object.keys(foods)).toHaveLength(353);
  for(const food of Object.values(foods)) {
    expect(parseNutrientReferenceValues(food.reference)).toEqual({ok:true,data:food.reference});
    for(const grams of [50,100,200]) {
      const result=scaleAllFoodNutrients(reference(food.reference),grams,"g");
      expect(result.ok).toBe(true); if(!result.ok) throw new Error(result.code);
      expect(Object.keys(result.values)).toHaveLength(35);
      for(const field of allNutrientFields) expect(result.values[field]).toBe(food.scaled[String(grams)][nutrientCodeForField(field)]??"");
      for(const code of ["added_sugars_g","vitamin_k_ug","folate_dfe_ug"] as const) expect(result.values[code]).toBe("");
    }
  }
});
