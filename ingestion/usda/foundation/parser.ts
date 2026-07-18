import {
  canonicalizeJson,
  deepFreezeJson,
  fingerprintJson,
  isPlainObject,
  type JsonValue,
} from "./canonical-json.ts";
import {
  foundationSafetyBounds,
  foundationSchemaContractHash,
  foundationSchemaContractVersion,
  foundationSchemaPaths,
} from "./contract.ts";

export class FoundationValidationError extends Error {
  readonly category: string;
  readonly scope: "release" | "record";

  constructor(
    category: string,
    message: string,
    scope: "release" | "record" = "release",
  ) {
    super(message);
    this.name = "FoundationValidationError";
    this.category = category;
    this.scope = scope;
  }
}

type ObservedType = "array" | "boolean" | "null" | "number" | "object" | "string";

export type ParsedFoundationRecord = {
  index: number;
  raw: Readonly<Record<string, JsonValue>>;
  rawBytes: number;
  rawContentSha256: string;
};

export type ParsedFoundationArchive = {
  records: readonly ParsedFoundationRecord[];
  collectionEntryCount: number;
  trailingNullPaddingCount: number;
  maximumRawRecordBytes: number;
  observedSchemaFingerprint: string;
  observedSchema: Readonly<Record<string, readonly ObservedType[]>>;
  schemaContractVersion: typeof foundationSchemaContractVersion;
  schemaContractHash: string;
};

function fail(category: string, message: string): never {
  throw new FoundationValidationError(category, message);
}

function jsonType(value: unknown): ObservedType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value as ObservedType;
}

function observeSchema(
  value: unknown,
  path: string,
  observed: Map<string, Set<ObservedType>>,
) {
  const type = jsonType(value);
  const types = observed.get(path) ?? new Set<ObservedType>();
  types.add(type);
  observed.set(path, types);

  if (Array.isArray(value)) {
    for (const item of value) {
      observeSchema(item, `${path}[]`, observed);
    }
  } else if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      observeSchema(child, `${path}.${key}`, observed);
    }
  }
}

function validateSchemaInventory(root: unknown) {
  const observed = new Map<string, Set<ObservedType>>();
  observeSchema(root, "$", observed);

  for (const [path, types] of observed) {
    const expected = foundationSchemaPaths[path];
    if (!expected) {
      fail("schema_contract_mismatch", `Unknown USDA schema path: ${path}.`);
    }

    for (const type of types) {
      if (!expected.includes(type)) {
        fail(
          "schema_contract_mismatch",
          `USDA schema type drift at ${path}: ${type}.`,
        );
      }
    }
  }

  const normalized = Object.fromEntries(
    [...observed]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, types]) => [path, [...types].sort()]),
  ) as Record<string, ObservedType[]>;

  return {
    observedSchema: normalized,
    observedSchemaFingerprint: fingerprintJson(normalized),
  };
}

function scanTopLevelKeys(text: string) {
  const keys: string[] = [];
  let objectDepth = 0;
  let arrayDepth = 0;
  let inString = false;
  let escaping = false;
  let stringStart = -1;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (character === "\\") {
        escaping = true;
      } else if (character === '"') {
        inString = false;
        if (objectDepth === 1 && arrayDepth === 0) {
          let cursor = index + 1;
          while (/\s/.test(text[cursor] ?? "")) cursor += 1;
          if (text[cursor] === ":") {
            keys.push(JSON.parse(text.slice(stringStart, index + 1)) as string);
          }
        }
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      stringStart = index;
    } else if (character === "{") {
      objectDepth += 1;
    } else if (character === "}") {
      objectDepth -= 1;
    } else if (character === "[") {
      arrayDepth += 1;
    } else if (character === "]") {
      arrayDepth -= 1;
    }
  }

  return keys;
}

function expandDecimalLexeme(input: string) {
  const negative = input.startsWith("-");
  const unsigned = negative ? input.slice(1) : input;
  const [coefficient, rawExponent = "0"] = unsigned.toLowerCase().split("e");
  const exponent = Number(rawExponent);
  const [integerPart, fractionalPart = ""] = coefficient.split(".");
  const digits = `${integerPart}${fractionalPart}`;
  const decimalPosition = integerPart.length + exponent;
  let expanded: string;

  if (decimalPosition <= 0) {
    expanded = `0.${"0".repeat(-decimalPosition)}${digits}`;
  } else if (decimalPosition >= digits.length) {
    expanded = `${digits}${"0".repeat(decimalPosition - digits.length)}`;
  } else {
    expanded = `${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
  }

  let [whole, fraction = ""] = expanded.split(".");
  whole = whole.replace(/^0+(?=\d)/, "");
  fraction = fraction.replace(/0+$/, "");
  const normalized = fraction.length > 0 ? `${whole}.${fraction}` : whole;
  return negative && normalized !== "0" ? `-${normalized}` : normalized;
}

export function canonicalDecimal(value: number) {
  if (!Number.isFinite(value)) {
    fail("malformed_target_nutrient", "Nutrient values must be finite.");
  }
  return expandDecimalLexeme(String(Object.is(value, -0) ? 0 : value));
}

function validateExactJsonNumbers(text: string) {
  let inString = false;
  let escaping = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaping) escaping = false;
      else if (character === "\\") escaping = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character !== "-" && (character < "0" || character > "9")) continue;
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
      text.slice(index),
    );
    if (!match) continue;
    const lexeme = match[0];
    const value = Number(lexeme);
    if (!Number.isFinite(value) || expandDecimalLexeme(lexeme) !== canonicalDecimal(value)) {
      fail(
        "exact_decimal_required",
        `JSON number cannot round-trip without decimal drift: ${lexeme}.`,
      );
    }
    index += lexeme.length - 1;
  }
}

function requireRecordShape(record: Record<string, unknown>, index: number) {
  for (const key of [
    "dataType",
    "description",
    "fdcId",
    "foodClass",
    "foodNutrients",
    "publicationDate",
  ]) {
    if (!Object.hasOwn(record, key)) {
      fail("schema_contract_mismatch", `Record ${index} is missing ${key}.`);
    }
  }

  if (
    record.dataType !== "Foundation" ||
    record.foodClass !== "FinalFood" ||
    typeof record.description !== "string" ||
    typeof record.fdcId !== "number" ||
    typeof record.publicationDate !== "string" ||
    !Array.isArray(record.foodNutrients)
  ) {
    fail("schema_contract_mismatch", `Record ${index} has invalid required types.`);
  }
}

export function parseFoundationArchive(
  text: string,
  options: { maximumInputBytes?: number } = {},
): ParsedFoundationArchive {
  const inputBytes = Buffer.byteLength(text, "utf8");
  const maximumInputBytes = Math.min(
    options.maximumInputBytes ?? foundationSafetyBounds.maximumJsonBytes,
    foundationSafetyBounds.maximumJsonBytes,
  );
  if (inputBytes > maximumInputBytes) {
    fail("source_file_size_mismatch", "Foundation JSON exceeds its approved bound.");
  }

  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    fail("malformed_json", "Foundation source is not valid JSON.");
  }
  validateExactJsonNumbers(text);

  if (!isPlainObject(root)) {
    fail("wrong_collection", "Foundation JSON must be a plain top-level object.");
  }

  const lexicalKeys = scanTopLevelKeys(text);
  if (
    lexicalKeys.length !== 1 ||
    lexicalKeys[0] !== "FoundationFoods" ||
    Object.keys(root).length !== 1 ||
    !Object.hasOwn(root, "FoundationFoods")
  ) {
    fail("wrong_collection", "Exactly one FoundationFoods collection is required.");
  }

  const collection = root.FoundationFoods;
  if (!Array.isArray(collection)) {
    fail("wrong_collection", "FoundationFoods must be an array.");
  }

  let firstNull = -1;
  for (let index = 0; index < collection.length; index += 1) {
    if (collection[index] === null) {
      if (firstNull === -1) firstNull = index;
    } else if (firstNull !== -1) {
      fail("schema_contract_mismatch", "Null collection padding must be trailing only.");
    }
  }
  const trailingNullPaddingCount = firstNull === -1 ? 0 : collection.length - firstNull;
  if (trailingNullPaddingCount > foundationSafetyBounds.maximumTrailingNullPadding) {
    fail("schema_contract_mismatch", "Trailing null collection padding exceeds its bound.");
  }

  const rawRecords = collection.slice(
    0,
    firstNull === -1 ? collection.length : firstNull,
  );
  if (
    rawRecords.length < 1 ||
    rawRecords.length > foundationSafetyBounds.maximumRecords
  ) {
    fail("record_count_out_of_bounds", "Foundation record count is outside its bound.");
  }

  const schema = validateSchemaInventory(root);
  let maximumRawRecordBytes = 0;
  const records = rawRecords.map((value, index): ParsedFoundationRecord => {
    if (!isPlainObject(value)) {
      fail("schema_contract_mismatch", `Foundation record ${index} is not an object.`);
    }
    requireRecordShape(value, index);
    const raw = value as Record<string, JsonValue>;
    const serialized = JSON.stringify(raw);
    const rawBytes = Buffer.byteLength(serialized, "utf8");
    if (rawBytes > foundationSafetyBounds.maximumRawRecordBytes) {
      fail("record_size_out_of_bounds", `Foundation record ${index} exceeds its bound.`);
    }
    maximumRawRecordBytes = Math.max(maximumRawRecordBytes, rawBytes);
    deepFreezeJson(raw);

    return {
      index,
      raw,
      rawBytes,
      rawContentSha256: fingerprintJson(raw),
    };
  });

  return {
    records,
    collectionEntryCount: collection.length,
    trailingNullPaddingCount,
    maximumRawRecordBytes,
    observedSchemaFingerprint: schema.observedSchemaFingerprint,
    observedSchema: schema.observedSchema,
    schemaContractVersion: foundationSchemaContractVersion,
    schemaContractHash: foundationSchemaContractHash,
  };
}

export function serializeRawRecord(record: ParsedFoundationRecord) {
  return canonicalizeJson(record.raw as Record<string, JsonValue>);
}
