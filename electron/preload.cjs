const { contextBridge, ipcRenderer } = require("electron");
const invoke = async (channel, ...args) => {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
contextBridge.exposeInMainWorld("hub", {
  read: () => invoke("read"),
  update: (type, input) => invoke("update", type, input),
  attach: (id) => invoke("attach", id),
  saveReference: (id) => invoke("save-reference", id),
  copy: (text) => invoke("copy", text),
  export: () => invoke("export"),
  import: () => invoke("import"),
});
