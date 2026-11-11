package io.github.juliaromeira.creativehub.service;

import io.github.juliaromeira.creativehub.model.*;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

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

  public String prepare(
      Workspace data,
      String clientId,
      String projectId,
      String artId,
      String revisionId,
      String output) {
    Client client =
        data.clients().stream()
            .filter(item -> item.id().equals(clientId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado."));
    Project project =
        data.projects().stream()
            .filter(item -> item.id().equals(projectId) && item.clientId().equals(clientId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Projeto não pertence ao cliente."));
    Art art =
        data.arts().stream()
            .filter(item -> item.id().equals(artId) && item.projectId().equals(projectId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Arte não pertence ao projeto."));
    Revision revision =
        revisionId == null || revisionId.isBlank()
            ? null
            : data.revisions().stream()
                .filter(item -> item.id().equals(revisionId) && item.artId().equals(artId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Revisão não pertence à arte."));
    List<Decision> valid =
        data.decisions().stream()
            .filter(item -> item.clientId().equals(clientId) && item.invalidatedAt() == null)
            .toList();
    detectConflicts(client, valid, revision);

    String instruction = outputInstruction(output);
    String revisionSection = revision == null ? "Nenhuma selecionada."
        : "Revisão " + revision.sequence()
            + "\nInstruções: " + value(revision.instructions())
            + "\nPreservar: " + inline(revision.preserveElements())
            + "\nModificar: " + inline(revision.modifyElements());
    return outputPrefix(instruction)
        + "CONTEXTO CRIATIVO — " + client.name()
        + "\n\nMARCA\nEmpresa: " + value(client.description())
        + "\nPúblico: " + value(client.audience())
        + "\nTom: " + value(client.tone())
        + "\nCores: " + value(client.colors())
        + "\nOrientações da marca: " + value(client.guidelines())
        + "\n\nREGRAS PERMANENTES VÁLIDAS\n"
        + lines(valid.stream().filter(item -> item.projectId() == null).map(Decision::text).toList())
        + "\n\nPROJETO — " + project.title()
        + "\nObjetivo: " + value(project.objective())
        + "\nPúblico: " + value(project.audience())
        + "\nStatus: " + project.status()
        + "\n\nMODELO DA ARTE\nNome: " + value(art.templateName())
        + "\nInstruções: " + value(art.templateInstructions())
        + "\n\nARTE — " + art.title()
        + "\nFormato: " + value(art.format())
        + "\nBriefing: " + value(art.briefing())
        + "\n\nREVISÃO SELECIONADA\n" + revisionSection
        + "\n\nDECISÕES VÁLIDAS DESTE PROJETO\n"
        + lines(valid.stream().filter(item -> projectId.equals(item.projectId())).map(Decision::text).toList())
        + "\n\nREFERÊNCIAS PARA ANEXAR MANUALMENTE\n"
        + lines(
            data.references().stream()
                .filter(item -> item.clientId().equals(clientId))
                .filter(item -> item.projectId() == null || item.projectId().equals(projectId))
                .filter(item -> item.artId() == null || item.artId().equals(artId))
                .map(Reference::name)
                .toList())
        + "\n\nEste texto não inclui os arquivos. Anexe as referências separadamente. "
        + "Se houver conflito ou informação ausente, peça esclarecimento; não invente detalhes.";
  }

  private String outputInstruction(String output) {
    if (output == null) output = "context";
    return switch (output) {
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
  }

  private String outputPrefix(String instruction) {
    return instruction.isEmpty() ? "" : "TAREFA PARA A IA\n" + instruction
        + "\n\nCOMO USAR O BRIEFING\nO resultado desejado acima define o tipo de entrega. "
        + "Se o pedido atual contiver uma instrução antiga sobre o tipo de entrega, substitua somente essa instrução "
        + "pelo resultado desejado. Preserve as regras permanentes e os elementos marcados para preservar. "
        + "Altere somente os elementos indicados. Para outros conflitos ou informações essenciais ausentes, "
        + "peça esclarecimento antes de produzir. Não invente preços, descontos, endereços, logotipos "
        + "ou características da empresa.\n\n";
  }

  private void detectConflicts(Client client, List<Decision> valid, Revision revision) {
    if (revision == null) return;
    List<String> preserve = revision.preserveElements().stream().map(this::normalize).toList();
    List<String> modify = revision.modifyElements().stream().map(this::normalize).toList();
    List<String> conflicts = new ArrayList<>();
    for (String item : preserve)
      if (modify.contains(item)) conflicts.add(item);

    String mandatory = normalize(client.guidelines() + " "
        + String.join(" ", valid.stream().filter(item -> item.projectId() == null).map(Decision::text).toList()));
    String requested = normalize(revision.instructions() + " " + String.join(" ", revision.modifyElements()));
    for (String protectedItem : List.of("logotipo", "logo", "cores", "tipografia", "fonte")) {
      boolean directlyModified = modify.stream().anyMatch(item -> containsWord(item, protectedItem));
      boolean instructionChanges = containsWord(requested, protectedItem)
          && (containsWord(requested, "alterar") || containsWord(requested, "trocar")
              || containsWord(requested, "remover") || containsWord(requested, "modificar"));
      if (containsWord(mandatory, protectedItem) && (directlyModified || instructionChanges))
        conflicts.add(protectedItem);
    }
    if (!conflicts.isEmpty())
      throw new IllegalArgumentException(
          "Conflito na revisão: não é possível modificar " + String.join(", ", conflicts) + ".");
  }

  private boolean containsWord(String text, String word) {
    return (" " + text + " ").contains(" " + word + " ");
  }

  private String normalize(String text) {
    if (text == null) return "";
    return Normalizer.normalize(text, Normalizer.Form.NFD)
        .replaceAll("\\p{M}", "")
        .toLowerCase(Locale.ROOT)
        .replaceAll("[^a-z0-9]+", " ")
        .trim();
  }

  private String inline(List<String> texts) {
    return texts == null || texts.isEmpty() ? "Nenhum elemento informado." : String.join(", ", texts);
  }

  private String value(String text) {
    return text == null || text.isEmpty() ? "Não informado" : text;
  }

  private String lines(List<String> texts) {
    return texts.isEmpty() ? "Nenhuma registrada." : "- " + String.join("\n- ", texts);
  }
}
