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
      case "campaign" -> {
        Campaign campaign = WorkspaceRepository.JSON.fromJson(input, Campaign.class);
        for (Campaign old : data.campaigns())
          if (Objects.equals(old.id(), campaign.id()))
            require(
                Objects.equals(old.clientId(), campaign.clientId()),
                "Não é possível trocar o cliente da campanha.");
        data.campaigns().removeIf(c -> Objects.equals(c.id(), campaign.id()));
        data.campaigns().add(campaign);
      }
      case "decision" ->
          data.decisions()
              .add(
                  new Decision(
                      id(),
                      string(input, "clientId"),
                      nullable(input, "campaignId"),
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
                    old.campaignId(),
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
                      old.campaignId(),
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
}
