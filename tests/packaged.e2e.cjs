const { launchApp, packaged } = require("./launch.cjs");
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

test("Aplicativo empacotado usa Java incluído e preserva dados sem Java externo", async () => {
  test.skip(!packaged, "Informe o executável empacotado em AICH_EXECUTABLE.");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aich-packaged-qa-"));
  const workspace = path.join(root, "workspace");
  fs.mkdirSync(workspace);
  const original = fs.readFileSync(
    path.join(__dirname, "fixtures/legacy-v1.json"),
  );
  fs.writeFileSync(path.join(workspace, "workspace.json"), original);
  let app;
  const rendererErrors = [];
  async function launch() {
    app = await launchApp(root);
    const runtimeRoot = await app.evaluate(() =>
      require("node:path").join(process.resourcesPath, "runtime"),
    );
    expect(
      fs.existsSync(path.join(runtimeRoot, "legal/java.base/LICENSE")),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(runtimeRoot, "legal/java.base/ADDITIONAL_LICENSE_INFO"),
      ),
    ).toBe(true);
    const source = JSON.parse(
      fs.readFileSync(path.join(runtimeRoot, "SOURCE.json"), "utf8"),
    );
    expect(source.sourceUrl).toMatch(
      /^https:\/\/github\.com\/adoptium\/temurin17-binaries\//,
    );
    const page = await app.firstWindow();
    page.on("pageerror", (error) => rendererErrors.push(error.message));
    page.on("dialog", async (dialog) => {
      if (dialog.type() !== "beforeunload") await dialog.accept();
    });
    await expect(
      page.getByRole("button", { name: "Novo cliente", exact: true }),
    ).toBeEnabled();
    return page;
  }
  try {
    let page = await launch();
    await page.getByRole("button", { name: /Marca Legada Fictícia/ }).click();
    expect(fs.readFileSync(path.join(workspace, "workspace.json"))).toEqual(
      original,
    );
    await page.getByRole("button", { name: "Editar cliente" }).click();
    await page
      .getByLabel("Nome do cliente", { exact: true })
      .fill("Cliente fictício sem Java externo");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      fs.readFileSync(path.join(workspace, "workspace.json.before-java-v020")),
    ).toEqual(original);
    await page.getByRole("button", { name: "Nova campanha" }).click();
    await page
      .getByLabel("Título da campanha", { exact: true })
      .fill("Campanha runtime incluído");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("tab", { name: "Contexto", exact: true }).click();
    await page
      .getByRole("button", { name: "Atualizar com dados atuais" })
      .click();
    await expect(page.getByLabel("Texto do contexto")).toHaveValue(
      /Cliente fictício sem Java externo/,
    );
    await page
      .getByLabel("Texto do contexto")
      .fill("Rascunho persistido com Java incluído.");
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(
      page.getByText("Rascunho salvo.", { exact: true }),
    ).toBeVisible();
    await app.close();
    app = null;
    page = await launch();
    await page
      .getByRole("button", { name: /Cliente fictício sem Java externo/ })
      .click();
    await page
      .getByRole("button", { name: /Campanha runtime incluído/ })
      .click();
    await page.getByRole("tab", { name: "Contexto", exact: true }).click();
    await expect(page.getByLabel("Texto do contexto")).toHaveValue(
      "Rascunho persistido com Java incluído.",
    );
    expect(rendererErrors).toEqual([]);
  } finally {
    if (app) {
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().forEach((window) => window.destroy()),
      );
      await app.close();
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});
