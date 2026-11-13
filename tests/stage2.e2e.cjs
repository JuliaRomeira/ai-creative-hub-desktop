const { launchApp } = require("./launch.cjs");
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

test("Projetos, modelos, artes e revisões persistem após reiniciar", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aich-stage2-ui-"));
  let app = await launchApp(root);
  try {
    let page = await app.firstWindow();
    await page.getByRole("button", { name: "Cadastrar cliente" }).click();
    await page.getByLabel("Nome do cliente", { exact: true }).fill("Cliente fictício");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.getByRole("tab", { name: "Visão geral" }).click();
    await page.getByRole("button", { name: "Novo projeto" }).click();
    await page.getByLabel("Nome do projeto", { exact: true }).fill("Projeto Instagram");
    await page.getByLabel("Formato", { exact: true }).fill("Post quadrado");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();

    await page.getByRole("tab", { name: "Modelos e artes" }).click();
    await page.getByLabel("Nome do modelo").fill("Modelo social");
    await page.getByLabel("Formato", { exact: true }).last().fill("1080 x 1080");
    await page.getByLabel("Instruções do modelo").fill("Margem segura");
    await page.getByRole("button", { name: "Criar modelo" }).click();
    await expect(page.locator('.campaign-card input[name="name"][value="Modelo social"]')).toBeVisible();

    await page.getByLabel("Título da arte").fill("Post de lançamento");
    await page.locator('select[name="templateId"]').selectOption({ label: "Modelo social" });
    await page.getByLabel("Briefing").fill("Apresentar a coleção fictícia");
    await page.getByRole("button", { name: "Criar arte" }).click();
    await page.getByRole("button", { name: /Post de lançamento/ }).click();
    await page.getByLabel("Elementos a preservar").fill("logotipo, cores");
    await page.getByLabel("Elementos a modificar").fill("imagem principal");
    await page.getByLabel("Instruções da revisão").fill("Trocar somente a imagem");
    await page.getByLabel("Contexto registrado").fill("Contexto da revisão 1");
    await page.getByRole("button", { name: "Criar revisão" }).click();
    await page.getByLabel("Partir de uma revisão").selectOption({ label: "Revisão 1" });
    await page.getByLabel("Instruções da revisão").fill("Ajustar o enquadramento");
    await page.getByRole("button", { name: "Criar revisão" }).click();
    await page.locator(".decision").filter({ hasText: "Revisão 1" })
      .getByRole("button", { name: "Aprovar revisão" }).click();

    await app.close();
    app = await launchApp(root);
    page = await app.firstWindow();
    await page.getByRole("button", { name: /Cliente fictício/ }).click();
    await page.getByRole("button", { name: /Projeto Instagram/ }).click();
    await page.getByRole("tab", { name: "Modelos e artes" }).click();
    await expect(page.getByRole("button", { name: /Post de lançamento/ })).toBeVisible();
    await page.getByRole("button", { name: /Post de lançamento/ }).click();
    await expect(page.getByRole("heading", { name: "Revisão 1" })).toBeVisible();
    await expect(page.getByText(/Aprovada em/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Revisão 2" })).toBeVisible();

    const saved = JSON.parse(
      fs.readFileSync(path.join(root, "workspace", "workspace.json"), "utf8"),
    );
    expect(saved.version).toBe(2);
    expect(saved.projects).toHaveLength(1);
    expect(saved.arts).toHaveLength(2);
    expect(saved.templates).toHaveLength(1);
    expect(saved.revisions.filter((revision) => revision.artId === saved.arts[1].id)).toHaveLength(2);
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
