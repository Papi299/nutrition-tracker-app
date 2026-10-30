// Hand-authored USDA-shaped SYNTHETIC data. These values are not USDA records
// and cannot establish official April source coverage or catalog qualification.
import { deflateRawSync } from "node:zlib";
import { parseFoundationArchive } from "../../ingestion/usda/foundation/parser";
import { fingerprintFull35IdentitySet } from "../../ingestion/usda/foundation/full35/report";
import type { Full35Code } from "../../ingestion/usda/foundation/full35/mapping";

export const directTargets: readonly [Full35Code, number, string, string][] = [
  ["energy_kcal", 2048, "Energy (Atwater Specific Factors)", "kcal"],
  ["protein_g", 1003, "Protein", "g"],
  ["carbohydrates_g", 1005, "Carbohydrate, by difference", "g"],
  ["fat_g", 1004, "Total lipid (fat)", "g"],
  ["fiber_g", 1079, "Fiber, total dietary", "g"],
  ["sugars_g", 1063, "Sugars, Total", "g"],
  ["saturated_fat_g", 1258, "Fatty acids, total saturated", "g"],
  ["monounsaturated_fat_g", 1292, "Fatty acids, total monounsaturated", "g"],
  ["polyunsaturated_fat_g", 1293, "Fatty acids, total polyunsaturated", "g"],
  ["trans_fat_g", 1257, "Fatty acids, total trans", "g"],
  ["cholesterol_mg", 1253, "Cholesterol", "mg"],
  ["sodium_mg", 1093, "Sodium, Na", "mg"],
  ["potassium_mg", 1092, "Potassium, K", "mg"],
  ["calcium_mg", 1087, "Calcium, Ca", "mg"],
  ["iron_mg", 1089, "Iron, Fe", "mg"],
  ["magnesium_mg", 1090, "Magnesium, Mg", "mg"],
  ["phosphorus_mg", 1091, "Phosphorus, P", "mg"],
  ["zinc_mg", 1095, "Zinc, Zn", "mg"],
  ["copper_mg", 1098, "Copper, Cu", "mg"],
  ["manganese_mg", 1101, "Manganese, Mn", "mg"],
  ["selenium_ug", 1103, "Selenium, Se", "µg"],
  ["vitamin_a_rae_ug", 1106, "Vitamin A, RAE", "µg"],
  ["vitamin_c_mg", 1162, "Vitamin C, total ascorbic acid", "mg"],
  ["vitamin_d_ug", 1114, "Vitamin D (D2 + D3)", "µg"],
  ["vitamin_e_mg", 1109, "Vitamin E (alpha-tocopherol)", "mg"],
  ["thiamin_mg", 1165, "Thiamin", "mg"],
  ["riboflavin_mg", 1166, "Riboflavin", "mg"],
  ["niacin_mg", 1167, "Niacin", "mg"],
  ["pantothenic_acid_mg", 1170, "Pantothenic acid", "mg"],
  ["vitamin_b6_mg", 1175, "Vitamin B-6", "mg"],
  ["vitamin_b12_ug", 1178, "Vitamin B-12", "µg"],
  ["choline_mg", 1180, "Choline, total", "mg"],
];

export function syntheticNutrient(id: number, name: string, unitName: string, amount = 1.2345) {
  return { type: "FoodNutrient", nutrient: { id, name, unitName }, amount,
    foodNutrientDerivation: { code: "A", description: "Synthetic reported value" } };
}

export function syntheticFull35Record(fdcId = 9000001) {
  return {
    foodClass: "FinalFood", description: "Synthetic Full35 food", fdcId,
    dataType: "Foundation", publicationDate: "4/30/2026", ndbNumber: fdcId + 1,
    foodNutrients: [
      ...directTargets.map(([, id, name, unit]) => syntheticNutrient(id, name, unit)),
      syntheticNutrient(2047, "Energy (Atwater General Factors)", "kcal", 200.1234),
      { type: "FoodNutrient", nutrient: { id: 2066, name: "Vitamin A", unitName: "µg" } },
    ],
    foodPortions: [{ id: 1, sequenceNumber: 1, amount: 1, gramWeight: 120,
      measureUnit: { id: 1000, name: "cup", abbreviation: "cup" } }],
  };
}

export function syntheticFull35Context(records: unknown[] = [syntheticFull35Record()]) {
  const archive = parseFoundationArchive(JSON.stringify({ FoundationFoods: records }));
  const identities = archive.records.map((r, i) => ({
    fdc_id: String(r.raw.fdcId), raw_content_sha256: r.rawContentSha256,
    source_record_id: `00000000-0000-4000-8000-${String(i * 2 + 1).padStart(12, "0")}`,
    source_version_id: `00000000-0000-4000-8000-${String(i * 2 + 2).padStart(12, "0")}`,
  }));
  const source = {
    source_release_id: "00000000-0000-4000-8000-000000000999",
    manifest_fingerprint: "a".repeat(64), archive_sha256: "b".repeat(64), json_sha256: "c".repeat(64),
    accepted_identity_set_hash: fingerprintFull35IdentitySet(identities),
  };
  return { archive, identities, source };
}

// Minimal independent ZIP fixture writer (stored or deflated); never used by
// production code. Counts/names can be mutated for negative archive tests.
export function syntheticZip(text: string, name = "synthetic.json", deflate = false) {
  const raw = Buffer.from(text), filename = Buffer.from(name);
  let crc = 0xffffffff;
  for (const byte of raw) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const data = deflate ? deflateRawSync(raw) : raw;
  const local = Buffer.alloc(30), central = Buffer.alloc(46), end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(deflate ? 8 : 0, 8);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(filename.length, 26);
  central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt16LE(deflate ? 8 : 0, 10); central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(filename.length, 28);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12); end.writeUInt32LE(local.length + filename.length + data.length, 16);
  return Buffer.concat([local, filename, data, central, filename, end]);
}
