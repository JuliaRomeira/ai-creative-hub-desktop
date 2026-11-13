package io.github.juliaromeira.creativehub.service;

import io.github.juliaromeira.creativehub.model.*;
import java.time.Instant;
import java.util.*;

/** Regras comuns a cadastros, leitura e restauração. Nada é gravado sem validação. */
public final class WorkspaceValidator {
  public static final int MAX_FILE_BYTES = 100 * 1024 * 1024;
  public static final int MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
  public static final Set<String> MIME_TYPES =
      Set.of("image/png", "image/jpeg", "image/webp", "application/pdf");
  private static final Set<String> STATUSES =
      Set.of("Rascunho", "Em andamento", "Aprovada", "Concluída");

  public void validate(Workspace data) {
    require(data != null && data.version() == 2, "Versão de dados não suportada.");
    size(data.clients(), 1000);
    size(data.projects(), 10000);
    size(data.arts(), 20000);
    size(data.revisions(), 50000);
    size(data.templates(), 10000);
    size(data.decisions(), 20000);
    size(data.references(), 1000);

    Set<String> allIds = new HashSet<>();
    Map<String, Client> clients = new HashMap<>();
    Map<String, Project> projects = new HashMap<>();
    Map<String, Art> arts = new HashMap<>();
    Map<String, Revision> revisions = new HashMap<>();
    Map<String, Decision> decisions = new HashMap<>();
    Map<String, Template> templates = new HashMap<>();

    for (Client client : data.clients()) {
      unique(client.id(), allIds);
      clients.put(client.id(), client);
      text(client.name(), true, 20000);
      for (String value :
          new String[] {
            client.description(), client.audience(), client.tone(), client.colors(), client.guidelines()
          }) text(value, false, 20000);
    }
    for (Project project : data.projects()) {
      unique(project.id(), allIds);
      require(clients.containsKey(project.clientId()), "Cliente do projeto não existe.");
      projects.put(project.id(), project);
      text(project.title(), true, 20000);
      text(project.objective(), false, 20000);
      text(project.audience(), false, 20000);
      require(project.status() != null && STATUSES.contains(project.status()), "Status inválido.");
    }
    for (Template template : data.templates()) {
      unique(template.id(), allIds);
      templates.put(template.id(), template);
      text(template.name(), true, 20000);
      text(template.format(), false, 20000);
      text(template.instructions(), false, 20000);
    }
    for (Art art : data.arts()) {
      unique(art.id(), allIds);
      require(projects.containsKey(art.projectId()), "Projeto da arte não existe.");
      if (art.templateId() != null)
        require(templates.containsKey(art.templateId()), "Modelo de origem da arte não existe.");
      arts.put(art.id(), art);
      text(art.title(), true, 20000);
      text(art.format(), false, 20000);
      text(art.briefing(), false, 20000);
      text(art.templateName(), false, 20000);
      text(art.templateInstructions(), false, 20000);
    }

    Map<String, Set<Integer>> sequences = new HashMap<>();
    for (Revision revision : data.revisions()) {
      unique(revision.id(), allIds);
      require(arts.containsKey(revision.artId()), "Arte da revisão não existe.");
      require(revision.sequence() > 0, "Sequência de revisão inválida.");
      require(
          sequences.computeIfAbsent(revision.artId(), ignored -> new HashSet<>()).add(revision.sequence()),
          "Sequência de revisão duplicada.");
      revisions.put(revision.id(), revision);
      text(revision.instructions(), false, 20000);
      strings(revision.preserveElements(), 100);
      strings(revision.modifyElements(), 100);
      text(revision.generatedContext(), false, 200000);
      if (revision.createdAt() != null) date(revision.createdAt());
      else {
        Art art = arts.get(revision.artId());
        require(
            revision.sequence() == 1
                && revision.sourceRevisionId() == null
                && revision.id().equals(Workspace.migratedId("revision", art.projectId()))
                && art.id().equals(Workspace.migratedId("art", art.projectId())),
            "Data da revisão ausente.");
      }
      if (revision.approvedAt() != null) date(revision.approvedAt());
    }
    for (Map.Entry<String, Set<Integer>> entry : sequences.entrySet())
      for (int sequence = 1; sequence <= entry.getValue().size(); sequence++)
        require(entry.getValue().contains(sequence), "Sequência de revisão incompleta.");
    for (Revision revision : data.revisions()) {
      if (revision.sourceRevisionId() == null) continue;
      Revision source = revisions.get(revision.sourceRevisionId());
      require(
          source != null
              && source.artId().equals(revision.artId())
              && source.sequence() < revision.sequence(),
          "Origem da revisão inválida.");
    }

    for (Decision decision : data.decisions()) {
      unique(decision.id(), allIds);
      require(clients.containsKey(decision.clientId()), "Cliente da orientação não existe.");
      if (decision.projectId() != null)
        require(
            projects.containsKey(decision.projectId())
                && projects.get(decision.projectId()).clientId().equals(decision.clientId()),
            "Projeto da orientação inválido.");
      decisions.put(decision.id(), decision);
      text(decision.text(), true, 20000);
      text(decision.reason(), false, 20000);
      date(decision.createdAt());
      if (decision.invalidatedAt() != null) date(decision.invalidatedAt());
    }
    for (Decision decision : data.decisions()) {
      if (decision.replaces() == null) continue;
      Decision old = decisions.get(decision.replaces());
      require(
          old != null
              && !old.id().equals(decision.id())
              && old.invalidatedAt() != null
              && old.clientId().equals(decision.clientId())
              && Objects.equals(old.projectId(), decision.projectId()),
          "Histórico de correção inválido.");
    }
    for (Reference reference : data.references()) {
      unique(reference.id(), allIds);
      require(clients.containsKey(reference.clientId()), "Cliente da referência não existe.");
      Project project = reference.projectId() == null ? null : projects.get(reference.projectId());
      require(
          reference.projectId() == null
              || (project != null && project.clientId().equals(reference.clientId())),
          "Projeto da referência inválido.");
      Art art = reference.artId() == null ? null : arts.get(reference.artId());
      require(
          reference.artId() == null
              || (project != null && art != null && art.projectId().equals(project.id())),
          "Arte da referência inválida.");
      text(reference.name(), true, 255);
      date(reference.createdAt());
      require(
          reference.mime() != null && MIME_TYPES.contains(reference.mime()),
          "Tipo de referência inválido.");
      text(reference.data(), false, 14000000);
      byte[] bytes;
      try {
        bytes = Base64.getDecoder().decode(reference.data());
      } catch (IllegalArgumentException error) {
        throw new IllegalArgumentException("Conteúdo do anexo inválido.");
      }
      require(bytes.length <= MAX_ATTACHMENT_BYTES, "Cada referência pode ter até 10 MB.");
    }
  }

  public static void text(String value, boolean required, int max) {
    require(
        value != null && value.length() <= max && (!required || !value.isBlank()),
        "Campo obrigatório ausente ou texto acima do limite.");
  }

  public static void require(boolean valid, String message) {
    if (!valid) throw new IllegalArgumentException(message);
  }

  private static void strings(List<String> values, int max) {
    size(values, max);
    for (String value : values) text(value, true, 20000);
  }

  private static void size(List<?> list, int max) {
    require(
        list != null && list.size() <= max && list.stream().noneMatch(Objects::isNull),
        "Coleção de dados inválida.");
  }

  private static void unique(String id, Set<String> ids) {
    require(
        id != null && id.matches("[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"),
        "Identificador inválido.");
    require(ids.add(id), "Identificador duplicado.");
  }

  private static void date(String value) {
    try {
      Instant.parse(value);
    } catch (Exception error) {
      throw new IllegalArgumentException("Data inválida.");
    }
  }
}
