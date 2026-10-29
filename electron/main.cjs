const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  clipboard,
  session,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { Store } = require("./store.cjs");
if (process.env.AICH_TEST_DATA)
  app.setPath("userData", process.env.AICH_TEST_DATA);
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
let win;
const page = pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
if (locked)
  app.whenReady().then(() => {
    const store = new Store(path.join(app.getPath("userData"), "workspace"));
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
    handle("read", () => store.read());
    handle("update", (type, input) => store.update(type, input));
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
        : store.addReferences(clientId, result.filePaths);
    });
    handle("save-reference", async (id) => {
      const ref = store.read().references.find((x) => x.id === id);
      if (!ref) throw new Error("Referência não encontrada.");
      const result = await dialog.showSaveDialog(win, {
        defaultPath: path.basename(ref.name),
      });
      if (result.canceled) return false;
      fs.writeFileSync(result.filePath, Buffer.from(ref.data, "base64"));
      return true;
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
      store.export(result.filePath);
      return true;
    });
    handle("import", async () => {
      const result = await dialog.showOpenDialog(win, {
        properties: ["openFile"],
        filters: [{ name: "Backup JSON", extensions: ["json"] }],
      });
      if (result.canceled) return null;
      store.readFile(result.filePaths[0]);
      const confirm = await dialog.showMessageBox(win, {
        type: "warning",
        message: "Restaurar este backup?",
        detail:
          "Os dados atuais serão substituídos. Uma cópia de segurança local será preservada automaticamente.",
        buttons: ["Cancelar", "Restaurar"],
        defaultId: 0,
        cancelId: 0,
      });
      return confirm.response === 1 ? store.restore(result.filePaths[0]) : null;
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
