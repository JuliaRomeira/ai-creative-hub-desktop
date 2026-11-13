const { launchApp } = require("./launch.cjs");
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

test("Aplicativo monta a entrega escolhida sem perder o rascunho", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aich-prompt-"));
  const workspace = path.join(root, "workspace");
  fs.mkdirSync(workspace);
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, "fixtures/legacy-v1.json"), "utf8"),
  );
  data.campaigns[0].request =
    "Proponha cinco páginas e não gere a imagem nesta etapa.";
  fs.writeFileSync(
    path.join(workspace, "workspace.json"),
    JSON.stringify(data),
  );
  const app = await launchApp(root);
  const page = await app.firstWindow();
  page.on("dialog", (dialog) => dialog.accept());
  try {
    await page.getByRole("button", { name: /Marca Legada Fictícia/ }).click();
    await page.getByRole("button", { name: /Campanha legada/ }).click();
    await page.getByRole("tab", { name: "Contexto", exact: true }).click();

    const text = page.getByLabel("Texto do contexto");
    const savedDraft = await text.inputValue();
    await page.getByLabel("Resultado desejado").selectOption("art");
    await expect(text).toHaveValue(savedDraft);
    await page
      .getByRole("button", { name: "Atualizar com dados atuais" })
      .click();
    await expect(text).toHaveValue(/TAREFA PARA A IA/);
    await expect(text).toHaveValue(/Entregue a imagem pronta/);
    await expect(text).toHaveValue(/substitua somente essa instrução/);
    await expect(text).not.toHaveValue(/Regra anterior/);

    await page.getByLabel("Resultado desejado").selectOption("script");
    await page
      .getByRole("button", { name: "Atualizar com dados atuais" })
      .click();
    await expect(text).toHaveValue(/Crie um roteiro de conteúdo/);

    await page.setViewportSize({ width: 850, height: 650 });
    const resultSelect = page.getByLabel("Resultado desejado");
    await resultSelect.focus();
    await expect(resultSelect).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    const legacy = await page.evaluate(() =>
      window.hub.context(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ),
    );
    expect(legacy).toMatch(/^CONTEXTO CRIATIVO/);
    expect(legacy).not.toMatch(/TAREFA PARA A IA/);

    const invalid = await page.evaluate(async () => {
      try {
        await window.hub.context(
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
          "invalid",
        );
        return "aceito";
      } catch (error) {
        return error.message;
      }
    });
    expect(invalid).toMatch(/Resultado desejado inv.lido/);
  } finally {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((window) => window.destroy()),
    );
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
