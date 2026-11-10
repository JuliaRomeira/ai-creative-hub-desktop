const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
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
      campaignId: first.projects[0].id,
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

test("Java incluído ausente pede reparação sem recorrer ao Java externo nem criar dados", async () => {
  const folder = path.join(os.tmpdir(), "aich-missing-bundled-" + Date.now());
  const backend = new JavaBackend(folder, jar, {
    java: path.join(folder, "runtime/bin/java.exe"),
    bundled: true,
  });
  await assert.rejects(backend.request("health"), /Java incluído.*Reinstale/);
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

test("Ponte Java persiste projeto, modelo, arte e revisões após reabrir", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "aich-stage2-"));
  const clientId = randomUUID();
  const projectId = randomUUID();
  const templateId = randomUUID();
  const artId = randomUUID();
  let firstRevisionId;
  const backend = new JavaBackend(folder, jar);
  try {
    await backend.request("update", {
      type: "client",
      input: { id: clientId, name: "Cliente fictício", description: "", audience: "", tone: "", colors: "", guidelines: "" },
    });
    await backend.request("update", {
      type: "project",
      input: { id: projectId, clientId, title: "Projeto fictício", objective: "Teste", audience: "", status: "Em andamento" },
    });
    await backend.request("update", {
      type: "template",
      input: { id: templateId, name: "Post", format: "1080 x 1080", instructions: "Margem segura" },
    });
    await backend.request("update", {
      type: "art",
      input: { id: artId, projectId, title: "Arte fictícia", format: "", briefing: "Briefing", templateId, templateName: "", templateInstructions: "" },
    });
    const first = await backend.request("update", {
      type: "revision",
      input: { artId, sourceRevisionId: null, instructions: "Primeira", preserveElements: ["logotipo"], modifyElements: ["imagem"], generatedContext: "Contexto 1" },
    });
    firstRevisionId = first.revisions[0].id;
    await backend.request("update", {
      type: "revision-from",
      input: { artId, sourceRevisionId: firstRevisionId, instructions: "Segunda", preserveElements: ["logotipo"], modifyElements: ["imagem"], generatedContext: "Contexto 2" },
    });
    await backend.close();

    const reopened = new JavaBackend(folder, jar);
    try {
      const data = await reopened.request("read");
      assert.equal(data.version, 2);
      assert.equal(data.projects[0].id, projectId);
      assert.equal(data.arts[0].templateName, "Post");
      assert.equal(data.arts[0].templateInstructions, "Margem segura");
      assert.deepEqual(data.revisions.map((revision) => revision.sequence), [1, 2]);
      assert.equal(data.revisions[1].sourceRevisionId, firstRevisionId);
    } finally {
      await reopened.close();
    }
  } finally {
    await backend.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
