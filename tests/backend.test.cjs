const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { JavaBackend } = require("../electron/java-backend.cjs");
const jar = path.resolve("backend/target/creative-hub-backend.jar");

test("Ponte Java: compatibilidade, pedidos concorrentes, erro e encerramento", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "aich-java-bridge-"));
  fs.copyFileSync(
    "tests/fixtures/legacy-v1.json",
    path.join(folder, "workspace.json"),
  );
  const backend = new JavaBackend(folder, jar);
  try {
    assert.equal(await backend.request("health"), "ready");
    const [first, second] = await Promise.all([
      backend.request("read"),
      backend.request("read"),
    ]);
    assert.deepEqual(first, second);
    const context = await backend.request("context", {
      clientId: first.clients[0].id,
      campaignId: first.campaigns[0].id,
    });
    assert.match(context, /Regra permanente válida/);
    await assert.rejects(
      backend.request("not-supported"),
      /Operação desconhecida/,
    );
    assert.equal(await backend.request("health"), "ready");
    await backend.close();
    assert.ok(backend.closed);
    assert.throws(() => process.kill(backend.child.pid, 0));
    const reopened = new JavaBackend(folder, jar);
    try {
      assert.equal(await reopened.request("health"), "ready");
    } finally {
      await reopened.close();
    }
  } finally {
    await backend.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
test("Java ausente produz mensagem clara sem criar dados", async () => {
  const folder = path.join(os.tmpdir(), "aich-not-created-" + Date.now());
  const backend = new JavaBackend(folder, jar, {
    java: path.join(folder, "missing-java"),
  });
  await assert.rejects(backend.request("health"), /Java 17/);
  assert.equal(fs.existsSync(folder), false);
});
test("Queda do Java rejeita pedidos e permite reabrir os dados", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "aich-java-exit-"));
  const backend = new JavaBackend(folder, jar);
  try {
    await backend.request("health");
    const exit = new Promise((resolve) => backend.child.once("exit", resolve));
    backend.child.kill();
    await exit;
    await assert.rejects(backend.request("read"), /indisponível/);
    const reopened = new JavaBackend(folder, jar);
    try {
      assert.equal((await reopened.request("read")).clients.length, 0);
    } finally {
      await reopened.close();
    }
  } finally {
    await backend.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
