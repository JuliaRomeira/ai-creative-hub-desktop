const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const {
  runtime,
  verifyArchive,
  verifyRuntime,
} = require("../scripts/prepare-runtime.cjs");

test("Runtime: ZIP corrompido é rejeitado antes de extração", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aich-runtime-hash-"));
  try {
    const archive = path.join(root, "corrupted.zip");
    fs.writeFileSync(
      archive,
      Buffer.from("PK\u0003\u0004conteúdo fictício alterado"),
    );
    assert.throws(() => verifyArchive(archive), /Checksum do JRE inválido/);
    assert.deepEqual(fs.readdirSync(root), ["corrupted.zip"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Runtime gerado: Java 17 reduzido, licenças e módulos executáveis sem Java externo", (t) => {
  const directory = path.resolve(__dirname, "../backend/target/runtime");
  if (!fs.existsSync(directory)) {
    if (process.env.AICH_REQUIRE_RUNTIME)
      assert.fail("Execute npm run prepare:runtime antes desta verificação.");
    return t.skip(
      "Runtime ainda não gerado; o CI exige esta verificação após empacotar.",
    );
  }
  verifyRuntime(directory);
  const source = JSON.parse(
    fs.readFileSync(path.join(directory, "SOURCE.json"), "utf8"),
  );
  assert.equal(source.tool, "jlink");
  assert.equal(source.version, runtime.version);
  assert.equal(source.sha256, runtime.sha256);
  assert.ok(source.modules.includes("jdk.unsupported"));
  const env = {
    SystemRoot: process.env.SystemRoot,
    PATH: path.join(process.env.SystemRoot, "System32"),
    JAVA_HOME: "C:\\aich-no-external-java",
  };
  const result = spawnSync(
    path.join(directory, "bin/java.exe"),
    ["--list-modules"],
    { env, encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /^java.base@17\./m);
  for (const module of source.modules)
    assert.ok(
      result.stdout
        .split(/\r?\n/)
        .some((line) => line.startsWith(module + "@")),
      `Módulo ausente: ${module}`,
    );
  assert.equal(fs.existsSync(path.join(directory, "bin/javac.exe")), false);
});

test("Runtime: versão/arquitetura divergentes são rejeitadas", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aich-runtime-release-"));
  try {
    fs.writeFileSync(
      path.join(root, "release"),
      'JAVA_RUNTIME_VERSION="11.0.0"\nOS_ARCH="aarch64"\nOS_NAME="Windows"\nIMPLEMENTOR="Eclipse Adoptium"\nIMAGE_TYPE="JRE"\n',
    );
    assert.throws(
      () => verifyRuntime(root),
      /Temurin Java 17 fixado para Windows x64/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Runtime: metadados corretos não permitem empacotar runtime incompleto", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "aich-runtime-incomplete-"),
  );
  try {
    fs.writeFileSync(
      path.join(root, "release"),
      `JAVA_RUNTIME_VERSION="${runtime.version}"\nOS_ARCH="x86_64"\nOS_NAME="Windows"\nIMPLEMENTOR="Eclipse Adoptium"\nIMAGE_TYPE="JRE"\n`,
    );
    assert.throws(
      () => verifyRuntime(root),
      /Runtime incompleto: legal\/java.base\/LICENSE ausente/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Runtime: DLL necessária ausente bloqueia empacotamento", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aich-runtime-dll-"));
  try {
    fs.writeFileSync(
      path.join(root, "release"),
      `JAVA_RUNTIME_VERSION="${runtime.version}"\nOS_ARCH="x86_64"\nOS_NAME="Windows"\nIMPLEMENTOR="Eclipse Adoptium"\n`,
    );
    fs.mkdirSync(path.join(root, "legal/java.base"), { recursive: true });
    fs.mkdirSync(path.join(root, "bin"));
    for (const file of [
      "legal/java.base/LICENSE",
      "legal/java.base/ADDITIONAL_LICENSE_INFO",
      "bin/java.exe",
    ])
      fs.writeFileSync(path.join(root, file), "fixture");
    assert.throws(
      () => verifyRuntime(root),
      /Runtime incompleto: bin\/msvcp140.dll ausente/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
