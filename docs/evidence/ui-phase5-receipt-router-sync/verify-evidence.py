#!/usr/bin/env python3
"""Read-only SHA-256 inventory and receipt-lifecycle semantic verifier (stdlib only)."""
import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path, PurePosixPath
import re
from urllib.parse import parse_qs, urlsplit

TASK = "UI_PHASE_5_RECEIPT_RETIREMENT_ROUTER_SYNC_001"
BASE = "804a7579e450bac78c2a0d4472335a6e1049eabd"
TREE = "4e8b50202e3a81d9fd27d62e793b645856ddd3cc"
FORM = "components/custom-foods/custom-food-form.tsx"
TEST = "e2e/custom-food-receipt-retirement.spec.ts"
BASE_FORM = "e2d0bc871f410364cb62e3bee371b67491facc6d9c4386828eb10851d246fb88"
FINAL_FORM = "35863c5d8f5c2290898e3353903b46f89e2029de7c714687d4f4977227bc028b"
FINAL_TEST = "b8c76d545785855aa917c364800937603f343673d11f7bb149d81b6f6a7ef88a"
PAIRS = {(engine, locale) for engine in ("chromium", "firefox", "webkit") for locale in ("en", "he")}
R4_NAMES = {"missing", "invalid-uuid", "repeated", "mismatched-valid", "updated-notice", "matching-created", "unsupported-query"}

def digest(data):
    return sha256(data).hexdigest()

def query(url):
    return parse_qs(urlsplit(url).query, keep_blank_values=True)

def require(condition, message):
    if not condition:
        raise ValueError(message)

def summary(requests):
    counts = Counter((r["phase"], r["kind"], r["method"], r["prefetch"], r["action"], "creationRequest" in query(r["url"]), urlsplit(r["url"]).path == "/favicon.ico") for r in requests)
    return [{"phase": key[0], "kind": key[1], "method": key[2], "prefetch": key[3], "action": key[4], "containsReceipt": key[5], "favicon": key[6], "count": n} for key, n in sorted(counts.items())]

def compact_record(raw, source_class, reference):
    """Drop duplicate DOM href arrays and unrelated GET prefetch detail, retaining classifications."""
    food_ids = {r["foodId"] for r in raw["records"] if "foodId" in r}
    food_paths = {"/foods/custom/" + value + "/edit" for value in food_ids}
    for r in raw["records"]:
        if r["kind"] == "receipt-validation":
            food_paths.add(urlsplit(r["state"]["url"]).path[3:])
    def relevant(r):
        return r["method"] != "GET" or r["action"] or (not r["prefetch"] and any(path in urlsplit(r["url"]).path for path in food_paths))
    def trim(value):
        if isinstance(value, list):
            return [trim(x) for x in value]
        if isinstance(value, dict):
            result = {}
            for key, item in value.items():
                if key == "rawHrefs":
                    continue
                if key in ("requests", "settlingRequests"):
                    result[key] = [r for r in item if relevant(r)]
                    if any(not relevant(r) for r in item):
                        result[key + "OmittedClassifications"] = summary([r for r in item if not relevant(r)])
                else:
                    result[key] = trim(item)
            return result
        return value
    records = trim(raw["records"])
    locale = raw["records"][0]["locale"]
    return {"sourceClass": source_class, "rawRecord": reference, "timestampUtc": raw["timestampUtc"],
            "browser": raw["browser"], "locale": locale, "result": raw["result"],
            "expectedStatus": raw["expectedStatus"], "assertionErrorCount": len(raw["assertionErrors"]),
            "consoleOrHydrationErrors": raw["errors"], "records": records,
            "scopedRequests": [r for r in raw["requests"] if relevant(r)],
            "allRequestClassifications": summary(raw["requests"]),
            "omittedBackgroundGetClassifications": summary([r for r in raw["requests"] if not relevant(r)])}

def one(cell, kind):
    rows = [r for r in cell["records"] if r["kind"] == kind]
    require(len(rows) == 1, "Expected one " + kind)
    return rows[0]

def cell_common(cell, expected_result):
    require(cell["result"] == expected_result and cell["expectedStatus"] == "passed", "Unexpected test outcome")
    require(not cell["consoleOrHydrationErrors"], "Console/hydration error")
    require(cell["assertionErrorCount"] == (3 if expected_result == "failed" else 0), "Unexpected assertion count")
    for req in cell["scopedRequests"]:
        require(not urlsplit(req["url"]).scheme and not urlsplit(req["url"]).netloc, "Nonlocal request")
    for row in cell["omittedBackgroundGetClassifications"]:
        require(row["method"] == "GET" and not row["action"] and (row["prefetch"] or (row["kind"] == "image" and row["favicon"] and not row["containsReceipt"])), "Omitted request outside documented background GET scope")
    all_count = sum(x["count"] for x in cell["allRequestClassifications"])
    omitted_count = sum(x["count"] for x in cell["omittedBackgroundGetClassifications"])
    require(all_count == len(cell["scopedRequests"]) + omitted_count, "Request inventory count mismatch")

def assert_hrefs(state, food_id, saved, receipt=None):
    expected = [{"locale": loc, "href": f"/{loc}/foods/custom/{food_id}/edit?saved={saved}" + ("&creationRequest=" + receipt if receipt else "")} for loc in ("en", "he")]
    require(state["hrefs"] == expected, "Rendered href context mismatch")

def assert_id(url, food_id):
    require(re.fullmatch(r"/(en|he)/foods/custom/" + re.escape(food_id) + r"/edit", urlsplit(url).path) is not None, "Food identity changed")

def verify_hydrated(cell, corrected):
    cell_common(cell, "passed" if corrected else "failed")
    start = one(cell, "genuine-success-retirement")
    draft = one(cell, "draft-and-editor-preservation")
    final = one(cell, "final-invariants")
    food_id = start["foodId"]
    require(start["initialReceiptPresent"], "Missing genuine redirect receipt")
    receipt = query(start["initialRedirect"])["creationRequest"][0]
    require(start["initialPathnameAndQuery"] == f'/{cell["locale"]}/foods/custom/new', "Not a genuine Create entry")
    assert_id(start["initialRedirect"], food_id)
    require(query(start["initialRedirect"])["saved"] == ["created"], "Saved notice absent from redirect")
    require(start["afterCreateCounts"] == [n + 1 for n in start["beforeCounts"]], "Duplicate/missing food or receipt")
    require("creationRequest" not in query(start["afterRetirement"]["url"]), "Receipt not retired")
    assert_hrefs(start["afterRetirement"], food_id, "created", None if corrected else receipt)
    require(start["afterRetirement"]["historyMarkers"]["appRouter"] and start["afterRetirement"]["historyMarkers"]["routerTree"], "Next history state lost")
    require(draft["cleanup"] == {"matchingRemoved": True, "unrelatedRetained": True}, "Draft scope changed")
    require(draft["editorMounts"] == 1 and draft["documentTokenPreserved"], "Editor remount/document reload")
    require(final["foodId"] == food_id == final["receiptFoodId"], "Created/receipt food ID mismatch")
    fingerprint = start["acceptedFingerprint"]
    require(draft["databaseSha256"] == fingerprint == final["databaseBeforeSha256"] == final["databaseAfterSha256"], "Application database mutated")
    require(final["explicitActionCount"] == 1, "Additional Server Action")
    actions = [r for r in cell["scopedRequests"] if r["action"] and r["method"] == "POST"]
    require(len(actions) == 1 and actions[0]["phase"] == "explicit-create", "Unexpected Server Action request")
    require(final["unsavedValuesRetained"] and final["editorNodeRetained"] and final["noExtraHistoryEntry"], "Editor/history preservation failed")
    assert_hrefs(final["subsequentQuery"], food_id, "updated")
    navs = [r for r in cell["records"] if r["kind"] == "actual-locale-navigation"]
    require(len(navs) == 2, "Missing bidirectional actual locale clicks")
    expected_locales = ["he" if cell["locale"] == "en" else "en", cell["locale"]]
    require([r["destinationLocale"] for r in navs] == expected_locales, "Locale roundtrip incomplete")
    forwarded = 0
    for nav in navs:
        assert_id(nav["href"], food_id); assert_id(nav["destination"], food_id)
        require(nav["databaseSha256"] == fingerprint, "Locale click mutated application rows")
        require(query(nav["settled"]["url"]) == {"saved": ["created"]}, "Settled URL incorrect")
        actual = [r for r in nav["requests"] if not r["prefetch"]]
        require(actual and all(r["kind"] == "App-Router-RSC" and r["method"] == "GET" and not r["action"] for r in actual), "Unexpected actual navigation class")
        forwarded += sum("creationRequest" in query(r["url"]) for r in actual)
        if corrected:
            require("creationRequest" not in query(nav["href"]), "Retired receipt in actual href")
            assert_hrefs(nav["settled"], food_id, "created")
    require(forwarded == (0 if corrected else 2), "Actual click forwarding mismatch")
    if corrected:
        barrier = one(cell, "pre-locale-click-barrier")
        require(barrier["hrefsCoherent"] and barrier["phase"] == "after-hrefs-coherent", "No coherence barrier")
        require(all(r["prefetch"] for r in barrier["settlingRequests"]), "Unexpected cleanup navigation/revalidation")
        traversals = [r for r in cell["records"] if r["kind"] == "history-traversal"]
        require([r["direction"] for r in traversals] == ["back", "forward"], "Missing history traversal")
        for row in traversals:
            require(row["documentTokenPreserved"] and row["databaseSha256"] == fingerprint, "History reload/write")
            require(not any(r["kind"] == "document-navigation" for r in row["requests"]), "History document reload")
            assert_id(row["state"]["url"], food_id)
            assert_hrefs(row["state"], food_id, "created")

def verify_native(cell):
    cell_common(cell, "passed")
    start = one(cell, "native-success"); final = one(cell, "native-final")
    food_id = start["foodId"]; receipt = query(start["initialRedirect"])["creationRequest"][0]
    require(start["initialReceiptPresent"] and final["foodId"] == food_id, "Native creation identity missing")
    assert_id(start["initialRedirect"], food_id)
    assert_hrefs(start["state"], food_id, "created", receipt)
    require(start["databaseSha256"] == final["databaseBeforeSha256"] == final["databaseAfterSha256"], "Native application mutation")
    navs = [r for r in cell["records"] if r["kind"] == "native-locale-navigation"]
    require(len(navs) == 2, "Missing native roundtrip")
    for row in navs:
        assert_id(row["href"], food_id); assert_id(row["destination"], food_id)
        require(query(row["destination"])["creationRequest"] == [receipt], "Unretired native receipt removed")
        assert_hrefs(row["state"], food_id, "created", receipt)
    posts = [r for r in cell["scopedRequests"] if r["method"] == "POST"]
    require(len(posts) == 1 and posts[0]["phase"] == "native-create", "Unexpected native submission")
    require(all(r["kind"] == "document-navigation" for r in cell["scopedRequests"]), "Native navigation class changed")

def verify_r4(cell):
    cell_common(cell, "passed")
    require(len(cell["records"]) == 7 and {r["case"] for r in cell["records"]} == R4_NAMES, "R4 cases incomplete")
    require(not any(r["method"] != "GET" or r["action"] for r in cell["scopedRequests"]), "R4 unexpected action")
    fingerprints = set()
    for row in cell["records"]:
        require(row["kind"] == "receipt-validation" and row["assertionsPassed"], "R4 assertion failure")
        require(row["matchingRemoved"] == (row["case"] in ("matching-created", "unsupported-query")), "R4 draft cleanup rule changed")
        require(urlsplit(row["state"]["url"]).query == row["expectedQuery"], "R4 URL rule changed")
        require(row["databaseBeforeSha256"] == row["databaseAfterSha256"], "R4 application mutation")
        fingerprints.add(row["databaseBeforeSha256"])
        food_id = urlsplit(row["state"]["url"]).path.split("/")[4]
        assert_hrefs(row["state"], food_id, "updated" if row["case"] == "updated-notice" else "created")
    require(len(fingerprints) == 1, "R4 fixture changed between cases")

def expand_packet(packet):
    require(packet.get("encoding") == "shared-strings-and-keys-v1", "Unknown compact encoding")
    strings = packet["stringTable"]
    keys = packet["keyTable"]
    require(all(isinstance(x, str) for x in keys), "Invalid shared key table")
    def expand_key(key):
        if key.startswith("~"):
            require(key[1:].isdigit() and int(key[1:]) < len(keys), "Invalid shared key reference")
            return keys[int(key[1:])]
        return key
    require(all(isinstance(x, str) for x in strings), "Invalid shared string table")
    def expand(value):
        if isinstance(value, dict) and set(value) == {"$"}:
            key = value["$"]
            require(type(key) is int and 0 <= key < len(strings), "Invalid shared string reference")
            return strings[key]
        if isinstance(value, dict):
            return {expand_key(key): expand(item) for key, item in value.items()}
        if isinstance(value, list):
            return [expand(item) for item in value]
        return value
    return expand(packet["evidence"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--print-expanded", action="store_true", help="Print the verified expanded evidence JSON instead of its verification summary")
    parser.add_argument("--external-root", type=Path, help="Optionally rehash and compare original raw records under the task output root")
    parser.add_argument("--repository-root", type=Path, help="Optionally verify final production/test file hashes in a checkout")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    manifest = json.loads((root / "evidence-manifest.json").read_text())
    artifacts = manifest["artifacts"]; listed = [x["path"] for x in artifacts]
    require(len(listed) == len(set(listed)), "Duplicate manifest path")
    require(not any(p.is_symlink() for p in root.rglob("*")), "Packet symlinks are not accepted")
    actual = {str(p.relative_to(root)) for p in root.rglob("*") if p.is_file() and p != root / "evidence-manifest.json"}
    require(actual == set(listed), "Exhaustive inventory mismatch")
    for artifact in artifacts:
        rel = PurePosixPath(artifact["path"])
        require(not rel.is_absolute() and ".." not in rel.parts, "Unsafe manifest path")
        payload = (root / artifact["path"]).read_bytes()
        require(len(payload) == artifact["sizeBytes"] and digest(payload) == artifact["sha256"], "Payload hash/size mismatch: " + artifact["path"])
    data = expand_packet(json.loads((root / "before-after.json").read_text()))
    require(data["taskId"] == TASK, "Task mismatch")
    require(data["sources"]["baseline"]["head"] == BASE and data["sources"]["baseline"]["tree"] == TREE, "Baseline identity mismatch")
    require(data["sources"]["baseline"]["fileSha256"][FORM] == BASE_FORM, "Baseline source file mismatch")
    require(data["sources"]["baseline"]["productionDiffSha256"] == digest(b""), "Baseline tracked production differs")
    require(data["sources"]["baseline"]["testSha256"] == "94d7d901417800301f3fb47453b2efc8ca942430f517ee3f55147fbf347c3a5c", "Baseline test identity differs")
    require(data["sources"]["candidate"]["baseHead"] == BASE and data["sources"]["candidate"]["baseTree"] == TREE, "Candidate base mismatch")
    require(data["sources"]["candidate"]["sourceState"] == "uncommitted candidate; base tree is not the corrected tree", "Dirty source qualification absent")
    require(data["sources"]["candidate"]["fileSha256"][FORM] == FINAL_FORM and data["sources"]["candidate"]["testSha256"] == FINAL_TEST, "Final source hash mismatch")
    require(data["sources"]["candidate"]["productionDiffSha256"] == "7f5c44ddc311b9b16978f5c2099bb80e4f61a3d39106db6bc5e92285e9fa6ab9", "Final production diff identity differs")
    for path, value in data["sources"]["baseline"]["fileSha256"].items():
        if path != FORM:
            require(data["sources"]["candidate"]["fileSha256"][path] == value, "Protected source changed: " + path)
    for stage, expected, unexpected in [("baselineHydrated", 0, 6), ("baselineNative", 6, 0), ("candidateFocused", 18, 0)]:
        stats = data["executionStages"][stage]["resultStats"]
        require(stats["expected"] == expected and stats["unexpected"] == unexpected and stats["skipped"] == 0 and stats["flaky"] == 0, "Reporter totals differ: " + stage)
    external_references = {}
    def references(value):
        if isinstance(value, dict):
            if {"relativePath", "sha256", "sizeBytes"}.issubset(value):
                rel = PurePosixPath(value["relativePath"])
                require(not rel.is_absolute() and ".." not in rel.parts, "Unsafe external reference")
                prior = external_references.setdefault(value["relativePath"], value)
                require(prior == value, "Inconsistent external reference")
            for item in value.values():
                references(item)
        elif isinstance(value, list):
            for item in value:
                references(item)
    references(data)
    if args.external_root:
        for ref in external_references.values():
            payload = (args.external_root / ref["relativePath"]).read_bytes()
            require(len(payload) == ref["sizeBytes"] and digest(payload) == ref["sha256"], "External reference hash/size mismatch: " + ref["relativePath"])
    groups = [("baselineHydrated", "baseline", lambda c: verify_hydrated(c, False)), ("candidateHydrated", "candidate", lambda c: verify_hydrated(c, True)), ("baselineNative", "baseline", verify_native), ("candidateNative", "candidate", verify_native), ("candidateR4", "candidate", verify_r4)]
    external_count = 0
    for name, source_class, check in groups:
        rows = data[name]
        require(len(rows) == 6 and {(r["browser"]["engine"], r["locale"]) for r in rows} == PAIRS, "Engine/locale matrix incomplete: " + name)
        for cell in rows:
            require(cell["sourceClass"] == source_class, "Cell source mismatch")
            check(cell)
            if args.external_root:
                ref = cell["rawRecord"]; path = args.external_root / ref["relativePath"]
                payload = path.read_bytes()
                require(len(payload) == ref["sizeBytes"] and digest(payload) == ref["sha256"], "Original record mismatch")
                raw = json.loads(payload)
                require(compact_record(raw, source_class, ref) == cell, "Compact record differs from original")
                expected = data["sources"][source_class]
                require(raw["source"]["fileSha256"] == expected["fileSha256"] and raw["source"]["buildId"] == expected["buildId"], "Original source binding differs")
                require(raw["source"]["head"] == (expected["head"] if source_class == "baseline" else expected["baseHead"]) and raw["source"]["tree"] == (expected["tree"] if source_class == "baseline" else expected["baseTree"]) and raw["source"]["productionDiffSha256"] == expected["productionDiffSha256"], "Original commit/tree/diff identity differs")
                external_count += 1
    if args.repository_root:
        for path, expected in [(FORM, FINAL_FORM), (TEST, FINAL_TEST)]:
            require(digest((args.repository_root / path).read_bytes()) == expected, "Repository source mismatch: " + path)
    if args.print_expanded:
        print(json.dumps(data, indent=2))
        return
    print(json.dumps({"integrity": "PASS", "semanticVerification": "PASS", "payloadFiles": len(artifacts), "baselineHydratedFailures": 6, "candidateHydratedPasses": 6, "baselineNativePasses": 6, "candidateNativePasses": 6, "candidateR4Cases": 42, "originalRawRecordsReverified": external_count, "externalReferencedFilesVerified": len(external_references) if args.external_root else 0, "repositorySourceHashesVerified": bool(args.repository_root), "qualification": "This verifies evidence integrity and recorded invariants, not final UI acceptance or unrecorded execution."}, indent=2))

if __name__ == "__main__":
    main()
