import type { Client, Campaign, Workspace } from "./types";
export function prepareContext(
  client: Client,
  campaign: Campaign,
  data: Workspace,
) {
  const valid = data.decisions.filter(
    (d) => d.clientId === client.id && !d.invalidatedAt,
  );
  const lines = (items: string[]) =>
    items.length
      ? items.map((t) => `- ${t}`).join("\n")
      : "Nenhuma registrada.";
  return `CONTEXTO CRIATIVO — ${client.name}\n\nMARCA\nEmpresa: ${client.description || "Não informado"}\nPúblico: ${client.audience || "Não informado"}\nTom: ${client.tone || "Não informado"}\nCores: ${client.colors || "Não informado"}\nOrientações da marca: ${client.guidelines || "Não informado"}\n\nREGRAS PERMANENTES VÁLIDAS\n${lines(valid.filter((d) => !d.campaignId).map((d) => d.text))}\n\nCAMPANHA — ${campaign.title}\nObjetivo: ${campaign.objective || "Não informado"}\nPúblico: ${campaign.audience || "Não informado"}\nFormato: ${campaign.format || "Não informado"}\nStatus: ${campaign.status}\nPedido atual: ${campaign.request || "Não informado"}\n\nDECISÕES VÁLIDAS DESTA CAMPANHA\n${lines(valid.filter((d) => d.campaignId === campaign.id).map((d) => d.text))}\n\nREFERÊNCIAS PARA ANEXAR MANUALMENTE\n${lines(data.references.filter((r) => r.clientId === client.id).map((r) => r.name))}\n\nEste texto não inclui os arquivos. Anexe as referências separadamente. Se houver conflito ou informação ausente, peça esclarecimento; não invente detalhes.`;
}
