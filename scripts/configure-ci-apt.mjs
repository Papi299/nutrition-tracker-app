import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const official = "https://archive.ubuntu.com/ubuntu/";
const azure = "http://azure.archive.ubuntu.com/ubuntu/";
const security = "https://security.ubuntu.com/ubuntu/";
const indirect = "mirror+file:/etc/apt/apt-mirrors.txt";
const originalMirrors = `${azure}\tpriority:1\n${official}\tpriority:2\n${security}\tpriority:3\n`;
const preferredMirrors = `${azure}\tpriority:2\n${official}\tpriority:1\n${security}\tpriority:3\n`;

// Reject unknown runner layouts before writing. Never reconstruct signing or suite fields.
export function planAptSources(source, mirrors, codename) {
  assert.ok(["noble", "resolute"].includes(codename), "Unsupported Ubuntu codename");
  const stanzas = source.replace(/^\s*#.*$/gm, "").trim().split(/\n\s*\n/);
  const suites = new Set();
  let usesMirror = false;
  let changes = 0;
  for (const stanza of stanzas) {
    const fields = new Map();
    for (const line of stanza.split("\n").filter((value) => value.trim())) {
      const match = line.match(/^([A-Za-z-]+): (\S.*)$/);
      assert.ok(match && !fields.has(match[1]), "Unsupported deb822 field layout");
      fields.set(match[1], match[2]);
    }
    assert.deepEqual([...fields.keys()].sort(), ["Components", "Signed-By", "Suites", "Types", "URIs"], "Unexpected source fields");
    assert.equal(fields.get("Types"), "deb");
    assert.equal(fields.get("Signed-By"), "/usr/share/keyrings/ubuntu-archive-keyring.gpg", "Unexpected signing keyring");
    assert.deepEqual(fields.get("Components").split(/\s+/).sort(), ["main", "multiverse", "restricted", "universe"]);
    for (const suite of fields.get("Suites").split(/\s+/)) {
      assert.ok([codename, `${codename}-updates`, `${codename}-backports`, `${codename}-security`].includes(suite), "Unexpected suite");
      suites.add(suite);
    }
    const uri = fields.get("URIs");
    assert.ok([indirect, azure, official, "http://archive.ubuntu.com/ubuntu/", "http://security.ubuntu.com/ubuntu/", security].includes(uri), "Unexpected Ubuntu source URI");
    usesMirror ||= uri === indirect;
    changes += [azure, "http://archive.ubuntu.com/ubuntu/"].includes(uri) ? 1 : 0;
  }
  assert.deepEqual([...suites].sort(), [codename, `${codename}-backports`, `${codename}-security`, `${codename}-updates`]);
  if (usesMirror) {
    assert.equal(changes, 0, "Mixed direct and mirror archive sources");
    assert.ok(mirrors === originalMirrors || mirrors === preferredMirrors, "Unexpected provider mirror list; no changes applied");
    return { source, mirrors: preferredMirrors, mechanism: "mirror+file; official priority 1, Azure fallback 2, security fallback 3" };
  }
  assert.ok(changes > 0 || /^URIs: https:\/\/archive\.ubuntu\.com\/ubuntu\/$/m.test(source), "No recognized archive source");
  return {
    source: source.replace(/^URIs: http:\/\/(?:azure\.archive|archive)\.ubuntu\.com\/ubuntu\/$/gm, `URIs: ${official}`),
    mirrors,
    mechanism: "direct deb822 URI; separate security URI unchanged",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    assert.equal(process.argv.length, 2, "No configuration overrides are accepted");
    assert.equal(process.arch, "x64", "Only the reviewed x64 runner is supported");
    const os = readFileSync("/etc/os-release", "utf8");
    const version = os.match(/^VERSION_ID="([^"]+)"$/m)?.[1];
    const codename = os.match(/^VERSION_CODENAME=(\w+)$/m)?.[1];
    assert.ok(/^ID=ubuntu$/m.test(os) && ((version === "24.04" && codename === "noble") || (version === "26.04" && codename === "resolute")), "Unsupported runner OS");
    const sourcePath = "/etc/apt/sources.list.d/ubuntu.sources";
    const mirrorPath = "/etc/apt/apt-mirrors.txt";
    const source = readFileSync(sourcePath, "utf8");
    const mirrors = source.includes(indirect) ? readFileSync(mirrorPath, "utf8") : null;
    const plan = planAptSources(source, mirrors, codename);
    if (plan.source !== source) writeFileSync(sourcePath, plan.source);
    if (plan.mirrors !== mirrors) writeFileSync(mirrorPath, plan.mirrors);
    assert.equal(readFileSync(sourcePath, "utf8"), plan.source);
    if (mirrors !== null) assert.equal(readFileSync(mirrorPath, "utf8"), plan.mirrors);
    console.log(`APT routing verified: Ubuntu ${version} (${codename}), ${plan.mechanism}`);
    console.log(plan.source);
    if (mirrors !== null) console.log(plan.mirrors);
  } catch (error) {
    console.error(`::error::Cannot safely configure CI APT routing: ${error.message}`);
    process.exitCode = 1;
  }
}
