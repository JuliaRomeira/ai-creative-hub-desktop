const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { Store } = require("../electron/store.cjs");
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aich-unit-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  const client = {
    id: randomUUID(),
    name: "Cliente fictício",
    description: "",
    audience: "",
    tone: "",
    colors: "",
    guidelines: "",
  };
  store.update("client", client);
  return { dir, store, client };
}
test("Correções preservam histórico e invalidação não pode ser repetida", (t) => {
  const { store, client } = fixture(t);
  let data = store.update("decision", {
    clientId: client.id,
    campaignId: null,
    text: "Texto antigo",
  });
  const id = data.decisions[0].id;
  data = store.update("correct", {
    id,
    text: "Texto atual",
    reason: "Revisão aprovada",
  });
  assert.equal(data.decisions.length, 2);
  assert.ok(data.decisions[0].invalidatedAt);
  assert.equal(data.decisions[1].replaces, id);
  assert.equal(data.decisions[1].invalidatedAt, null);
  assert.throws(() => store.update("invalidate", { id, reason: "Duplicado" }));
  assert.equal(new Store(path.dirname(store.file)).read().decisions.length, 2);
});
test("Backup inválido não sobrescreve dados; relacionamentos e IDs são validados", (t) => {
  const { dir, store, client } = fixture(t);
  const before = fs.readFileSync(store.file, "utf8");
  const file = path.join(dir, "bad.json");
  fs.writeFileSync(file, "{broken");
  assert.throws(() => store.restore(file));
  assert.equal(fs.readFileSync(store.file, "utf8"), before);
  assert.throws(() =>
    store.update("decision", {
      clientId: randomUUID(),
      campaignId: null,
      text: "Órfão",
    }),
  );
  assert.throws(() =>
    store.write({ ...store.read(), clients: [client, client] }),
  );
  assert.equal(fs.readFileSync(store.file, "utf8"), before);
});
test("Anexos independem do original e sobrevivem ao backup/restauração", (t) => {
  const { dir, store, client } = fixture(t);
  const original = path.join(dir, "exemplo.pdf");
  const content = Buffer.from("%PDF-1.4\nFictício");
  fs.writeFileSync(original, content);
  store.addReferences(client.id, [original]);
  fs.unlinkSync(original);
  const backup = path.join(dir, "backup.json");
  store.export(backup);
  const other = new Store(path.join(dir, "other"));
  other.restore(backup);
  assert.deepEqual(
    Buffer.from(other.read().references[0].data, "base64"),
    content,
  );
  assert.ok(fs.existsSync(store.file + ".previous"));
});
test("Falhas de anexos e versão desconhecida preservam a base inteira", (t) => {
  const { dir, store, client } = fixture(t);
  const before = fs.readFileSync(store.file, "utf8");
  const large = path.join(dir, "large.png");
  fs.writeFileSync(large, Buffer.alloc(10 * 1024 * 1024 + 1));
  assert.throws(() => store.addReferences(client.id, [large]));
  assert.throws(() => store.write({ ...store.read(), version: 2 }));
  assert.equal(fs.readFileSync(store.file, "utf8"), before);
});
test("Restauração guarda snapshot separado que edições posteriores preservam", (t) => {
  const { dir, store, client } = fixture(t);
  const backup = path.join(dir, "backup.json");
  store.export(backup);
  store.update("client", { ...client, name: "Antes de restaurar" });
  store.restore(backup);
  store.update("client", { ...client, name: "Após restaurar" });
  const snapshots = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith("workspace.json.before-restore-"));
  assert.equal(snapshots.length, 1);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(dir, snapshots[0]), "utf8")).clients[0]
      .name,
    "Antes de restaurar",
  );
});
