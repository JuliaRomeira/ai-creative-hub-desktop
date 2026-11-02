const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

// Atualize URL e checksum juntos, após conferir a publicação oficial da Adoptium.
const runtime = Object.freeze({
  version: "17.0.20.1+1",
  directory: "jdk-17.0.20.1+1",
  url: "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_x64_windows_hotspot_17.0.20.1_1.zip",
  sourceUrl:
    "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk-sources_17.0.20.1_1.tar.gz",
  sha256: "e53a79c3c3d86865bd7e787903884331068e71321714ffd44f145785affc7cb0",
});
const target = path.resolve(__dirname, "../backend/target");
const destination = path.join(target, "runtime");

function verifyArchive(archive) {
  const digest = crypto
    .createHash("sha256")
    .update(fs.readFileSync(archive))
    .digest("hex");
  if (digest !== runtime.sha256)
    throw new Error(
      "Checksum do JRE inválido. Remova o ZIP em backend/target e execute novamente.",
    );
}

function verifyRuntime(directory) {
  const release = fs.readFileSync(path.join(directory, "release"), "utf8");
  if (
    !release.includes(`JAVA_RUNTIME_VERSION="${runtime.version}"`) ||
    !release.includes('OS_ARCH="x86_64"') ||
    !release.includes('OS_NAME="Windows"') ||
    !release.includes('IMPLEMENTOR="Eclipse Adoptium"')
  )
    throw new Error(
      "O runtime deve ser Temurin Java 17 fixado para Windows x64.",
    );
  for (const name of [
    "legal/java.base/LICENSE",
    "legal/java.base/ADDITIONAL_LICENSE_INFO",
    "bin/java.exe",
    "bin/msvcp140.dll",
    "bin/ucrtbase.dll",
    "bin/vcruntime140.dll",
    "bin/vcruntime140_1.dll",
    "bin/server/jvm.dll",
    "lib/modules",
  ])
    if (!fs.existsSync(path.join(directory, name)))
      throw new Error(`Runtime incompleto: ${name} ausente.`);
  const executable = fs.readFileSync(path.join(directory, "bin/java.exe"));
  const pe = executable.readUInt32LE(0x3c);
  if (
    executable.readUInt32LE(pe) !== 0x00004550 ||
    executable.readUInt16LE(pe + 4) !== 0x8664
  )
    throw new Error("java.exe não é um executável Windows x64.");
}

async function prepareRuntime() {
  if (process.platform !== "win32" || process.arch !== "x64")
    throw new Error("Gere este instalador em Windows x64.");
  fs.mkdirSync(target, { recursive: true });
  const archive = path.join(target, "temurin-jdk-17.0.20.1_1-windows-x64.zip");
  if (!fs.existsSync(archive)) {
    console.log(
      `Baixando Eclipse Temurin JDK ${runtime.version} para gerar o runtime (Windows x64)…`,
    );
    const response = await fetch(runtime.url, {
      signal: AbortSignal.timeout(180000),
    });
    if (!response.ok)
      throw new Error(`Download do JRE falhou: HTTP ${response.status}`);
    const temporary = archive + ".download";
    try {
      fs.writeFileSync(temporary, Buffer.from(await response.arrayBuffer()));
      verifyArchive(temporary);
      fs.renameSync(temporary, archive);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }
  // Verifica também o cache; não reaproveita uma extração que possa ter sido alterada.
  verifyArchive(archive);
  const unpack = fs.mkdtempSync(path.join(target, "runtime-unpack-"));
  try {
    const result = spawnSync(
      path.join(process.env.SystemRoot || "C:\\Windows", "System32/tar.exe"),
      ["-xf", archive, "-C", unpack],
      { stdio: "inherit", windowsHide: true },
    );
    if (result.error || result.status !== 0)
      throw new Error("Não foi possível extrair o JRE com o tar do Windows.");
    const extracted = path.join(unpack, runtime.directory);
    verifyRuntime(extracted);
    const jar = path.join(target, "creative-hub-backend.jar");
    const dependencies = spawnSync(
      path.join(extracted, "bin/jdeps.exe"),
      ["--multi-release", "17", "--print-module-deps", jar],
      { encoding: "utf8", windowsHide: true },
    );
    if (dependencies.error || dependencies.status !== 0)
      throw new Error(
        `Não foi possível analisar os módulos Java: ${dependencies.stderr || dependencies.error}`,
      );
    // Gson usa Unsafe por reflexão; jdeps sozinho não detecta esse acesso.
    const modules = [
      ...new Set([...dependencies.stdout.trim().split(","), "jdk.unsupported"]),
    ].sort();
    if (modules.some((module) => !/^[a-z][a-z0-9.]*$/.test(module)))
      throw new Error("Lista de módulos retornada pelo jdeps inválida.");
    const linked = path.join(unpack, "linked-runtime");
    const resultLink = spawnSync(
      path.join(extracted, "bin/jlink.exe"),
      [
        "--module-path",
        path.join(extracted, "jmods"),
        "--add-modules",
        modules.join(","),
        "--strip-debug",
        "--compress=2",
        "--no-header-files",
        "--no-man-pages",
        "--output",
        linked,
      ],
      { stdio: "inherit", windowsHide: true },
    );
    if (resultLink.error || resultLink.status !== 0)
      throw new Error("Não foi possível gerar o runtime Java com jlink.");
    const linkedRelease = fs.readFileSync(path.join(linked, "release"), "utf8");
    if (
      !linkedRelease.includes(`JAVA_VERSION="${runtime.version.split("+")[0]}"`)
    )
      throw new Error("jlink gerou uma versão Java diferente da esperada.");
    // jlink conserva apenas JAVA_VERSION e MODULES; retenha também a origem verificada.
    const sourceRelease = fs.readFileSync(
      path.join(extracted, "release"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(linked, "release"),
      sourceRelease
        .replace(/^MODULES=.*$/m, linkedRelease.match(/^MODULES=.*$/m)[0])
        .replace(/^IMAGE_TYPE=.*$/m, 'IMAGE_TYPE="JLINK"'),
    );
    verifyRuntime(linked);
    fs.rmSync(destination, { recursive: true, force: true });
    fs.renameSync(linked, destination);
    fs.writeFileSync(
      path.join(destination, "SOURCE.json"),
      JSON.stringify({ ...runtime, tool: "jlink", modules }, null, 2) + "\n",
    );
    console.log(`JRE verificado e preparado em ${destination}`);
  } finally {
    fs.rmSync(unpack, { recursive: true, force: true });
  }
}

module.exports = { runtime, verifyArchive, verifyRuntime, prepareRuntime };
if (require.main === module)
  prepareRuntime().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
