const { launchApp } = require("./launch.cjs");
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

async function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aich-recovery-"));
  fs.mkdirSync(path.join(root, "workspace"));
  fs.copyFileSync(
    path.join(__dirname, "fixtures/legacy-v1.json"),
    path.join(root, "workspace/workspace.json"),
  );
  const app = await launchApp(root);
  return { root, app, page: await app.firstWindow() };
}
async function dispose({ app, root }) {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
  );
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
}

test("Cancelar saída com rascunho mantém Java e permite salvar sem reabrir", async () => {
  const f = await fixture();
  try {
    await f.page.getByRole("button", { name: /Marca Legada Fictícia/ }).click();
    await f.page.getByRole("button", { name: /Campanha legada/ }).click();
    await f.page.getByRole("tab", { name: "Contexto", exact: true }).click();
    await f.page
      .getByLabel("Texto do contexto")
      .fill("Rascunho preservado após cancelar saída.");
    await f.app.evaluate(({ app }) => {
      const load = process
        .getBuiltinModule("module")
        .createRequire(app.getAppPath() + "/package.json");
      const { JavaBackend } = load("./electron/java-backend.cjs");
      const original = JavaBackend.prototype.request;
      JavaBackend.prototype.request = function (...args) {
        globalThis.qaBackend = this;
        return original.apply(this, args);
      };
    });
    await f.page.evaluate(() => window.hub.read());
    await f.app.evaluate(
      ({ app, BrowserWindow }) =>
        new Promise((resolve) => {
          BrowserWindow.getAllWindows()[0].webContents.once(
            "will-prevent-unload",
            () => resolve(),
          );
          app.quit();
        }),
    );
    const backendState = await f.app.evaluate(() => ({
      closed: globalThis.qaBackend.closed,
      killed: globalThis.qaBackend.child.killed,
      exited: globalThis.qaBackend.child.exitCode,
    }));
    expect(backendState).toEqual({
      closed: false,
      killed: false,
      exited: null,
    });
    await expect(f.page.getByLabel("Texto do contexto")).toHaveValue(
      "Rascunho preservado após cancelar saída.",
    );
    await f.page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(
      f.page.getByText("Rascunho salvo.", { exact: true }),
    ).toBeVisible();
    const saved = JSON.parse(
      fs.readFileSync(path.join(f.root, "workspace/workspace.json"), "utf8"),
    );
    const art = saved.arts.find((item) => item.projectId === saved.projects[0].id);
    const latest = saved.revisions
      .filter((item) => item.artId === art.id)
      .sort((a, b) => b.sequence - a.sequence)[0];
    expect(latest.generatedContext).toBe(
      "Rascunho preservado após cancelar saída.",
    );
  } finally {
    await dispose(f);
  }
});

test("Queda do Java recupera na próxima operação sem duplicar decisões", async () => {
  const f = await fixture();
  try {
    await f.app.evaluate(({ app }) => {
      const load = process
        .getBuiltinModule("module")
        .createRequire(app.getAppPath() + "/package.json");
      const { JavaBackend } = load("./electron/java-backend.cjs");
      const original = JavaBackend.prototype.request;
      JavaBackend.prototype.request = function (...args) {
        globalThis.qaBackend = this;
        return original.apply(this, args);
      };
    });
    const initial = await f.page.evaluate(() => window.hub.read());
    const decision = {
      clientId: initial.clients[0].id,
      campaignId: null,
      text: "Orientação única antes da queda",
    };
    await f.page.evaluate(
      (input) => window.hub.update("decision", input),
      decision,
    );
    await f.app.evaluate(
      () =>
        new Promise((resolve) => {
          globalThis.qaBackend.child.once("exit", resolve);
          globalThis.qaBackend.child.kill();
        }),
    );
    const edited = {
      ...initial.clients[0],
      name: "Cliente preservado após recuperação",
    };
    await f.page.evaluate(
      (input) => window.hub.update("client", input),
      edited,
    );
    const saved = await f.page.evaluate(() => window.hub.read());
    const recoveredRuntime = await f.app.evaluate(({ app }) => ({
      packaged: app.isPackaged,
      executable: globalThis.qaBackend.child.spawnfile,
      resources: process.resourcesPath,
    }));
    if (recoveredRuntime.packaged) {
      expect(recoveredRuntime.executable.toLowerCase()).toBe(
        path
          .join(recoveredRuntime.resources, "runtime/bin/java.exe")
          .toLowerCase(),
      );
    }
    expect(saved.clients[0]).toEqual(edited);
    expect(
      saved.decisions.filter((d) => d.text === decision.text),
    ).toHaveLength(1);
    expect(saved.decisions).toHaveLength(initial.decisions.length + 1);
    expect(saved.references).toEqual(initial.references);
    expect(saved.campaigns).toEqual(initial.campaigns);
  } finally {
    await dispose(f);
  }
});

test("Mutação interrompida não é repetida automaticamente ao reconectar", async () => {
  const f = await fixture();
  try {
    const initial = await f.page.evaluate(() => window.hub.read());
    await f.app.evaluate(({ app }) => {
      const load = process
        .getBuiltinModule("module")
        .createRequire(app.getAppPath() + "/package.json");
      const { JavaBackend } = load("./electron/java-backend.cjs");
      const original = JavaBackend.prototype.request;
      globalThis.qaMutationCalls = 0;
      globalThis.qaBackends = new Set();
      JavaBackend.prototype.request = function (method, ...args) {
        globalThis.qaBackends.add(this);
        const result = original.call(this, method, ...args);
        if (method === "update" && ++globalThis.qaMutationCalls === 1)
          this.child.kill();
        return result;
      };
    });
    const result = await f.page.evaluate(async (clientId) => {
      try {
        await window.hub.update("decision", {
          clientId,
          campaignId: null,
          text: "Mutação interrompida",
        });
        return "unexpected-success";
      } catch (error) {
        return error.message;
      }
    }, initial.clients[0].id);
    expect(result).toContain("A operação não foi confirmada");
    const [first, second] = await f.page.evaluate(() =>
      Promise.all([window.hub.read(), window.hub.read()]),
    );
    expect(first).toEqual(second);
    expect(
      first.decisions.filter((d) => d.text === "Mutação interrompida").length,
    ).toBeLessThanOrEqual(1);
    const transport = await f.app.evaluate(() => ({
      calls: globalThis.qaMutationCalls,
      backends: globalThis.qaBackends.size,
    }));
    expect(transport).toEqual({ calls: 1, backends: 2 });
    expect(first.clients).toEqual(initial.clients);
    expect(first.references).toEqual(initial.references);
  } finally {
    await dispose(f);
  }
});
