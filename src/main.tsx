import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  Client,
  Campaign,
  Decision,
  Workspace,
  ContextOutput,
  Art,
  ArtTemplate,
  Revision,
} from "./types";
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
  title: "Nome do projeto",
  objective: "Objetivo",
  audience: "Público do projeto",
  format: "Formato",
  request: "Pedido atual",
};
const date = (value: string) => new Date(value).toLocaleString("pt-BR");
const campaignsFrom = (data?: Workspace): Campaign[] =>
  data?.projects.map((project) => {
    const art = data.arts.find((item) => item.projectId === project.id);
    const revision = data.revisions
      .filter((item) => item.artId === art?.id)
      .sort((a, b) => b.sequence - a.sequence)[0];
    return {
      ...project,
      format: art?.format || "",
      request: art?.briefing || "",
      draft: revision?.generatedContext || "",
    };
  }) || [];
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
  const [contextOutput, setContextOutput] = useState<ContextOutput>("art");
  const [contextArtId, setContextArtId] = useState("");
  const [contextRevisionId, setContextRevisionId] = useState("");
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<string>();
  const [search, setSearch] = useState("");
  const dialogOpener = useRef<HTMLElement | null>(null);
  const campaigns = campaignsFrom(data);
  const client = data?.clients.find((c) => c.id === clientId);
  const campaign = campaigns.find(
    (c) => c.id === campaignId && c.clientId === clientId,
  );
  const contextArts =
    data?.arts.filter((item) => item.projectId === campaignId) || [];
  const contextRevisions =
    data?.revisions
      .filter((item) => item.artId === contextArtId)
      .sort((a, b) => b.sequence - a.sequence) || [];
  useEffect(() => {
    setContextOutput("art");
  }, [clientId, campaignId]);
  useEffect(() => {
    setContextArtId(
      data?.arts.find((item) => item.projectId === campaignId)?.id || "",
    );
  }, [campaignId, data?.arts]);
  useEffect(() => {
    setContextRevisionId(
      data?.revisions
        .filter((item) => item.artId === contextArtId)
        .sort((a, b) => b.sequence - a.sequence)[0]?.id || "",
    );
  }, [contextArtId, data?.revisions]);
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
    };
  }, [modal, preview, busy]);
  useEffect(() => {
    if (modal || preview || !dialogOpener.current) return;
    dialogOpener.current.focus();
    dialogOpener.current = null;
  }, [modal, preview]);
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
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      window.scrollTo(0, 0);
    } finally {
      setBusy(false);
    }
  }
  async function updateStructure(type: string, input: unknown) {
    await run(async () => {
      setData(await window.hub.update(type, input));
      setNotice("Salvo no computador.");
    });
  }
  function canLeave() {
    if (busy) return false;
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
    setTab("Projeto");
  }
  function showModal(value: Modal) {
    dialogOpener.current = document.activeElement as HTMLElement;
    setModal(value);
  }
  function showPreview(id: string) {
    dialogOpener.current = document.activeElement as HTMLElement;
    setPreview(id);
  }
  function newClient() {
    if (!canLeave()) return;
    setDraft(campaign?.draft || "");
    setDirty(false);
    showModal({
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
    showModal({
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
          projectId: form.get("scope") === "project" ? campaignId : null,
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
          setTab("Projeto");
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
        d.clientId === clientId && (!d.projectId || d.projectId === campaignId),
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
            disabled={busy || !data}
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
                disabled={busy}
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
      <main aria-busy={busy}>
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
            {busy && (
              <p className="notice" role="status">
                Processando…
              </p>
            )}
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
              <button className="primary" disabled={busy} onClick={newClient}>
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
                  <h3>Organize o projeto</h3>
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
                  disabled={busy}
                  onClick={() => showModal({ kind: "client", value: client })}
                >
                  Editar cliente
                </button>
              </div>
              <div className="tabs" role="tablist">
                {[
                  "Visão geral",
                  "Referências",
                  "Decisões",
                  "Modelos e artes",
                  ...(campaign ? ["Projeto", "Contexto"] : []),
                ].map((t) => (
                  <button
                    disabled={busy}
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
                      <h2>Projetos</h2>
                      <p>
                        Um objetivo, um pedido e um histórico para cada projeto.
                      </p>
                    </div>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={newCampaign}
                    >
                      + Novo projeto
                    </button>
                  </div>
                  <div className="campaign-grid">
                    {campaigns
                      .filter((c) => c.clientId === clientId)
                      .map((c) => (
                        <button
                          disabled={busy}
                          className="campaign-card"
                          key={c.id}
                          onClick={() => chooseCampaign(c)}
                        >
                          <span className="status">{c.status}</span>
                          <h3>{c.title}</h3>
                          <p>
                            {c.objective || "Defina o objetivo deste projeto."}
                          </p>
                          <footer>
                            {c.format || "Formato não definido"}{" "}
                            <span>Abrir projeto →</span>
                          </footer>
                        </button>
                      ))}
                  </div>
                  {!campaigns.some((c) => c.clientId === clientId) && (
                    <div className="empty">
                      <h3>Qual é o próximo projeto?</h3>
                      <p>
                        Crie o primeiro projeto para organizar o pedido deste
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
                            disabled={busy}
                            className="image-button"
                            onClick={() => showPreview(r.id)}
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
              {tab === "Modelos e artes" && (
                <StructurePanel
                  data={data}
                  projectId={campaignId}
                  busy={busy}
                  update={updateStructure}
                />
              )}
              {tab === "Projeto" && campaign && (
                <>
                  <div className="section-heading">
                    <div>
                      <span className="status">{campaign.status}</span>
                      <h2>{campaign.title}</h2>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() =>
                        showModal({
                          kind: "campaign",
                          value: { ...campaign, draft },
                        })
                      }
                    >
                      Editar projeto
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
                      disabled={busy || !contextArtId}
                      className="primary"
                      onClick={() => setTab("Contexto")}
                    >
                      Preparar contexto →
                    </button>
                  </div>
                  <button disabled={busy} onClick={() => setTab("Decisões")}>
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
                          : "Regras permanentes da marca. Abra um projeto para ver suas decisões."}
                      </p>
                    </div>
                    <button
                      disabled={busy}
                      className="primary"
                      onClick={() => showModal({ kind: "decision" })}
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
                            {d.projectId ? "Projeto" : "Permanente"}
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
                              disabled={busy}
                              onClick={() =>
                                showModal({
                                  kind: "decision",
                                  value: d,
                                  action: "correct",
                                })
                              }
                            >
                              Corrigir
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                showModal({
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
                      <h2>Prompt pronto para revisar</h2>
                      <p>
                        Escolha o resultado. O aplicativo monta as instruções e
                        o briefing para você copiar na outra IA.
                      </p>
                    </div>
                    <button
                      disabled={busy || !contextArtId}
                      onClick={() => {
                        if (
                          !draft ||
                          window.confirm(
                            "Atualizar o texto com os dados atuais? Isso substitui suas edições neste contexto.",
                          )
                        ) {
                          run(async () => {
                            setDraft(
                              await window.hub.context(
                                client.id,
                                campaign.id,
                                contextArtId,
                                contextRevisionId || null,
                                contextOutput,
                              ),
                            );
                            setDirty(true);
                          });
                        }
                      }}
                    >
                      Atualizar com dados atuais
                    </button>
                  </div>
                  <div className="form-grid">
                    <label htmlFor="context-art">
                      Arte
                      <select
                        id="context-art"
                        disabled={busy}
                        value={contextArtId}
                        onChange={(event) =>
                          setContextArtId(event.target.value)
                        }
                      >
                        {contextArts.map((art) => (
                          <option key={art.id} value={art.id}>
                            {art.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label htmlFor="context-revision">
                      Revisão
                      <select
                        id="context-revision"
                        disabled={busy}
                        value={contextRevisionId}
                        onChange={(event) =>
                          setContextRevisionId(event.target.value)
                        }
                      >
                        <option value="">Sem revisão</option>
                        {contextRevisions.map((revision) => (
                          <option key={revision.id} value={revision.id}>
                            Revisão {revision.sequence}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label htmlFor="context-output">Resultado desejado</label>
                  <select
                    id="context-output"
                    disabled={busy}
                    value={contextOutput}
                    onChange={(e) =>
                      setContextOutput(e.target.value as ContextOutput)
                    }
                  >
                    <option value="art">Arte final (imagem)</option>
                    <option value="script">Roteiro de conteúdo</option>
                    <option value="image-prompt">
                      Prompt para ferramenta de imagem
                    </option>
                    <option value="context">Somente contexto</option>
                  </select>
                  <p className="muted">
                    Clique em Atualizar com dados atuais para montar o prompt. A
                    seleção só é aplicada ao atualizar; seu rascunho é
                    preservado. A arte será criada na outra IA, se ela oferecer
                    geração de imagens.
                  </p>
                  <div className="context-layout">
                    <div>
                      <label htmlFor="context">Texto do contexto</label>
                      <textarea
                        disabled={busy}
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
                              const art = data.arts.find(
                                (item) => item.id === contextArtId,
                              );
                              if (!art) throw new Error("Arte não encontrada.");
                              setData(
                                await window.hub.update("revision", {
                                  artId: art.id,
                                  sourceRevisionId: contextRevisionId || null,
                                  instructions:
                                    "Contexto revisado manualmente.",
                                  preserveElements: [],
                                  modifyElements: [],
                                  generatedContext: draft,
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
                  ? "Cadastro de projeto"
                  : "Orientação"
            }
            className="modal"
          >
            <div className="section-heading">
              <h2>
                {modal.kind === "client"
                  ? "Informações do cliente"
                  : modal.kind === "campaign"
                    ? "Informações do projeto"
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
                            <option value="project">
                              Somente este projeto
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

function StructurePanel({
  data,
  projectId,
  busy,
  update,
}: {
  data: Workspace;
  projectId: string;
  busy: boolean;
  update: (type: string, input: unknown) => Promise<void>;
}) {
  const arts = data.arts.filter((art) => art.projectId === projectId);
  const [artId, setArtId] = useState(arts[0]?.id || "");
  const selectedArt = arts.find((art) => art.id === artId) || arts[0];
  const revisions = data.revisions
    .filter((revision) => revision.artId === selectedArt?.id)
    .sort((a, b) => a.sequence - b.sequence);

  useEffect(() => {
    if (!arts.some((art) => art.id === artId)) setArtId(arts[0]?.id || "");
  }, [projectId, data.arts, artId, arts]);

  const values = (form: HTMLFormElement) =>
    Object.fromEntries(
      [...new FormData(form).entries()].map(([key, value]) => [
        key,
        String(value).trim(),
      ]),
    );
  const list = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Modelos de arte</h2>
          <p>Reutilize a estrutura sem alterar artes que já foram criadas.</p>
        </div>
      </div>
      <form
        className="panel"
        onSubmit={async (event) => {
          event.preventDefault();
          await update("template", {
            id: crypto.randomUUID(),
            ...values(event.currentTarget),
          });
          event.currentTarget.reset();
        }}
      >
        <div className="form-grid">
          <label>
            Nome do modelo
            <input name="name" required maxLength={20000} />
          </label>
          <label>
            Formato
            <input name="format" maxLength={20000} />
          </label>
          <label className="full">
            Instruções do modelo
            <textarea name="instructions" maxLength={20000} rows={2} />
          </label>
        </div>
        <button className="primary" disabled={busy}>
          Criar modelo
        </button>
      </form>
      <div className="campaign-grid">
        {data.templates.map((template) => (
          <form
            className="campaign-card"
            key={template.id}
            onSubmit={(event) => {
              event.preventDefault();
              return update("template", {
                id: template.id,
                ...values(event.currentTarget),
              });
            }}
          >
            <label>
              Nome
              <input name="name" defaultValue={template.name} required />
            </label>
            <label>
              Formato
              <input name="format" defaultValue={template.format} />
            </label>
            <label>
              Instruções
              <textarea
                name="instructions"
                defaultValue={template.instructions}
                rows={2}
              />
            </label>
            <div className="actions">
              <button disabled={busy} type="submit">
                Salvar modelo
              </button>
              <button
                disabled={busy}
                type="button"
                onClick={() =>
                  update("duplicate-template", {
                    id: template.id,
                    name: `${template.name} - cópia`,
                  })
                }
              >
                Duplicar
              </button>
            </div>
          </form>
        ))}
      </div>

      <div className="section-heading">
        <div>
          <h2>Artes do projeto</h2>
          <p>Escolha um projeto na visão geral para organizar suas artes.</p>
        </div>
      </div>
      {!projectId ? (
        <div className="empty">
          <p>Abra um projeto para criar artes e revisões.</p>
        </div>
      ) : (
        <>
          <form
            className="panel"
            onSubmit={async (event) => {
              event.preventDefault();
              const input = values(event.currentTarget);
              const id = crypto.randomUUID();
              await update("art", {
                id,
                projectId,
                title: input.title,
                format: input.format,
                briefing: input.briefing,
                templateId: input.templateId || null,
                templateName: "",
                templateInstructions: "",
              });
              setArtId(id);
              event.currentTarget.reset();
            }}
          >
            <div className="form-grid">
              <label>
                Título da arte
                <input name="title" required maxLength={20000} />
              </label>
              <label>
                Modelo
                <select name="templateId" defaultValue="">
                  <option value="">Em branco</option>
                  {data.templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Formato
                <input name="format" maxLength={20000} />
              </label>
              <label className="full">
                Briefing
                <textarea name="briefing" maxLength={20000} rows={3} />
              </label>
            </div>
            <button className="primary" disabled={busy}>
              Criar arte
            </button>
          </form>
          <div className="campaign-grid">
            {arts.map((art) => (
              <button
                className={`campaign-card ${art.id === selectedArt?.id ? "selected" : ""}`}
                disabled={busy}
                key={art.id}
                onClick={() => setArtId(art.id)}
              >
                <h3>{art.title}</h3>
                <p>{art.format || "Formato não definido"}</p>
                <footer>{art.templateName || "Arte em branco"}</footer>
              </button>
            ))}
          </div>
        </>
      )}

      {selectedArt && (
        <>
          <div className="section-heading">
            <div>
              <h2>Revisões de {selectedArt.title}</h2>
              <p>
                O histórico é acrescentado; versões anteriores não são
                sobrescritas.
              </p>
            </div>
          </div>
          <form
            className="panel"
            onSubmit={async (event) => {
              event.preventDefault();
              const input = values(event.currentTarget);
              await update(
                input.sourceRevisionId ? "revision-from" : "revision",
                {
                  artId: selectedArt.id,
                  sourceRevisionId: input.sourceRevisionId || null,
                  instructions: input.instructions,
                  preserveElements: list(input.preserveElements),
                  modifyElements: list(input.modifyElements),
                  generatedContext: input.generatedContext,
                },
              );
              event.currentTarget.reset();
            }}
          >
            <div className="form-grid">
              <label>
                Partir de uma revisão
                <select name="sourceRevisionId" defaultValue="">
                  <option value="">Nova revisão</option>
                  {revisions.map((revision) => (
                    <option key={revision.id} value={revision.id}>
                      Revisão {revision.sequence}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Elementos a preservar
                <input name="preserveElements" placeholder="logotipo, cores" />
              </label>
              <label>
                Elementos a modificar
                <input name="modifyElements" placeholder="imagem principal" />
              </label>
              <label className="full">
                Instruções da revisão
                <textarea name="instructions" maxLength={20000} rows={3} />
              </label>
              <label className="full">
                Contexto registrado
                <textarea name="generatedContext" maxLength={200000} rows={4} />
              </label>
            </div>
            <button className="primary" disabled={busy}>
              Criar revisão
            </button>
          </form>
          <div className="decision-list">
            {revisions.map((revision) => (
              <article className="decision" key={revision.id}>
                <h3>Revisão {revision.sequence}</h3>
                <p>{revision.instructions || "Sem instruções adicionais."}</p>
                <small>
                  {revision.approvedAt
                    ? `Aprovada em ${date(revision.approvedAt)}`
                    : revision.createdAt
                      ? date(revision.createdAt)
                      : "Migrada da versão 0.3.0"}
                </small>
                {!revision.approvedAt && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      update("approve-revision", { id: revision.id })
                    }
                  >
                    Aprovar revisão
                  </button>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
