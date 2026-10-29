const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const atomic = require("write-file-atomic");
const { z } = require("zod");
const text = z.string().max(20000);
const id = z.string().uuid();
const date = z.string().datetime();
const client = z.object({
  id,
  name: text.min(1),
  description: text,
  audience: text,
  tone: text,
  colors: text,
  guidelines: text,
});
const campaign = z.object({
  id,
  clientId: id,
  title: text.min(1),
  objective: text,
  audience: text,
  format: text,
  request: text,
  status: z.enum(["Rascunho", "Em andamento", "Aprovada", "Concluída"]),
  draft: z.string().max(200000),
});
const decision = z.object({
  id,
  clientId: id,
  campaignId: id.nullable(),
  text: text.min(1),
  createdAt: date,
  invalidatedAt: date.nullable(),
  reason: text,
  replaces: id.nullable(),
});
const reference = z.object({
  id,
  clientId: id,
  name: z.string().min(1).max(255),
  mime: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"]),
  data: z
    .string()
    .max(14_000_000)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  createdAt: date,
});
const schema = z.object({
  version: z.literal(1),
  clients: z.array(client).max(1000),
  campaigns: z.array(campaign).max(10000),
  decisions: z.array(decision).max(20000),
  references: z.array(reference).max(1000),
});
const empty = () => ({
  version: 1,
  clients: [],
  campaigns: [],
  decisions: [],
  references: [],
});
const MAX_BYTES = 100 * 1024 * 1024;
function validate(value) {
  const data = schema.parse(value);
  const ids = new Set();
  for (const row of [
    ...data.clients,
    ...data.campaigns,
    ...data.decisions,
    ...data.references,
  ]) {
    if (ids.has(row.id)) throw new Error("Identificador duplicado.");
    ids.add(row.id);
  }
  const clients = new Set(data.clients.map((x) => x.id));
  for (const row of [
    ...data.campaigns,
    ...data.decisions,
    ...data.references,
  ]) {
    if (!clients.has(row.clientId))
      throw new Error("Cliente da referência não existe.");
  }
  for (const d of data.decisions) {
    if (
      d.campaignId &&
      !data.campaigns.some(
        (c) => c.id === d.campaignId && c.clientId === d.clientId,
      )
    )
      throw new Error("Campanha da decisão inválida.");
    if (
      d.replaces &&
      !data.decisions.some(
        (p) =>
          p.id === d.replaces &&
          p.clientId === d.clientId &&
          p.campaignId === d.campaignId &&
          p.invalidatedAt,
      )
    )
      throw new Error("Histórico de correção inválido.");
  }
  if (Buffer.byteLength(JSON.stringify(data)) > MAX_BYTES)
    throw new Error("Limite de 100 MB atingido.");
  return data;
}
class Store {
  constructor(folder) {
    fs.mkdirSync(folder, { recursive: true });
    this.file = path.join(folder, "workspace.json");
  }
  read() {
    return fs.existsSync(this.file) ? this.readFile(this.file) : empty();
  }
  readFile(file) {
    if (fs.statSync(file).size > MAX_BYTES)
      throw new Error("Arquivo maior que 100 MB.");
    return validate(JSON.parse(fs.readFileSync(file, "utf8")));
  }
  write(value) {
    const data = validate(value);
    if (fs.existsSync(this.file))
      atomic.sync(this.file + ".previous", fs.readFileSync(this.file));
    atomic.sync(this.file, JSON.stringify(data), { fsync: true });
    return data;
  }
  update(type, input) {
    const data = this.read();
    if (type === "client" || type === "campaign") {
      const list = type === "client" ? data.clients : data.campaigns;
      const parsed = (type === "client" ? client : campaign).parse(input);
      const index = list.findIndex((x) => x.id === parsed.id);
      if (
        type === "campaign" &&
        index >= 0 &&
        list[index].clientId !== parsed.clientId
      )
        throw new Error("Não é possível trocar o cliente da campanha.");
      if (index < 0) list.push(parsed);
      else list[index] = parsed;
    } else if (type === "decision") {
      const d = decision.parse({
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        invalidatedAt: null,
        reason: "",
        replaces: null,
      });
      data.decisions.push(d);
    } else if (type === "invalidate" || type === "correct") {
      const old = data.decisions.find((x) => x.id === input.id);
      if (!old || old.invalidatedAt)
        throw new Error("Esta orientação já não está válida.");
      const reason = text.min(1).parse(input.reason);
      const now = new Date().toISOString();
      old.invalidatedAt = now;
      old.reason = reason;
      if (type === "correct")
        data.decisions.push({
          ...old,
          id: randomUUID(),
          text: text.min(1).parse(input.text),
          createdAt: now,
          invalidatedAt: null,
          reason: "",
          replaces: old.id,
        });
    } else throw new Error("Operação desconhecida.");
    return this.write(data);
  }
  addReferences(clientId, files) {
    const data = this.read();
    const mime = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
    };
    for (const file of files) {
      if (fs.statSync(file).size > 10 * 1024 * 1024)
        throw new Error("Cada referência pode ter até 10 MB.");
      const type = mime[path.extname(file).toLowerCase()];
      if (!type) throw new Error("Use PNG, JPG, WEBP ou PDF.");
      data.references.push({
        id: randomUUID(),
        clientId,
        name: path.basename(file),
        mime: type,
        data: fs.readFileSync(file).toString("base64"),
        createdAt: new Date().toISOString(),
      });
    }
    return this.write(data);
  }
  export(file) {
    atomic.sync(file, JSON.stringify(this.read()));
  }
  restore(file) {
    const data = this.readFile(file);
    // Retain a separate recovery snapshot; subsequent edits cannot overwrite it.
    if (fs.existsSync(this.file))
      atomic.sync(
        this.file + ".before-restore-" + Date.now(),
        fs.readFileSync(this.file),
      );
    return this.write(data);
  }
}
module.exports = { Store, validate, empty };
