const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

test("Java inventory includes nested files and skips directory junctions without looping", { skip: process.platform !== "win32", timeout: 30000 }, (t) => {
  const temporary = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "aich-java-inventory-")));
  const root = path.join(temporary, "scan");
  const outside = path.join(temporary, "outside");
  fs.mkdirSync(path.join(root, "jdk/bin"), { recursive: true });
  fs.mkdirSync(outside);
  const expected = [path.join(root, "java.exe"), path.join(root, "jdk/bin/java.exe")].sort();
  for (const file of [...expected, path.join(outside, "java.exe")]) fs.writeFileSync(file, "fictitious executable");
  fs.writeFileSync(path.join(root, "not-java.exe"), "not Java");
  const env = {
    ...process.env,
    AICH_INVENTORY_ROOT: root,
    AICH_INVENTORY_HELPER: path.resolve(__dirname, "../scripts/find-java.ps1"),
  };
  function run(command) {
    return JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command], { env, encoding: "utf8", windowsHide: true }).trim());
  }
  // ConvertTo-Json cannot mix Write-Host progress with the data stream.
  const scan = "@(& $env:AICH_INVENTORY_HELPER -Root $env:AICH_INVENTORY_ROOT 6>$null) | ConvertTo-Json -Compress";
  try {
    const previous = run("@(Get-ChildItem -LiteralPath $env:AICH_INVENTORY_ROOT -Filter java.exe -File -Recurse -Force | ForEach-Object FullName) | ConvertTo-Json -Compress");
    assert.deepEqual(previous.sort(), expected);
    assert.deepEqual(run(scan).sort(), expected);
    fs.mkdirSync(path.join(root, "file-alias"));
    const fileAlias = path.join(root, "file-alias/java.exe");
    try {
      fs.symlinkSync(expected[0], fileAlias, "file");
      expected.push(fileAlias);
      expected.sort();
    } catch (error) {
      if (error.code !== "EPERM") throw error;
      t.diagnostic("File symlink requires elevation/Developer Mode; directory junction coverage remains active.");
    }
    fs.symlinkSync(root, path.join(root, "loop"), "junction");
    fs.symlinkSync(outside, path.join(root, "outside-alias"), "junction");
    assert.deepEqual(run(scan).sort(), expected);
  } finally {
    for (const link of ["loop", "outside-alias"]) {
      const target = path.join(root, link);
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
