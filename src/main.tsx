import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Client, Campaign, Decision, Workspace } from "./types";
import "./style.css";

const clientFields = {
  name: "Nome do cliente",
  description: "Descrição da empresa",
  audience: "Público da marca",
  tone: "Tom de comunicação",
  colors: "Cores",
  guidelines: "Orientações da marca",
};
const campaignFields = {
  title: "Título da campanha",
  objective: "Objetivo",
  audience: "Público da campanha",
  format: "Formato",
  request: "Pedido atual",
};
const date = (value: string) => new Date(value).toLocaleString("pt-BR");
type Modal =
  | { kind: "client"; value: Client }
  | { kind: "campaign"; value: Campaign }
  | { kind: "decision"; value?: Decision; action?: "correct" | "invalidate" };
function App() {
  const [data, setData] = useState<Workspace>();
  const [clientId, setClientId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [tab, setTab] = useState("Visão geral");
  const [modal, setModal] = useState<Modal>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<string>();
  const [search, setSearch] = useState("");
  const client = data?.clients.find((c) => c.id === clientId);
  const campaign = data?.campaigns.find(
    (c) => c.id === campaignId && c.clientId === clientId,
  );
  useEffect(() => {
    window.hub
      .read()
      .then(setData)
      .catch((e) =>
        setError(
          `Não foi possível abrir os dados: ${e.message}. Os arquivos existentes foram preservados.`,
        ),
      );
  }, []);
  useEffect(() => {
    if (!modal && !preview) return;
    const previous = document.activeElement as HTMLElement;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    function keys(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        setModal(undefined);
        setPreview(undefined);
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled), textarea:not(:disabled), select:not(:disabled), input:not(:disabled)",
        ),
      );
      const first = items[0],
        last = items[items.length - 1];
      if (!items.length) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("keydown", keys);
      previous?.focus();
    };
  }, [modal, preview, busy]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function canLeave() {
    return (
      !dirty ||
      window.confirm("Descartar as alterações não salvas do contexto?")
    );
  }
  function chooseClient(id: string) {
    if (!canLeave()) return;
    setClientId(id);
    setCampaignId("");
    setTab("Visão geral");
    setDirty(false);
    setDraft("");
  }
  function chooseCampaign(c: Campaign) {
    if (!canLeave()) return;
    setCampaignId(c.id);
    setDraft(c.draft);
    setDirty(false);
    setTab("Campanha");
  }
  function newClient() {
    if (!canLeave()) return;
    setDraft(campaign?.draft || "");
    setDirty(false);
    setModal({
      kind: "client",
      value: {
        id: crypto.randomUUID(),
        name: "",
        description: "",
        audience: "",
        tone: "",
        colors: "",
        guidelines: "",
      },
    });
  }
  function newCampaign() {
    if (!canLeave()) return;
    setDraft(campaign?.draft || "");
    setDirty(false);
    setModal({
      kind: "campaign",
      value: {
        id: crypto.randomUUID(),
        clientId,
        title: "",
        objective: "",
        audience: "",
        format: "",
        request: "",
        status: "Rascunho",
        draft: "",
      },
    });
  }
  async function saveForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!modal) return;
    await run(async () => {
      let next: Workspace;
      if (modal.kind === "decision") {
        next = await window.hub.update(modal.action || "decision", {
          id: modal.value?.id,
          clientId,
          campaignId: form.get("scope") === "campaign" ? campaignId : null,
          text: String(form.get("text") || "").trim(),
          reason: String(form.get("reason") || "").trim(),
        });
      } else {
        const input = {
          ...modal.value,
          ...Object.fromEntries(
            [...form.entries()].map(([k, v]) => [k, String(v).trim()]),
          ),
        };
        next = await window.hub.update(modal.kind, input);
        if (modal.kind === "client") {
          if (input.id !== clientId) {
            setCampaignId("");
            setDraft("");
            setDirty(false);
            setTab("Visão geral");
          }
          setClientId(input.id);
        } else {
          setCampaignId(input.id);
          setDraft((input as Campaign).draft);
          setDirty(false);
          setTab("Campanha");
        }
      }
      setData(next);
      setModal(undefined);
      setNotice("Salvo no computador.");
    });
  }
  const decisions =
    data?.decisions.filter(
      (d) =>
        d.clientId === clientId &&
        (!d.campaignId || d.campaignId === campaignId),
    ) || [];
  const refs = data?.references.filter((r) => r.clientId === clientId) || [];
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">ch</span>
          <div>
            creative hub<small>SEU ESTÚDIO, EM CONTEXTO</small>
          </div>
        </div>
        <div className="workspace-label">
          ESPAÇO DE TRABALHO <span>LOCAL</span>
        </div>
        <div className="sidebar-heading">
          <h2>Clientes</h2>
          <button
            aria-label="Novo cliente"
            onClick={newClient}
            disabled={!data}
          >
            +
          </button>
        </div>
        <input
          aria-label="Buscar clientes"
          placeholder="Buscar cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <nav aria-label="Clientes">
          {data?.clients
            .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
            .map((c) => (
              <button
                className={c.id === clientId ? "selected" : ""}
                key={c.id}
                onClick={() => chooseClient(c.id)}
              >
                <span className="avatar">
                  {c.name.slice(0, 2).toUpperCase()}
                </span>
                {c.name}
                <span className="arrow">›</span>
              </button>
            ))}
        </nav>
        {data?.clients.length === 0 && (
          <p className="sidebar-empty">
            Seu próximo projeto começa com um cliente.
          </p>
        )}
        <div className="sidebar-footer">
          <span className="local-dot" /> Dados neste computador
          <p>Sem conta. Sem serviços de IA.</p>
          <button
            disabled={busy || !data}
            onClick={() =>
              run(async () => {
                if (await window.hub.export())
                  setNotice("Backup exportado com todas as referências.");
              })
            }
          >
            Exportar backup
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (canLeave())
                run(async () => {
                  const next = await window.hub.import();
                  if (next) {
                    setData(next);
                    setClientId("");
                    setCampaignId("");
                    setDirty(false);
                    setNotice("Backup restaurado com sucesso.");
                  }
                });
            }}
          >
            Restaurar backup
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Seu espaço criativo{" "}
            <span className="crumb">
              / {client?.name || "Início"} {campaign && ` / ${campaign.title}`}
            </span>
          </span>
          <span className="badge">PRIMEIRA VERSÃO</span>
        </header>
        <div className="content">
          <div aria-live="polite">
            {notice && <p className="notice">{notice}</p>}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {!data ? (
            <div className="empty">
              <h1>
                {error
                  ? "Seus dados precisam de atenção"
                  : "Abrindo seu espaço…"}
              </h1>
              {error && (
                <p>
                  Restaure um backup válido pelo menu lateral. Não alteramos o
                  arquivo que apresentou erro.
                </p>
              )}
            </div>
          ) : !client ? (
            <div className="welcome">
              <span className="eyebrow">MENOS REPETIÇÃO. MAIS CLAREZA.</span>
              <h1>
                Todo projeto merece
                <br />
                um bom contexto.
              </h1>
              <p>
                Reúna a marca, as referências e as decisões.
                <br />
                Leve um briefing atualizado para a IA que você escolher.
              </p>
              <button className="primary" onClick={newClient}>
                + Cadastrar cliente
              </button>
              <div className="steps">
                <div>
                  <b>01</b>
                  <h3>Conheça a marca</h3>
                  <p>Informações e referências em um só lugar.</p>
                </div>
                <div>
                  <b>02</b>
                  <h3>Organize a campanha</h3>
                  <p>Pedidos e decisões com histórico.</p>
                </div>
                <div>
                  <b>03</b>
                  <h3>Prepare o contexto</h3>
                  <p>Revise, copie e use na sua ferramenta.</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">CLIENTE / ESPAÇO CRIATIVO</span>
                  <h1>{client.name}</h1>
                  <p>
                    {client.description ||
                      "Complete as informações da marca para preparar briefings melhores."}
                  </p>
                </div>
                <button
                  onClick={() => setModal({ kind: "client", value: client })}
                >
                  Editar cliente
                </button>
              </div>
              <div className="tabs" role="tablist">
                {[
                  "Visão geral",
                  "Referências",
                  "Decisões",
                  ...(campaign ? ["Campanha", "Contexto"] : []),
                ].map((t) => (
                  <button
                    role="tab"
                    aria-selected={tab === t}
                    className={tab === t ? "active" : ""}
                    key={t}
                    onClick={() => setTab(t)}
                  >
                    {t}
                    {t === "Referências" && <span>{refs.length}</span>}
                  </button>
                ))}
              </div>
              {tab === "Visão geral" && (
                <>
                  <div className="section-heading">
                    <div>
                      <h2>Campanhas</h2>
                      <p>
                        Um objetivo, um pedido e um histórico para cada projeto.
                      </p>
                    </div>
                    <button className="primary" onClick={newCampaign}>
                      + Nova campanha
                    </button>
                  </div>
                  <div className="campaign-grid">
                    {data.campaigns
                      .filter((c) => c.clientId === clientId)
                      .map((c) => (
                        <button
                          className="campaign-card"
                          key={c.id}
                          onClick={() => chooseCampaign(c)}
                        >
                          <span className="status">{c.status}</span>
                          <h3>{c.title}</h3>
                          <p>
                            {c.objective || "Defina o objetivo desta campanha."}
                          </p>
                          <footer>
                            {c.format || "Formato não definido"}{" "}
                            <span>Abrir campanha →</span>
                          </footer>
                        </button>
                      ))}
                  </div>
                  {!data.campaigns.some((c) => c.clientId === clientId) && (
                    <div className="empty">
                      <h3>Qual é o próximo projeto?</h3>
                      <p>
                        Crie a primeira campanha para organizar o pedido deste
                        cliente.
                      </p>
                    </div>
                  )}
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Essência da marca</h2>
                      <span className="muted">BASE PERMANENTE</span>
                    </div>
                    <dl className="details">
                      {Object.entries(clientFields)
                        .filter(([k]) => !["name", "description"].includes(k))
                        .map(([k, label]) => (
                          <div key={k}>
                            <dt>{label}</dt>
                            <dd>
                              {client[k as keyof Client] || "Não informado"}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  </section>
                </>
              )}
              {tab === "Referências" && (
                <>
                  <div className="section-heading">
                    <div>
                      <h2>Referências da marca</h2>
                      <p>PNG, JPG, WEBP ou PDF · até 10 MB por arquivo.</p>
                    </div>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const next = await window.hub.attach(clientId);
                          if (next) {
                            setData(next);
                            setNotice(
                              "Referências copiadas para o armazenamento local.",
                            );
                          }
                        })
                      }
                    >
                      + Adicionar referências
                    </button>
                  </div>
                  <div className="reference-grid">
                    {refs.map((r) => (
                      <article className="reference" key={r.id}>
                        {r.mime.startsWith("image/") ? (
                          <button
                            className="image-button"
                            onClick={() => setPreview(r.id)}
                            aria-label={`Ampliar ${r.name}`}
                          >
                            <img
                              src={`data:${r.mime};base64,${r.data}`}
                              alt={r.name}
                            />
                          </button>
                        ) : (
                          <div className="pdf">PDF</div>
                        )}
                        <h3>{r.name}</h3>
                        <small>{date(r.createdAt)}</small>
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              if (await window.hub.saveReference(r.id))
                                setNotice(
                                  "Referência salva. Abra o arquivo no seu visualizador.",
                                );
                            })
                          }
                        >
                          Salvar cópia
                        </button>
                      </article>
                    ))}
                  </div>
                  {!refs.length && (
                    <div className="empty">
                      <h3>A identidade começa pelas referências</h3>
                      <p>
                        Adicione logos, imagens e exemplos aprovados. Os
                        arquivos continuarão aqui após reiniciar.
                      </p>
                    </div>
                  )}
                </>
              )}
              {tab === "Campanha" && campaign && (
                <>
                  <div className="section-heading">
                    <div>
                      <span className="status">{campaign.status}</span>
                      <h2>{campaign.title}</h2>
                    </div>
                    <button
                      onClick={() =>
                        setModal({
                          kind: "campaign",
                          value: { ...campaign, draft },
                        })
                      }
                    >
                      Editar campanha
                    </button>
                  </div>
                  <section className="panel">
                    <dl className="details">
                      {Object.entries(campaignFields)
                        .filter(([k]) => k !== "title")
                        .map(([k, label]) => (
                          <div key={k}>
                            <dt>{label}</dt>
                            <dd>
                              {campaign[k as keyof Campaign] || "Não informado"}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  </section>
                  <div className="callout">
                    <div>
                      <h2>Do briefing para a criação</h2>
                      <p>
                        Registre as decisões aprovadas e prepare o contexto
                        atualizado.
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => setTab("Contexto")}
                    >
                      Preparar contexto →
                    </button>
                  </div>
                  <button onClick={() => setTab("Decisões")}>
                    Ver decisões e histórico
                  </button>
                </>
              )}
              {tab === "Decisões" && (
                <>
                  <div className="section-heading">
                    <div>
                      <h2>Decisões e histórico</h2>
                      <p>
                        {campaign
                          ? `Regras da marca e decisões de “${campaign.title}”.`
                          : "Regras permanentes da marca. Abra uma campanha para ver suas decisões."}
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => setModal({ kind: "decision" })}
                    >
                      + Registrar orientação
                    </button>
                  </div>
                  {decisions
                    .slice()
                    .reverse()
                    .map((d) => (
                      <article
                        className={`decision ${d.invalidatedAt ? "invalid" : ""}`}
                        key={d.id}
                      >
                        <div className="decision-meta">
                          <span className="status">
                            {d.campaignId ? "Campanha" : "Permanente"}
                          </span>
                          <span>
                            {d.invalidatedAt ? "Invalidada" : "Válida"} ·{" "}
                            {date(d.createdAt)}
                          </span>
                          {d.replaces && (
                            <span>Correção de orientação anterior</span>
                          )}
                        </div>
                        <p>{d.text}</p>
                        {d.invalidatedAt ? (
                          <small>
                            Invalidada em {date(d.invalidatedAt)} · Motivo:{" "}
                            {d.reason}
                          </small>
                        ) : (
                          <div className="actions">
                            <button
                              onClick={() =>
                                setModal({
                                  kind: "decision",
                                  value: d,
                                  action: "correct",
                                })
                              }
                            >
                              Corrigir
                            </button>
                            <button
                              onClick={() =>
                                setModal({
                                  kind: "decision",
                                  value: d,
                                  action: "invalidate",
                                })
                              }
                            >
                              Invalidar
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  {!decisions.length && (
                    <div className="empty">
                      <h3>Não deixe uma decisão se perder</h3>
                      <p>
                        Registre orientações aprovadas. Correções preservam a
                        versão anterior.
                      </p>
                    </div>
                  )}
                </>
              )}
              {tab === "Contexto" && campaign && (
                <>
                  <div className="section-heading">
                    <div>
                      <h2>Contexto pronto para revisar</h2>
                      <p>
                        Montado a partir dos dados salvos, sem geração por IA.
                      </p>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (
                          !draft ||
                          window.confirm(
                            "Atualizar o texto com os dados atuais? Isso substitui suas edições neste contexto.",
                          )
                        ) {
                          run(async () => {
                            setDraft(
                              await window.hub.context(client.id, campaign.id),
                            );
                            setDirty(true);
                          });
                        }
                      }}
                    >
                      Atualizar com dados atuais
                    </button>
                  </div>
                  <div className="context-layout">
                    <div>
                      <label htmlFor="context">Texto do contexto</label>
                      <textarea
                        id="context"
                        className="context-text"
                        value={draft}
                        placeholder="Clique em Atualizar com dados atuais para montar o texto."
                        maxLength={200000}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          setDirty(true);
                        }}
                      />
                      <div className="context-actions">
                        <span className="muted">
                          {dirty ? "Alterações não salvas" : "Rascunho salvo"} ·{" "}
                          {draft.length} caracteres
                        </span>
                        <button
                          disabled={busy || !dirty}
                          onClick={() =>
                            run(async () => {
                              setData(
                                await window.hub.update("campaign", {
                                  ...campaign,
                                  draft,
                                }),
                              );
                              setDirty(false);
                              setNotice("Rascunho salvo.");
                            })
                          }
                        >
                          Salvar rascunho
                        </button>
                        <button
                          className="primary"
                          disabled={busy || !draft}
                          onClick={() =>
                            run(async () => {
                              await window.hub.copy(draft);
                              setNotice(
                                "Contexto copiado. Anexe as referências separadamente na outra IA.",
                              );
                            })
                          }
                        >
                          Copiar contexto
                        </button>
                      </div>
                    </div>
                    <aside className="context-help">
                      <span className="eyebrow">ANTES DE ENVIAR</span>
                      <h3>
                        O texto vai.
                        <br />
                        Os arquivos, você anexa.
                      </h3>
                      <p>
                        Copiar não envia as referências para outra ferramenta.
                      </p>
                      <ul>
                        {refs.map((r) => (
                          <li key={r.id}>{r.name}</li>
                        ))}
                      </ul>
                      {!refs.length && <p>Nenhuma referência cadastrada.</p>}
                      <p>
                        Ao alterar decisões ou a marca, atualize o texto e
                        revise novamente.
                      </p>
                    </aside>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <footer className="page-footer">
          AI Creative Hub{" "}
          <span>Organize o que importa. Crie com contexto.</span>
        </footer>
      </main>
      {modal && (
        <div className="overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              modal.kind === "client"
                ? "Cadastro de cliente"
                : modal.kind === "campaign"
                  ? "Cadastro de campanha"
                  : "Orientação"
            }
            className="modal"
          >
            <div className="section-heading">
              <h2>
                {modal.kind === "client"
                  ? "Informações do cliente"
                  : modal.kind === "campaign"
                    ? "Informações da campanha"
                    : modal.action === "correct"
                      ? "Corrigir orientação"
                      : modal.action === "invalidate"
                        ? "Invalidar orientação"
                        : "Registrar orientação"}
              </h2>
              <button
                aria-label="Fechar"
                disabled={busy}
                onClick={() => setModal(undefined)}
              >
                ×
              </button>
            </div>
            <form onSubmit={saveForm}>
              <fieldset disabled={busy}>
                {modal.kind !== "decision" ? (
                  <>
                    {Object.entries(
                      modal.kind === "client" ? clientFields : campaignFields,
                    ).map(([key, label], index) => (
                      <label key={key}>
                        {label}
                        <textarea
                          aria-label={label}
                          autoFocus={index === 0}
                          name={key}
                          required={index === 0}
                          maxLength={20000}
                          rows={index === 0 ? 1 : 2}
                          defaultValue={
                            (modal.value as unknown as Record<string, string>)[
                              key
                            ]
                          }
                        />
                      </label>
                    ))}
                    {modal.kind === "campaign" && (
                      <label>
                        Status
                        <select
                          aria-label="Status"
                          name="status"
                          defaultValue={modal.value.status}
                        >
                          {[
                            "Rascunho",
                            "Em andamento",
                            "Aprovada",
                            "Concluída",
                          ].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </>
                ) : (
                  <>
                    {!modal.action && (
                      <label>
                        Aplicar a
                        <select aria-label="Aplicar a" name="scope">
                          <option value="client">
                            Regra permanente do cliente
                          </option>
                          {campaign && (
                            <option value="campaign">
                              Somente esta campanha
                            </option>
                          )}
                        </select>
                      </label>
                    )}
                    {modal.action !== "invalidate" && (
                      <label>
                        Orientação aprovada
                        <textarea
                          aria-label="Orientação aprovada"
                          autoFocus
                          name="text"
                          required
                          maxLength={20000}
                          defaultValue={modal.value?.text}
                          rows={4}
                        />
                      </label>
                    )}
                    {modal.action && (
                      <label>
                        Motivo da alteração
                        <textarea
                          autoFocus={modal.action === "invalidate"}
                          name="reason"
                          required
                          maxLength={20000}
                          rows={2}
                        />
                      </label>
                    )}
                    <p className="muted">
                      Orientações antigas permanecem no histórico e deixam de
                      entrar no contexto atualizado.
                    </p>
                  </>
                )}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <div className="actions">
                  <button type="button" onClick={() => setModal(undefined)}>
                    Cancelar
                  </button>
                  <button className="primary" type="submit">
                    {busy ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
        </div>
      )}
      {preview && (
        <div className="overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Referência ampliada"
          >
            <button autoFocus onClick={() => setPreview(undefined)}>
              Fechar imagem
            </button>
            <img
              className="preview"
              src={`data:${refs.find((r) => r.id === preview)?.mime};base64,${refs.find((r) => r.id === preview)?.data}`}
              alt={refs.find((r) => r.id === preview)?.name}
            />
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
