const { launchApp } = require("./launch.cjs");
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

test("Fluxo real cria arte com modelo, inicia revisão e gera contexto na janela mínima", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aich-stage4-ui-"));
  const app = await launchApp(root);
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(850, 650),
    );

    const newClient = page.getByRole("button", { name: "Novo cliente" });
    await newClient.click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(newClient).toBeFocused();
    await newClient.click();
    await page
      .getByLabel("Nome do cliente", { exact: true })
      .fill("Estúdio fictício");
    await page.getByLabel("Cores").fill("Azul e branco");
    await page
      .getByLabel("Orientações da marca")
      .fill("Manter logotipo e tipografia");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();

    await page.getByRole("button", { name: "Novo projeto" }).click();
    await page
      .getByLabel("Nome do projeto", { exact: true })
      .fill("Projeto Instagram");
    await page.getByLabel("Objetivo").fill("Apresentar coleção");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.getByRole("tab", { name: "Modelos e artes" }).click();

    await page.getByLabel("Nome do modelo").fill("Post editorial");
    await page
      .getByLabel("Formato", { exact: true })
      .last()
      .fill("1080 x 1350");
    await page.getByLabel("Instruções do modelo").fill("Hierarquia clara");
    await page.getByRole("button", { name: "Criar modelo" }).click();
    await page.getByLabel("Título da arte").fill("Publicação principal");
    await page
      .locator('select[name="templateId"]')
      .selectOption({ label: "Post editorial" });
    await page.getByLabel("Briefing").fill("Destacar o produto fictício");
    await page.getByRole("button", { name: "Criar arte" }).click();

    await page
      .getByLabel("Elementos a preservar")
      .fill("cores, logotipo, tipografia");
    await page.getByLabel("Elementos a modificar").fill("imagem principal");
    await page
      .getByLabel("Instruções da revisão")
      .fill("Trocar somente a imagem principal");
    await page.getByRole("button", { name: "Criar revisão" }).click();
    await page.getByRole("tab", { name: "Contexto", exact: true }).click();
    await page.getByLabel("Arte").selectOption({ label: "Publicação principal" });
    await expect(page.getByLabel("Revisão")).toHaveValue(/.+/);
    await page
      .getByRole("button", { name: "Atualizar com dados atuais" })
      .click();

    const context = page.getByLabel("Texto do contexto");
    await expect(context).toHaveValue(/PROJETO — Projeto Instagram/);
    await expect(context).toHaveValue(/MODELO DA ARTE\nNome: Post editorial/);
    await expect(context).toHaveValue(/Modificar: imagem principal/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(page.getByText("Rascunho salvo.", { exact: true })).toBeVisible();
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
