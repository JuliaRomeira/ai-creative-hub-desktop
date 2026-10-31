const { test, expect, _electron: electron } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

test("Base corrompida e cancelamento de restauracao preservam dados; backup recupera a base", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aich-recovery-"));
  const workspace = path.join(root, "workspace");
  fs.mkdirSync(workspace);
  const broken = Buffer.from("{broken");
  fs.writeFileSync(path.join(workspace, "workspace.json"), broken);
  const env = {
    ...process.env,
    AICH_TEST_DATA: root,
    AICH_TEST_NODE: process.execPath,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: process.env.AICH_EXECUTABLE ? [] : ["."],
    executablePath: process.env.AICH_EXECUTABLE
      ? path.join(__dirname, "portable-launch.cmd")
      : undefined,
    cwd: path.resolve(__dirname, ".."),
    env,
  });
  try {
    const page = await app.firstWindow();
    if (process.env.AICH_EXECUTABLE)
      expect(
        await app.evaluate(
          ({ app }) => app.isPackaged && !!process.env.PORTABLE_EXECUTABLE_FILE,
        ),
      ).toBe(true);
    await expect(page.getByRole("alert")).toContainText(
      "Os arquivos existentes foram preservados",
    );
    expect(fs.readFileSync(path.join(workspace, "workspace.json"))).toEqual(
      broken,
    );
    await app.evaluate(
      ({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [file],
        });
        dialog.showMessageBox = async () => ({ response: 0 });
      },
      path.join(__dirname, "fixtures/legacy-v1.json"),
    );
    await page.getByRole("button", { name: "Restaurar backup" }).click();
    await expect(
      page.getByRole("button", { name: "Restaurar backup" }),
    ).toBeEnabled();
    expect(fs.readFileSync(path.join(workspace, "workspace.json"))).toEqual(
      broken,
    );
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1 });
    });
    await page.getByRole("button", { name: "Restaurar backup" }).click();
    await expect(
      page.getByText("Backup restaurado com sucesso."),
    ).toBeVisible();
    await page.getByRole("button", { name: /Marca Legada Fictícia/ }).click();
    const snapshot = fs
      .readdirSync(workspace)
      .find((file) => file.startsWith("workspace.json.before-restore-"));
    expect(snapshot).toBeTruthy();
    expect(fs.readFileSync(path.join(workspace, snapshot))).toEqual(broken);
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Fluxo desktop: clientes, decisões, anexos, reinício, cópia e restauração", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aich-e2e-"));
  const profile = path.join(root, "profile");
  const backup = path.join(root, "creative.backup.json");
  const original = path.join(root, "logo-ficticio.png");
  const saved = path.join(root, "logo-restaurado.png");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1sAAAAASUVORK5CYII=",
    "base64",
  );
  fs.writeFileSync(original, png);
  let app;
  let page;
  const errors = [];
  async function launch(folder) {
    const env = {
      ...process.env,
      AICH_TEST_DATA: folder,
      AICH_TEST_NODE: process.execPath,
    };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({
      args: process.env.AICH_EXECUTABLE ? [] : ["."],
      executablePath: process.env.AICH_EXECUTABLE
        ? path.join(__dirname, "portable-launch.cmd")
        : undefined,
      cwd: path.resolve(__dirname, ".."),
      env,
    });
    page = await app.firstWindow();
    if (process.env.AICH_EXECUTABLE)
      expect(
        await app.evaluate(
          ({ app }) => app.isPackaged && !!process.env.PORTABLE_EXECUTABLE_FILE,
        ),
      ).toBe(true);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await expect(
      page.getByRole("button", { name: "Novo cliente", exact: true }),
    ).toBeEnabled();
  }
  async function openDialog(file) {
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, file);
  }
  async function saveDialog(file) {
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, file);
  }
  async function save() {
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  try {
    await launch(profile);
    await page.getByRole("button", { name: "Cadastrar cliente" }).click();
    for (const [label, value] of Object.entries({
      "Nome do cliente": "Ateliê Aurora",
      "Descrição da empresa": "Estúdio fictício de cerâmica artesanal.",
      "Público da marca": "Pessoas que valorizam design e produção artesanal",
      "Tom de comunicação": "Acolhedor, claro e contemporâneo",
      Cores: "Verde oliva, areia e terracota",
      "Orientações da marca":
        "Valorizar texturas naturais. Não prometer peças idênticas.",
    }))
      await page.getByLabel(label, { exact: true }).fill(value);
    await save();
    await page.getByRole("button", { name: "Editar cliente" }).click();
    await page
      .getByLabel("Cores", { exact: true })
      .fill("Verde oliva, areia e terracota suave");
    await save();
    await page.getByRole("tab", { name: "Referências" }).click();
    await openDialog(original);
    await page.getByRole("button", { name: "Adicionar referências" }).click();
    await expect(
      page.getByRole("heading", { name: "logo-ficticio.png" }),
    ).toBeVisible();
    fs.unlinkSync(original);
    await page.getByRole("tab", { name: "Visão geral" }).click();
    await page.getByRole("button", { name: "Nova campanha" }).click();
    for (const [label, value] of Object.entries({
      "Título da campanha": "Coleção Terra · lançamento",
      Objetivo: "Apresentar a nova coleção e convidar para conhecer o ateliê.",
      "Público da campanha": "Pessoas interessadas em decoração afetiva",
      Formato: "Carrossel de Instagram · 5 páginas",
      "Pedido atual":
        "Criar uma proposta de narrativa visual com foco nas texturas das peças.",
    }))
      await page.getByLabel(label, { exact: true }).fill(value);
    await page
      .getByLabel("Status", { exact: true })
      .selectOption("Em andamento");
    await save();
    await page.getByRole("button", { name: "Editar campanha" }).click();
    await page
      .getByLabel("Objetivo", { exact: true })
      .fill("Apresentar a coleção Terra e convidar para visitar o ateliê.");
    await save();
    await page.getByRole("tab", { name: "Decisões" }).click();
    async function addDecision(text, scope) {
      await page.getByRole("button", { name: "Registrar orientação" }).click();
      await page.getByLabel("Aplicar a").selectOption(scope);
      await page.getByLabel("Orientação aprovada").fill(text);
      await save();
    }
    await addDecision("Usar fundo branco puro.", "client");
    await page.getByRole("button", { name: "Corrigir", exact: true }).click();
    await page
      .getByLabel("Orientação aprovada")
      .fill("Preferir fundos areia e luz natural.");
    await page
      .getByLabel("Motivo da alteração")
      .fill("Ajuste aprovado na revisão da marca.");
    await save();
    await addDecision(
      "Mostrar detalhes de textura na segunda página.",
      "campaign",
    );
    await addDecision("Incluir preço na capa.", "campaign");
    await page
      .locator(".decision")
      .filter({ hasText: "Incluir preço na capa." })
      .getByRole("button", { name: "Invalidar", exact: true })
      .click();
    await page
      .getByLabel("Motivo da alteração")
      .fill("Preço será informado na legenda.");
    await save();
    await page.getByRole("tab", { name: "Contexto", exact: true }).click();
    await page
      .getByRole("button", { name: "Atualizar com dados atuais" })
      .click();
    const context = page.getByLabel("Texto do contexto");
    await expect(context).toHaveValue(/CONTEXTO CRIATIVO/);
    const generated = await context.inputValue();
    expect(generated).toContain("Preferir fundos areia");
    expect(generated).toContain("Mostrar detalhes de textura");
    expect(generated).not.toContain("Usar fundo branco");
    expect(generated).not.toContain("Incluir preço na capa");
    expect(generated).toContain("logo-ficticio.png");
    await context.fill(
      generated + "\n\nRevisão manual: sugerir duas alternativas.",
    );
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(
      page.getByText("Rascunho salvo.", { exact: true }),
    ).toBeVisible();
    const previousClipboard = await app.evaluate(({ clipboard }) =>
      clipboard.readText(),
    );
    try {
      await page.getByRole("button", { name: "Copiar contexto" }).click();
      await expect(page.getByText(/Contexto copiado/)).toBeVisible();
      expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(
        generated + "\n\nRevisão manual: sugerir duas alternativas.",
      );
    } finally {
      await app.evaluate(
        ({ clipboard }, value) => clipboard.writeText(value),
        previousClipboard,
      );
    }
    await saveDialog(backup);
    await page.getByRole("button", { name: "Exportar backup" }).click();
    await expect(page.getByText(/Backup exportado/)).toBeVisible();
    await app.close();
    app = null;
    await launch(profile);
    await page.getByRole("button", { name: /AT Ateliê Aurora/ }).click();
    await page.getByRole("tab", { name: "Referências" }).click();
    await expect(
      page.getByRole("img", { name: "logo-ficticio.png", exact: true }),
    ).toBeVisible();
    await saveDialog(saved);
    await page.getByRole("button", { name: "Salvar cópia" }).click();
    await expect(page.getByText(/Referência salva/)).toBeVisible();
    expect(fs.readFileSync(saved)).toEqual(png);
    await page.getByRole("tab", { name: "Visão geral" }).click();
    await page.getByRole("button", { name: /Coleção Terra/ }).click();
    await page.getByRole("tab", { name: "Contexto", exact: true }).click();
    await expect(page.getByLabel("Texto do contexto")).toHaveValue(
      generated + "\n\nRevisão manual: sugerir duas alternativas.",
    );
    fs.mkdirSync(path.resolve("docs"), { recursive: true });
    await page.screenshot({ path: "docs/contexto.png" });
    await page.getByRole("tab", { name: "Visão geral" }).click();
    await page.screenshot({ path: "docs/campanhas.png" });
    await app.close();
    app = null;
    await launch(path.join(root, "restored"));
    await openDialog(backup);
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1 });
    });
    await page.getByRole("button", { name: "Restaurar backup" }).click();
    await expect(
      page.getByText("Backup restaurado com sucesso."),
    ).toBeVisible();
    await page.getByRole("button", { name: /AT Ateliê Aurora/ }).click();
    await page.getByRole("tab", { name: "Referências" }).click();
    await saveDialog(saved);
    await page.getByRole("button", { name: "Salvar cópia" }).click();
    await expect(page.getByText(/Referência salva/)).toBeVisible();
    expect(fs.readFileSync(saved)).toEqual(png);
    await page.getByRole("tab", { name: "Visão geral" }).click();
    await page.getByRole("button", { name: /Coleção Terra/ }).click();
    await page.getByRole("tab", { name: "Decisões" }).click();
    await expect(page.locator(".decision")).toHaveCount(4);
    await expect(page.locator(".decision.invalid")).toHaveCount(2);
    const invalid = path.join(root, "invalid.json");
    fs.writeFileSync(invalid, "{broken");
    await openDialog(invalid);
    await page.getByRole("button", { name: "Restaurar backup" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.locator(".decision")).toHaveCount(4);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(900, 700),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("tab", { name: "Visão geral" }).click();
    await page.getByRole("button", { name: "Nova campanha" }).click();
    await page
      .getByLabel("Título da campanha", { exact: true })
      .fill("Outra campanha fictícia");
    await save();
    await page.getByRole("tab", { name: "Contexto", exact: true }).click();
    await page
      .getByRole("button", { name: "Atualizar com dados atuais" })
      .click();
    await expect(page.getByLabel("Texto do contexto")).toHaveValue(
      /CONTEXTO CRIATIVO/,
    );
    const isolated = await page.getByLabel("Texto do contexto").inputValue();
    expect(isolated).toContain("Preferir fundos areia");
    expect(isolated).not.toContain("Mostrar detalhes de textura");
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(
      page.getByText("Rascunho salvo.", { exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } catch (error) {
    console.log("Renderer errors:", errors);
    if (page && !page.isClosed()) {
      console.log(await page.locator("body").innerText());
      await page.screenshot({ path: "test-results/failure.png" });
    }
    throw error;
  } finally {
    if (app) await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Base 0.1.0 abre sem conversão e cria snapshot ao editar pelo Java", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aich-legacy-ui-"));
  const workspace = path.join(root, "workspace");
  fs.mkdirSync(workspace);
  const original = fs.readFileSync(
    path.join(__dirname, "fixtures/legacy-v1.json"),
  );
  fs.writeFileSync(path.join(workspace, "workspace.json"), original);
  const env = {
    ...process.env,
    AICH_TEST_DATA: root,
    AICH_TEST_NODE: process.execPath,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: process.env.AICH_EXECUTABLE ? [] : ["."],
    executablePath: process.env.AICH_EXECUTABLE
      ? path.join(__dirname, "portable-launch.cmd")
      : undefined,
    cwd: path.resolve(__dirname, ".."),
    env,
  });
  try {
    const page = await app.firstWindow();
    if (process.env.AICH_EXECUTABLE)
      expect(
        await app.evaluate(
          ({ app }) => app.isPackaged && !!process.env.PORTABLE_EXECUTABLE_FILE,
        ),
      ).toBe(true);
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /Marca Legada Fictícia/ }).click();
    await page.getByRole("button", { name: /Campanha legada/ }).click();
    await page.getByRole("tab", { name: "Contexto", exact: true }).click();
    await expect(page.getByLabel("Texto do contexto")).toHaveValue(
      "Rascunho editado na versão anterior.",
    );
    expect(fs.readFileSync(path.join(workspace, "workspace.json"))).toEqual(
      original,
    );
    await page
      .getByRole("button", { name: "Atualizar com dados atuais" })
      .click();
    await expect(page.getByLabel("Texto do contexto")).toHaveValue(
      /Regra permanente válida/,
    );
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(
      page.getByText("Rascunho salvo.", { exact: true }),
    ).toBeVisible();
    expect(
      fs.readFileSync(path.join(workspace, "workspace.json.before-java-v020")),
    ).toEqual(original);
    await page.getByRole("tab", { name: "Referências" }).click();
    await expect(
      page.getByRole("img", { name: "referencia.png", exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Decisões" }).click();
    await expect(page.locator(".decision")).toHaveCount(3);
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
