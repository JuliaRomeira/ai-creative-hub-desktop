package io.github.juliaromeira.creativehub.service;

import static io.github.juliaromeira.creativehub.service.WorkspaceValidator.*;

import com.google.gson.JsonObject;
import io.github.juliaromeira.creativehub.model.*;
import io.github.juliaromeira.creativehub.persistence.WorkspaceRepository;
import java.io.IOException;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;

/** Casos de uso: cadastros, histórico e anexos. O Electron não decide estas regras. */
public final class WorkspaceService {
  private final WorkspaceRepository repository;

  public WorkspaceService(WorkspaceRepository repository) {
    this.repository = repository;
  }

  public Workspace update(String operation, JsonObject input) throws IOException {
    Workspace data = repository.read();
    switch (operation) {
      case "client" -> {
        Client client = WorkspaceRepository.JSON.fromJson(input, Client.class);
        data.clients().removeIf(c -> Objects.equals(c.id(), client.id()));
        data.clients().add(client);
      }
      case "project" -> {
        Project project = WorkspaceRepository.JSON.fromJson(input, Project.class);
        data.projects().stream()
            .filter(old -> Objects.equals(old.id(), project.id()))
            .forEach(
                old ->
                    require(
                        Objects.equals(old.clientId(), project.clientId()),
                        "Não é possível trocar o cliente do projeto."));
        data.projects().removeIf(old -> Objects.equals(old.id(), project.id()));
        data.projects().add(project);
      }
      case "art" -> {
        Art submitted = WorkspaceRepository.JSON.fromJson(input, Art.class);
        Art old =
            data.arts().stream()
                .filter(a -> Objects.equals(a.id(), submitted.id()))
                .findFirst()
                .orElse(null);
        if (old != null)
          require(
              Objects.equals(old.projectId(), submitted.projectId()),
              "Não é possível trocar o projeto da arte.");
        Art art = submitted;
        if (old == null && submitted.templateId() != null) {
          Template template =
              data.templates().stream()
                  .filter(t -> t.id().equals(submitted.templateId()))
                  .findFirst()
                  .orElseThrow(() -> new IllegalArgumentException("Modelo não encontrado."));
          art =
              new Art(
                  submitted.id(),
                  submitted.projectId(),
                  submitted.title(),
                  template.format(),
                  submitted.briefing(),
                  template.id(),
                  template.name(),
                  template.instructions());
        }
        data.arts().removeIf(existing -> Objects.equals(existing.id(), submitted.id()));
        data.arts().add(art);
      }
      case "template" -> {
        Template template = WorkspaceRepository.JSON.fromJson(input, Template.class);
        data.templates().removeIf(old -> Objects.equals(old.id(), template.id()));
        data.templates().add(template);
      }
      case "duplicate-template" -> {
        Template source =
            data.templates().stream()
                .filter(template -> template.id().equals(string(input, "id")))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Modelo não encontrado."));
        String name = nullable(input, "name");
        data.templates()
            .add(
                new Template(
                    id(), name == null ? source.name() : name, source.format(), source.instructions()));
      }
      case "revision", "revision-from" -> {
        String artId = string(input, "artId");
        require(data.arts().stream().anyMatch(art -> art.id().equals(artId)), "Arte não encontrada.");
        String sourceId = nullable(input, "sourceRevisionId");
        if (operation.equals("revision-from"))
          require(sourceId != null, "Informe a revisão de origem.");
        if (sourceId != null)
          require(
              data.revisions().stream()
                  .anyMatch(revision -> revision.id().equals(sourceId) && revision.artId().equals(artId)),
              "Revisão de origem inválida.");
        int sequence =
            data.revisions().stream()
                    .filter(revision -> revision.artId().equals(artId))
                    .mapToInt(Revision::sequence)
                    .max()
                    .orElse(0)
                + 1;
        data.revisions()
            .add(
                new Revision(
                    id(),
                    artId,
                    sequence,
                    sourceId,
                    string(input, "instructions"),
                    strings(input, "preserveElements"),
                    strings(input, "modifyElements"),
                    string(input, "generatedContext"),
                    Instant.now().toString(),
                    null));
      }
      case "approve-revision" -> {
        String revisionId = string(input, "id");
        Revision old =
            data.revisions().stream()
                .filter(revision -> revision.id().equals(revisionId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Revisão não encontrada."));
        require(old.approvedAt() == null, "Esta revisão já foi aprovada.");
        data.revisions()
            .set(
                data.revisions().indexOf(old),
                new Revision(
                    old.id(),
                    old.artId(),
                    old.sequence(),
                    old.sourceRevisionId(),
                    old.instructions(),
                    old.preserveElements(),
                    old.modifyElements(),
                    old.generatedContext(),
                    old.createdAt(),
                    Instant.now().toString()));
      }
      case "campaign" -> {
        Campaign campaign = WorkspaceRepository.JSON.fromJson(input, Campaign.class);
        Project old =
            data.projects().stream()
                .filter(project -> project.id().equals(campaign.id()))
                .findFirst()
                .orElse(null);
        if (old != null)
          require(
              old.clientId().equals(campaign.clientId()),
              "Não é possível trocar o cliente da campanha.");
        data.projects().removeIf(project -> project.id().equals(campaign.id()));
        data.projects()
            .add(
                new Project(
                    campaign.id(),
                    campaign.clientId(),
                    campaign.title(),
                    campaign.objective(),
                    campaign.audience(),
                    campaign.status()));
        String artId = Workspace.migratedId("art", campaign.id());
        data.arts().removeIf(art -> art.id().equals(artId));
        data.arts()
            .add(
                new Art(
                    artId,
                    campaign.id(),
                    campaign.title(),
                    campaign.format(),
                    campaign.request(),
                    null,
                    "",
                    ""));
      }
      case "decision" ->
          data.decisions()
              .add(
                  new Decision(
                      id(),
                      string(input, "clientId"),
                      input.has("projectId")
                          ? nullable(input, "projectId")
                          : nullable(input, "campaignId"),
                      string(input, "text"),
                      Instant.now().toString(),
                      null,
                      "",
                      null));
      case "correct", "invalidate" -> {
        String decisionId = string(input, "id");
        Decision old =
            data.decisions().stream()
                .filter(d -> d.id().equals(decisionId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Orientação não encontrada."));
        require(old.invalidatedAt() == null, "Esta orientação já não está válida.");
        String reason = string(input, "reason");
        text(reason, true, 20000);
        String now = Instant.now().toString();
        int index = data.decisions().indexOf(old);
        data.decisions()
            .set(
                index,
                new Decision(
                    old.id(),
                    old.clientId(),
                    old.projectId(),
                    old.text(),
                    old.createdAt(),
                    now,
                    reason,
                    old.replaces()));
        if (operation.equals("correct"))
          data.decisions()
              .add(
                  new Decision(
                      id(),
                      old.clientId(),
                      old.projectId(),
                      string(input, "text"),
                      now,
                      null,
                      "",
                      old.id()));
      }
      default -> throw new IllegalArgumentException("Operação desconhecida.");
    }
    return repository.save(data);
  }

  public Workspace addReferences(String clientId, List<String> paths) throws IOException {
    return addReferences(clientId, null, null, paths);
  }

  public Workspace addReferences(
      String clientId, String projectId, String artId, List<String> paths) throws IOException {
    Workspace data = repository.read();
    require(paths != null && !paths.isEmpty(), "Nenhum arquivo selecionado.");
    for (String filename : paths) {
      Path path = Path.of(filename);
      require(Files.size(path) <= MAX_ATTACHMENT_BYTES, "Cada referência pode ter até 10 MB.");
      String name = path.getFileName().toString();
      String extension = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
      String mime =
          switch (extension) {
            case "png" -> "image/png";
            case "jpg", "jpeg" -> "image/jpeg";
            case "webp" -> "image/webp";
            case "pdf" -> "application/pdf";
            default -> throw new IllegalArgumentException("Use PNG, JPG, WEBP ou PDF.");
          };
      data.references()
          .add(
              new Reference(
                  id(),
                  clientId,
                  projectId,
                  artId,
                  name,
                  mime,
                  Base64.getEncoder().encodeToString(Files.readAllBytes(path)),
                  Instant.now().toString()));
    }
    return repository.save(data);
  }

  public Reference reference(String id) throws IOException {
    return repository.read().references().stream()
        .filter(r -> r.id().equals(id))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Referência não encontrada."));
  }

  public void saveReference(String id, Path target) throws IOException {
    repository.saveReferenceFile(target, Base64.getDecoder().decode(reference(id).data()));
  }

  private static String id() {
    return UUID.randomUUID().toString();
  }

  public static String string(JsonObject input, String key) {
    String value = nullable(input, key);
    require(value != null, "Campo ausente: " + key);
    return value;
  }

  public static String nullable(JsonObject input, String key) {
    if (!input.has(key) || input.get(key).isJsonNull()) return null;
    require(
        input.get(key).isJsonPrimitive() && input.getAsJsonPrimitive(key).isString(),
        "Campo inválido: " + key);
    return input.get(key).getAsString();
  }

  private static List<String> strings(JsonObject input, String key) {
    require(input.has(key) && input.get(key).isJsonArray(), "Campo inválido: " + key);
    try {
      return new ArrayList<>(
          Arrays.asList(
              WorkspaceRepository.JSON.fromJson(input.get(key), String[].class)));
    } catch (RuntimeException error) {
      throw new IllegalArgumentException("Campo inválido: " + key);
    }
  }
}
