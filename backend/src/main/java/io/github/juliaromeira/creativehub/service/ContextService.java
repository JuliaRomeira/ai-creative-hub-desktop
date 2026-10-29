package io.github.juliaromeira.creativehub.service;

import io.github.juliaromeira.creativehub.model.*;
import java.util.List;

/** Montagem determinística do briefing: não chama IA e não inventa informações. */
public final class ContextService {
  public String prepare(Workspace data, String clientId, String campaignId) {
    Client client =
        data.clients().stream()
            .filter(c -> c.id().equals(clientId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado."));
    Campaign campaign =
        data.campaigns().stream()
            .filter(c -> c.id().equals(campaignId) && c.clientId().equals(clientId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Campanha não pertence ao cliente."));
    List<Decision> valid =
        data.decisions().stream()
            .filter(d -> d.clientId().equals(clientId) && d.invalidatedAt() == null)
            .toList();
    return "CONTEXTO CRIATIVO — "
        + client.name()
        + "\n\nMARCA\nEmpresa: "
        + value(client.description())
        + "\nPúblico: "
        + value(client.audience())
        + "\nTom: "
        + value(client.tone())
        + "\nCores: "
        + value(client.colors())
        + "\nOrientações da marca: "
        + value(client.guidelines())
        + "\n\nREGRAS PERMANENTES VÁLIDAS\n"
        + lines(valid.stream().filter(d -> d.campaignId() == null).map(Decision::text).toList())
        + "\n\nCAMPANHA — "
        + campaign.title()
        + "\nObjetivo: "
        + value(campaign.objective())
        + "\nPúblico: "
        + value(campaign.audience())
        + "\nFormato: "
        + value(campaign.format())
        + "\nStatus: "
        + campaign.status()
        + "\nPedido atual: "
        + value(campaign.request())
        + "\n\nDECISÕES VÁLIDAS DESTA CAMPANHA\n"
        + lines(
            valid.stream()
                .filter(d -> campaignId.equals(d.campaignId()))
                .map(Decision::text)
                .toList())
        + "\n\nREFERÊNCIAS PARA ANEXAR MANUALMENTE\n"
        + lines(
            data.references().stream()
                .filter(r -> r.clientId().equals(clientId))
                .map(Reference::name)
                .toList())
        + "\n\n"
        + "Este texto não inclui os arquivos. Anexe as referências separadamente. Se houver"
        + " conflito ou informação ausente, peça esclarecimento; não invente detalhes.";
  }

  private String value(String text) {
    return text.isEmpty() ? "Não informado" : text;
  }

  private String lines(List<String> texts) {
    return texts.isEmpty() ? "Nenhuma registrada." : "- " + String.join("\n- ", texts);
  }
}
