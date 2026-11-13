const { launchApp } = require("./launch.cjs");
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

test("Referência por arte e três revisões preservam histórico e aprovação após reiniciar", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aich-stage5-ui-"));
  const image = path.join(root, "referencia-ficticia.png");
  fs.writeFileSync(
    image,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1sAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  let app = await launchApp(root);
  try {
    let page = await app.firstWindow();
    await page.getByRole("button", { name: "Novo cliente" }).click();
    await page
      .getByLabel("Nome do cliente", { exact: true })
      .fill("Cliente histórico");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.getByRole("button", { name: "Novo projeto" }).click();
    await page
      .getByLabel("Nome do projeto", { exact: true })
      .fill("Projeto histórico");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();

    await page.getByRole("tab", { name: "Referências" }).click();
    await page
      .getByLabel("Associar à arte")
      .selectOption({ label: "Projeto histórico" });
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, image);
    await page.getByRole("button", { name: "Adicionar referências" }).click();
    await expect(page.getByText("Arte: Projeto histórico")).toBeVisible();
    fs.unlinkSync(image);

    await page.getByRole("tab", { name: "Modelos e artes" }).click();
    async function revision(instructions, preserve, modify, source) {
      if (source)
        await page
          .getByLabel("Partir de uma revisão")
          .selectOption({ label: source });
      await page.getByLabel("Elementos a preservar").fill(preserve);
      await page.getByLabel("Elementos a modificar").fill(modify);
      await page.getByLabel("Instruções da revisão").fill(instructions);
      await page.getByRole("button", { name: "Criar revisão" }).click();
    }
    await revision("Primeira proposta", "logotipo", "imagem principal");
    await revision("Ajustar enquadramento", "logotipo, cores", "enquadramento");
    await revision(
      "Alternativa da primeira",
      "tipografia",
      "imagem principal",
      "Revisão 1",
    );
    await page
      .locator(".decision")
      .filter({
        has: page.getByRole("heading", { name: "Revisão 2", exact: true }),
      })
      .getByRole("button", { name: "Aprovar revisão" })
      .click();

    await app.close();
    app = await launchApp(root);
    page = await app.firstWindow();
    await page.getByRole("button", { name: /Cliente histórico/ }).click();
    await page.getByRole("button", { name: /Projeto histórico/ }).click();
    await page.getByRole("tab", { name: "Modelos e artes" }).click();
    await expect(
      page.getByRole("heading", { name: "Revisão 1" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Revisão 2" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Revisão 3" }),
    ).toBeVisible();
    await expect(
      page
        .locator(".decision")
        .filter({ hasText: "Revisão 2" })
        .getByText(/Aprovada em/),
    ).toBeVisible();
    await expect(page.getByText("Preservar: logotipo, cores")).toBeVisible();
    await expect(page.getByText("Modificar: enquadramento")).toBeVisible();

    await page.getByRole("tab", { name: "Referências" }).click();
    await expect(
      page.getByRole("img", { name: "referencia-ficticia.png" }),
    ).toBeVisible();
    await expect(page.getByText("Arte: Projeto histórico")).toBeVisible();
    const saved = JSON.parse(
      fs.readFileSync(path.join(root, "workspace", "workspace.json"), "utf8"),
    );
    expect(saved.revisions).toHaveLength(3);
    expect(saved.revisions[1].approvedAt).toBeTruthy();
    expect(saved.references[0].projectId).toBe(saved.projects[0].id);
    expect(saved.references[0].artId).toBe(saved.arts[0].id);
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
