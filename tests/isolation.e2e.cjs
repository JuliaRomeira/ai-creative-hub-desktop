const { launchApp } = require("./launch.cjs");
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

test("Resposta de contexto pendente não permite misturar clientes ou perder edição", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aich-isolation-"));
  const directory = path.join(root, "workspace");
  fs.mkdirSync(directory);
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, "fixtures/legacy-v1.json"), "utf8"),
  );
  const otherId = "33333333-3333-4333-8333-333333333333";
  data.clients.push({
    ...data.clients[0],
    id: otherId,
    name: "Outro cliente fictício",
  });
  data.campaigns.push({
    ...data.campaigns[0],
    id: "44444444-4444-4444-8444-444444444444",
    clientId: otherId,
    title: "Campanha isolada B",
    draft: "Rascunho exclusivo B",
  });
  fs.writeFileSync(
    path.join(directory, "workspace.json"),
    JSON.stringify(data),
  );
  const app = await launchApp(root);
  try {
    const page = await app.firstWindow();
    page.on("dialog", async (d) => {
      if (d.type() !== "beforeunload") await d.accept();
    });
    await page.getByRole("button", { name: /Marca Legada Fictícia/ }).click();
    await page.getByRole("button", { name: /Campanha legada/ }).click();
    await page.getByRole("tab", { name: "Contexto", exact: true }).click();
    // Retém apenas a resposta IPC; a gravação do rascunho continua no Java real.
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("context");
      ipcMain.handle(
        "context",
        () =>
          new Promise((resolve) => {
            globalThis.releaseQaContext = () =>
              resolve({ ok: true, value: "CONTEXTO EXCLUSIVO A" });
          }),
      );
    });
    await page
      .getByRole("button", { name: "Atualizar com dados atuais" })
      .click();
    const other = page.getByRole("button", { name: /Outro cliente fictício/ });
    // Exercita a falha também quando a navegação ainda está liberada.
    if (await other.isEnabled()) {
      await other.click();
      await page.getByRole("button", { name: /Campanha isolada B/ }).click();
      await page.getByRole("tab", { name: "Contexto", exact: true }).click();
      await app.evaluate(() => globalThis.releaseQaContext());
      await expect(page.getByLabel("Texto do contexto")).toHaveValue(
        "Rascunho exclusivo B",
      );
      throw new Error("Navegação liberada enquanto há contexto pendente.");
    }
    await expect(other).toBeDisabled();
    await expect(page.getByLabel("Texto do contexto")).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Novo cliente", exact: true }),
    ).toBeDisabled();
    await app.evaluate(() => globalThis.releaseQaContext());
    await expect(page.getByLabel("Texto do contexto")).toHaveValue(
      "CONTEXTO EXCLUSIVO A",
    );
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(
      page.getByText("Rascunho salvo.", { exact: true }),
    ).toBeVisible();
    await other.click();
    await page.getByRole("button", { name: /Campanha isolada B/ }).click();
    await page.getByRole("tab", { name: "Contexto", exact: true }).click();
    await expect(page.getByLabel("Texto do contexto")).toHaveValue(
      "Rascunho exclusivo B",
    );
    const persisted = JSON.parse(
      fs.readFileSync(path.join(directory, "workspace.json"), "utf8"),
    );
    const contextFor = (project) => {
      const art = persisted.arts.find((item) => item.projectId === project.id);
      return persisted.revisions
        .filter((item) => item.artId === art.id)
        .sort((a, b) => b.sequence - a.sequence)[0].generatedContext;
    };
    expect(contextFor(persisted.projects.find((p) => p.clientId === otherId))).toBe(
      "Rascunho exclusivo B",
    );
    expect(contextFor(persisted.projects.find((p) => p.clientId !== otherId))).toBe(
      "CONTEXTO EXCLUSIVO A",
    );
  } finally {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((window) => window.destroy()),
    );
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
