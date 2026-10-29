const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  clipboard,
  session,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { JavaBackend } = require("./java-backend.cjs");
if (process.env.AICH_TEST_DATA)
  app.setPath("userData", process.env.AICH_TEST_DATA);
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
let win;
let backend;
let quitting = false;
const page = pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
if (locked)
  app.whenReady().then(async () => {
    const jar = app.isPackaged
      ? path.join(process.resourcesPath, "backend", "creative-hub-backend.jar")
      : path.join(__dirname, "../backend/target/creative-hub-backend.jar");
    backend = new JavaBackend(
      path.join(app.getPath("userData"), "workspace"),
      jar,
    );
    try {
      await backend.request("health");
    } catch (error) {
      dialog.showErrorBox(
        "Não foi possível iniciar o AI Creative Hub",
        error.message,
      );
      app.quit();
      return;
    }
    session.defaultSession.setPermissionRequestHandler(
      (_wc, _permission, callback) => callback(false),
    );
    function handle(name, fn) {
      ipcMain.handle(name, async (event, ...args) => {
        if (event.sender !== win.webContents || event.senderFrame.url !== page)
          throw new Error("Origem não autorizada.");
        try {
          return { ok: true, value: await fn(...args) };
        } catch (error) {
          return {
            ok: false,
            error:
              error.name === "ZodError"
                ? "Dados inválidos. Verifique os campos ou o formato do backup."
                : error.message,
          };
        }
      });
    }
    handle("read", () => backend.request("read"));
    handle("update", (type, input) =>
      backend.request("update", { type, input }),
    );
    handle("context", (clientId, campaignId) =>
      backend.request("context", { clientId, campaignId }),
    );
    handle("attach", async (clientId) => {
      const result = await dialog.showOpenDialog(win, {
        title: "Adicionar referências",
        properties: ["openFile", "multiSelections"],
        filters: [
          {
            name: "Imagens e PDF",
            extensions: ["png", "jpg", "jpeg", "webp", "pdf"],
          },
        ],
      });
      return result.canceled
        ? null
        : backend.request("attach", { clientId, files: result.filePaths });
    });
    handle("save-reference", async (id) => {
      const name = await backend.request("reference-name", { id });
      const result = await dialog.showSaveDialog(win, {
        defaultPath: path.basename(name),
      });
      if (result.canceled) return false;
      return backend.request("save-reference", { id, path: result.filePath });
    });
    handle("copy", (value) => {
      if (typeof value !== "string" || value.length > 200000)
        throw new Error("Texto inválido.");
      clipboard.writeText(value);
      return true;
    });
    handle("export", async () => {
      const result = await dialog.showSaveDialog(win, {
        defaultPath: "creative-hub.backup.json",
        filters: [{ name: "Backup JSON", extensions: ["json"] }],
      });
      if (result.canceled) return false;
      return backend.request("export", { path: result.filePath });
    });
    handle("import", async () => {
      const result = await dialog.showOpenDialog(win, {
        properties: ["openFile"],
        filters: [{ name: "Backup JSON", extensions: ["json"] }],
      });
      if (result.canceled) return null;
      await backend.request("validate-backup", { path: result.filePaths[0] });
      const confirm = await dialog.showMessageBox(win, {
        type: "warning",
        message: "Restaurar este backup?",
        detail:
          "Os dados atuais serão substituídos. Uma cópia de segurança local será preservada automaticamente.",
        buttons: ["Cancelar", "Restaurar"],
        defaultId: 0,
        cancelId: 0,
      });
      return confirm.response === 1
        ? backend.request("import", { path: result.filePaths[0] })
        : null;
    });
    win = new BrowserWindow({
      width: 1320,
      height: 900,
      minWidth: 850,
      minHeight: 650,
      backgroundColor: "#f5f4f0",
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e) => e.preventDefault());
    win.loadURL(page);
  });
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", (event) => {
  if (quitting || !backend) return;
  event.preventDefault();
  quitting = true;
  backend.close().finally(() => app.quit());
});
