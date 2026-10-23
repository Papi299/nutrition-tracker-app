import assert from "node:assert/strict";
import test from "node:test";
import { planAptSources } from "./configure-ci-apt.mjs";

const mirrors = "http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\nhttps://archive.ubuntu.com/ubuntu/\tpriority:2\nhttps://security.ubuntu.com/ubuntu/\tpriority:3\n";
function sources(codename, uri) {
  return `# Ubuntu archive\nTypes: deb\nURIs: ${uri}\nSuites: ${codename} ${codename}-updates ${codename}-backports\nComponents: main restricted universe multiverse\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n\n# Security remains enabled\nTypes: deb\nURIs: http://security.ubuntu.com/ubuntu/\nSuites: ${codename}-security\nComponents: main restricted universe multiverse\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n`;
}

for (const codename of ["noble", "resolute"]) {
  test(`${codename}: effective mirror priority changes without changing any deb822 bytes`, () => {
    const source = sources(codename, "mirror+file:/etc/apt/apt-mirrors.txt");
    const plan = planAptSources(source, mirrors, codename);
    assert.equal(plan.source, source);
    assert.equal(plan.mirrors, mirrors.replace("priority:1", "priority:2").replace("ubuntu/\tpriority:2\nhttps://security", "ubuntu/\tpriority:1\nhttps://security"));
    assert.deepEqual(planAptSources(plan.source, plan.mirrors, codename), plan);
  });
  test(`${codename}: direct archive changes only its URI, with signing/security/suites intact`, () => {
    const source = sources(codename, "http://azure.archive.ubuntu.com/ubuntu/");
    const plan = planAptSources(source, null, codename);
    assert.equal(plan.source, source.replace("http://azure.archive.ubuntu.com/ubuntu/", "https://archive.ubuntu.com/ubuntu/"));
    assert.equal(plan.mirrors, null);
    assert.deepEqual(planAptSources(plan.source, null, codename), plan);
  });
}

test("unknown layouts and signing, security-suite or fallback drift fail before mutation", () => {
  const source = sources("noble", "mirror+file:/etc/apt/apt-mirrors.txt");
  for (const [changedSource, changedMirrors, codename] of [
    [source, mirrors, "unknown"],
    [source.replace("noble-security", "noble-updates"), mirrors, "noble"],
    [source.replace("ubuntu-archive-keyring.gpg", "unreviewed.gpg"), mirrors, "noble"],
    [source.replace("Types: deb", "Trusted: yes\nTypes: deb"), mirrors, "noble"],
    [source.replace("Types: deb", "Types: deb\nTypes: deb"), mirrors, "noble"],
    [source.replace("main restricted universe multiverse", "main"), mirrors, "noble"],
    [source.replace("mirror+file:/etc/apt/apt-mirrors.txt", "mirror+file:/tmp/other"), mirrors, "noble"],
    [source, mirrors.replace("priority:1", "priority:0"), "noble"],
    [source, mirrors.replace("https://archive", "http://archive"), "noble"],
    [source, mirrors.replace("https://security.ubuntu.com/ubuntu/\tpriority:3\n", ""), "noble"],
    [source, null, "noble"],
  ]) assert.throws(() => planAptSources(changedSource, changedMirrors, codename));
});
