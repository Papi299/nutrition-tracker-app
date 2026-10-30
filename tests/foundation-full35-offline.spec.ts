import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { foundationSafetyBounds, foundationSchemaContractVersion, foundationRejectPolicyVersion } from "@/ingestion/usda/foundation/contract";
import { sha256Bytes } from "@/ingestion/usda/foundation/dry-run";
import { extractFoundationFull35Json } from "@/ingestion/usda/foundation/full35/archive";
import { runFoundationFull35DryRun } from "@/ingestion/usda/foundation/full35/dry-run";
import { FoundationValidationError, parseFoundationArchive } from "@/ingestion/usda/foundation/parser";
import { createFoundationFull35Report } from "@/ingestion/usda/foundation/full35/report";
import { syntheticFull35Context, syntheticFull35Record, syntheticZip } from "./fixtures/foundation-full35";

function syntheticOffline(deflate = true) {
  const record = syntheticFull35Record();
  const jsonText = JSON.stringify({ FoundationFoods: [record, null, null] });
  const archiveBytes = syntheticZip(jsonText, "synthetic.json", deflate);
  const context = syntheticFull35Context([record]);
  return {
    archiveBytes, expectedJsonSha256: sha256Bytes(Buffer.from(jsonText)),
    sourceReleaseId: context.source.source_release_id, identities: context.identities,
    manifest: {
      contract_version: "source-release-manifest/v1", source_code: "usda", dataset_code: "usda_fdc_foundation",
      distributor_code: "usda_fdc_direct", transformation_code: null,
      original_release_identifier: "synthetic-full35-april", transformation_release_identifier: null,
      publication_date: "2026-04-30", acquisition_method: "official_bulk_download",
      official_url: "https://fdc.nal.usda.gov/download-datasets/", authorized_delivery_url: "https://fdc.nal.usda.gov/synthetic.zip",
      license_identifier: "CC0-1.0", attribution: "Synthetic fixture; not an official USDA record or coverage result.",
      file_format: "json", schema_contract_version: foundationSchemaContractVersion,
      archive_name: "synthetic.zip", sha256: sha256Bytes(archiveBytes), compressed_size: archiveBytes.length,
      uncompressed_size: Buffer.byteLength(jsonText), approval_reference: "synthetic-unapproved",
      reject_policy_version: foundationRejectPolicyVersion,
    },
  };
}

test("F35-14: ZIP custody binds manifest, member, JSON, raw record and v3 report", () => {
  const json = JSON.stringify({ FoundationFoods: [syntheticFull35Record()] });
  for (const deflate of [false, true]) {
    expect(extractFoundationFull35Json(syntheticZip(json, "synthetic.json", deflate), "synthetic.json")).toBe(json);
  }
  {
    const input = syntheticOffline(), result = runFoundationFull35DryRun(input);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].source_identity).toMatchObject({ archive_sha256: input.manifest.sha256, json_sha256: input.expectedJsonSha256 });
    expect(result.accepted[0].record_identity).toEqual(input.identities[0]);
    expect(result.report.trailing_null_collection_entry_count).toBe(2);
    expect(result.report).toMatchObject({ executable: false, qualification_status: "offline_unapproved", accepted_count: 1, rejected_count: 0 });
    expect(result.report.report_fingerprint).toBe(runFoundationFull35DryRun(input).report.report_fingerprint);
    expect(Buffer.byteLength(JSON.stringify(result.accepted[0]))).toBeLessThan(foundationSafetyBounds.maximumCandidateBytes);
  }
});

test("F35-14: archive digest, size, JSON digest, member and source identities fail closed", () => {
  const input = syntheticOffline();
  for (const change of [
    { archiveBytes: Buffer.from("wrong bytes") }, { expectedJsonSha256: "f".repeat(64) },
    { sourceReleaseId: "not-a-uuid" },
    { manifest: { ...input.manifest, archive_name: "different.zip" } },
    { manifest: { ...input.manifest, sha256: "f".repeat(64) } },
    { manifest: { ...input.manifest, compressed_size: input.archiveBytes.length + 1 } },
    { manifest: { ...input.manifest, uncompressed_size: input.manifest.uncompressed_size + 1 } },
    { manifest: { ...input.manifest, publication_date: "2026-10-31" } },
    { manifest: { ...input.manifest, authorized_delivery_url: "https://fdc.nal.usda.gov.evil.example/synthetic.zip" } },
    { manifest: { ...input.manifest, schema_contract_version: "usda-fdc-foundation-json/v2" } },
  ]) expect(() => runFoundationFull35DryRun({ ...input, ...change })).toThrow(FoundationValidationError);
  const substituted = runFoundationFull35DryRun({ ...input, identities: [] });
  expect(substituted.report.qualification_status).toBe("blocked");
  expect(substituted.rejected[0].category).toBe("accepted_set_mismatch");
});

test("F35-14: traversal, duplicate members, encryption, unsupported compression and corruption rejected", () => {
  for (const name of ["../synthetic.json", "/synthetic.json", "folder/synthetic.json", "synthetic\\file.json"]) {
    expect(() => extractFoundationFull35Json(syntheticZip("{}", name), "synthetic.json")).toThrow();
  }
  const base = syntheticZip("{}");
  const mutate = (offset: number, value: number, size: 2 | 4) => {
    const zip = Buffer.from(base);
    if (size === 2) zip.writeUInt16LE(value, offset); else zip.writeUInt32LE(value, offset);
    return zip;
  };
  for (const zip of [
    mutate(base.length - 22 + 10, 2, 2), // duplicate entry declaration
    mutate(6, 1, 2), // encrypted flag
    mutate(8, 99, 2), // unsupported compression
    mutate(14, 123, 4), // local/central CRC conflict
    mutate(0, 0, 4), // invalid local signature
    base.subarray(0, base.length - 1),
    Buffer.concat([base, Buffer.from("trailing garbage")]),
  ]) expect(() => extractFoundationFull35Json(zip, "synthetic.json")).toThrow();
  const corrupt = Buffer.from(base); corrupt[30 + Buffer.byteLength("synthetic.json")] ^= 1;
  expect(() => extractFoundationFull35Json(corrupt, "synthetic.json")).toThrow();
  expect(() => extractFoundationFull35Json(Buffer.alloc(foundationSafetyBounds.maximumArchiveBytes + 1), "synthetic.json")).toThrow();
  const bomb = syntheticZip("x".repeat(foundationSafetyBounds.maximumJsonBytes + 1), "synthetic.json", true);
  expect(() => extractFoundationFull35Json(bomb, "synthetic.json")).toThrow();
});

test("F35-14: unchanged schema, raw-record bounds, exact numbers and trailing padding remain strict", () => {
  const record = syntheticFull35Record();
  for (const records of [[{ ...record, unexpected: 1 }], [record, null, record], [record, ...Array.from({ length: 65 }, () => null)]]) {
    expect(() => parseFoundationArchive(JSON.stringify({ FoundationFoods: records }))).toThrow();
  }
  expect(() => parseFoundationArchive(JSON.stringify({ FoundationFoods: [{ ...record, description: "x".repeat(foundationSafetyBounds.maximumRawRecordBytes) }] }))).toThrow();
  const text = JSON.stringify({ FoundationFoods: [record] }).replace('"amount":1.2345', '"amount":9007199254740993');
  expect(() => parseFoundationArchive(text)).toThrow("round-trip");
  const ctx = syntheticFull35Context();
  expect(() => createFoundationFull35Report({ ...ctx, archive: { ...ctx.archive, schemaContractHash: "f".repeat(64) } })).toThrow();
});

test("pure Full35 modules have no database, network, environment or executor dependency", () => {
  const modules = ["archive", "contract", "dry-run", "exclusion-reconciliation", "mapping", "normalization", "report"];
  for (const moduleName of modules) {
    const text = readFileSync(`ingestion/usda/foundation/full35/${moduleName}.ts`, "utf8");
    expect(text).not.toMatch(/(?:process\.env|fetch\(|createClient\(|node:child_process|node:fs|@supabase|promote-local|lifecycle\/execution)/);
  }
});
