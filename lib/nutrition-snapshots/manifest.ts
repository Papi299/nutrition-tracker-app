export const nutrientSnapshotVersion = 1 as const;

// Version 1 is a historical interpretation contract. New codes or different
// units require a new manifest version, rather than editing these definitions.
const definitions = [
  ["energy_kcal", "kcal", "core", "calories"],
  ["protein_g", "g", "core", "protein_g"],
  ["carbohydrates_g", "g", "core", "carbohydrates_g"],
  ["fat_g", "g", "core", "fat_g"],
  ["fiber_g", "g", "additional", null],
  ["sugars_g", "g", "additional", null],
  ["added_sugars_g", "g", "additional", null],
  ["saturated_fat_g", "g", "additional", null],
  ["monounsaturated_fat_g", "g", "additional", null],
  ["polyunsaturated_fat_g", "g", "additional", null],
  ["trans_fat_g", "g", "additional", null],
  ["cholesterol_mg", "mg", "additional", null],
  ["sodium_mg", "mg", "minerals", null],
  ["potassium_mg", "mg", "minerals", null],
  ["calcium_mg", "mg", "minerals", null],
  ["iron_mg", "mg", "minerals", null],
  ["magnesium_mg", "mg", "minerals", null],
  ["phosphorus_mg", "mg", "minerals", null],
  ["zinc_mg", "mg", "minerals", null],
  ["copper_mg", "mg", "minerals", null],
  ["manganese_mg", "mg", "minerals", null],
  ["selenium_ug", "ug", "minerals", null],
  ["vitamin_a_rae_ug", "ug", "vitamins", null],
  ["vitamin_c_mg", "mg", "vitamins", null],
  ["vitamin_d_ug", "ug", "vitamins", null],
  ["vitamin_e_mg", "mg", "vitamins", null],
  ["vitamin_k_ug", "ug", "vitamins", null],
  ["thiamin_mg", "mg", "vitamins", null],
  ["riboflavin_mg", "mg", "vitamins", null],
  ["niacin_mg", "mg", "vitamins", null],
  ["pantothenic_acid_mg", "mg", "vitamins", null],
  ["vitamin_b6_mg", "mg", "vitamins", null],
  ["folate_dfe_ug", "ug", "vitamins", null],
  ["vitamin_b12_ug", "ug", "vitamins", null],
  ["choline_mg", "mg", "vitamins", null],
] as const;

export type NutrientCode = (typeof definitions)[number][0];
export type CoreNutrientCode = "energy_kcal" | "protein_g" | "carbohydrates_g" | "fat_g";
export type AdditionalNutrientCode = Exclude<NutrientCode, CoreNutrientCode>;
export type CoreNutrientField = "calories" | "protein_g" | "carbohydrates_g" | "fat_g";
export type NutrientUnit = (typeof definitions)[number][1];
export type NutrientGroup = (typeof definitions)[number][2];

export type NutrientDefinition = Readonly<{
  code: NutrientCode;
  unit: NutrientUnit;
  group: NutrientGroup;
  coreField: CoreNutrientField | null;
  precision: 0 | 2 | 4;
  maximum: string;
}>;

export const nutrientManifestV1: readonly NutrientDefinition[] = Object.freeze(
  definitions.map(([code, unit, group, coreField]) => Object.freeze({
    code,
    unit,
    group,
    coreField,
    precision: code === "energy_kcal" ? 0 as const : coreField ? 2 as const : 4 as const,
    maximum: code === "energy_kcal" ? "2147483647" : coreField ? "999999.99" : "9999999999.9999",
  })),
);

export const nutrientCodesV1: readonly NutrientCode[] = Object.freeze(
  nutrientManifestV1.map(({ code }) => code),
);
export const additionalNutrientCodesV1: readonly AdditionalNutrientCode[] = Object.freeze(
  nutrientManifestV1.filter(({ coreField }) => coreField === null)
    .map(({ code }) => code as AdditionalNutrientCode),
);
export const coreNutrientCodesV1: readonly CoreNutrientCode[] = Object.freeze(
  nutrientManifestV1.filter(({ coreField }) => coreField !== null)
    .map(({ code }) => code as CoreNutrientCode),
);

export function getNutrientDefinitionV1(code: string): NutrientDefinition | undefined {
  return nutrientManifestV1.find((definition) => definition.code === code);
}
