package io.github.juliaromeira.creativehub.service;

import io.github.juliaromeira.creativehub.model.*;
import java.util.List;

/** Montagem determinística do briefing: não chama IA e não inventa informações. */
public final class ContextService {
  public String prepare(Workspace data, String clientId, String campaignId) {
    return prepare(data, clientId, campaignId, "context");
  }

  public String prepare(Workspace data, String clientId, String campaignId, String output) {
    if (output == null) output = "context";
    String instruction = switch (output) {
      case "context" -> "";
      case "art" -> "Crie a arte final em imagem, seguindo o formato e o conteúdo do briefing. "
          + "Entregue a imagem pronta, não apenas um roteiro ou uma descrição visual. "
          + "Se houver várias peças ou páginas, mantenha a identidade visual consistente entre elas. "
          + "Se você não puder gerar imagens, informe essa limitação claramente; não apresente texto como arte final.";
      case "script" -> "Crie um roteiro de conteúdo seguindo o formato do briefing. "
          + "Para cada peça ou página, entregue título, texto de apoio e orientação visual. "
          + "Inclua legenda e chamada para ação quando forem aplicáveis. Não gere imagens nesta etapa.";
      case "image-prompt" -> "Escreva um prompt pronto para colar em uma ferramenta de geração de imagens. "
          + "Detalhe composição, elementos, cores, estilo, iluminação, formato e os textos solicitados. "
          + "Se houver várias peças ou páginas, entregue um prompt por peça com identidade visual consistente. "
          + "Não gere imagens nesta etapa; entregue os prompts.";
      default -> throw new IllegalArgumentException("Resultado desejado inválido.");
    };
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
    return (instruction.isEmpty() ? "" : "TAREFA PARA A IA\n" + instruction
        + "\n\nCOMO USAR O BRIEFING\nO resultado desejado acima define o tipo de entrega. "
        + "Se o pedido atual contiver uma instrução antiga sobre o tipo de entrega (por exemplo, "
        + "'não gere a imagem' ou 'faça apenas um roteiro'), substitua somente essa instrução pelo resultado desejado. "
        + "Preserve o conteúdo solicitado, as orientações da marca e as decisões válidas. "
        + "Para outros conflitos ou informações essenciais ausentes, peça esclarecimento antes de produzir. "
        + "Não invente preços, descontos, endereços, logotipos ou características da empresa.\n\n")
        + "CONTEXTO CRIATIVO — "
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
