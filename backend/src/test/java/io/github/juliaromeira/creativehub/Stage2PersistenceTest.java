package io.github.juliaromeira.creativehub;

import static org.junit.jupiter.api.Assertions.*;

import com.google.gson.*;
import io.github.juliaromeira.creativehub.model.*;
import io.github.juliaromeira.creativehub.persistence.WorkspaceRepository;
import io.github.juliaromeira.creativehub.service.WorkspaceService;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class Stage2PersistenceTest {
  @TempDir Path temp;
  private final Path legacyFixture = Path.of("../tests/fixtures/legacy-v1.json");

  @Test
  void v1MigrationIsStableCompleteAndOnlyWritesOnFirstMutation() throws Exception {
    JsonObject legacy = JsonParser.parseString(Files.readString(legacyFixture)).getAsJsonObject();
    JsonObject secondCampaign = legacy.getAsJsonArray("campaigns").get(0).deepCopy().getAsJsonObject();
    secondCampaign.addProperty("id", "33333333-3333-4333-8333-333333333333");
    secondCampaign.addProperty("title", "Projeto sem rascunho");
    secondCampaign.addProperty("status", "Aprovada");
    secondCampaign.addProperty("draft", "");
    legacy.getAsJsonArray("campaigns").add(secondCampaign);
    byte[] original = legacy.toString().getBytes(StandardCharsets.UTF_8);
    Path file = temp.resolve("workspace.json");
    Files.write(file, original);

    Workspace first;
    try (var repository = new WorkspaceRepository(temp)) {
      first = repository.read();
      Workspace second = repository.read();

      assertEquals(2, first.version());
      assertEquals(first, second);
      assertArrayEquals(original, Files.readAllBytes(file));
      assertFalse(Files.exists(temp.resolve("workspace.json.before-v2")));
      assertEquals(2, first.projects().size());
      assertEquals(2, first.arts().size());
      assertEquals(1, first.revisions().size());
      assertEquals("Campanha legada", first.projects().get(0).title());
      assertEquals("Imagem", first.arts().get(0).format());
      assertEquals("Preservar os dados", first.arts().get(0).briefing());
      assertEquals("Rascunho editado na versão anterior.", first.revisions().get(0).generatedContext());
      assertNull(first.revisions().get(0).approvedAt());
      assertEquals(first.projects().get(0).id(), first.decisions().get(2).projectId());
      assertArrayEquals(
          Base64.getDecoder().decode(legacy.getAsJsonArray("references").get(0).getAsJsonObject().get("data").getAsString()),
          Base64.getDecoder().decode(first.references().get(0).data()));

      Set<String> migratedIds = new HashSet<>();
      first.arts().forEach(art -> assertTrue(migratedIds.add(validUuid(art.id()))));
      first.revisions().forEach(revision -> assertTrue(migratedIds.add(validUuid(revision.id()))));

      repository.save(first);
      repository.save(repository.read());
      assertArrayEquals(original, Files.readAllBytes(temp.resolve("workspace.json.before-v2")));
      assertArrayEquals(original, Files.readAllBytes(temp.resolve("workspace.json.before-java-v020")));
    }

    try (var reopened = new WorkspaceRepository(temp)) {
      assertEquals(first, reopened.read());
    }
  }

  @Test
  void projectsArtsTemplatesAndRevisionHistorySurviveRestart() throws Exception {
    String clientId = UUID.randomUUID().toString();
    String projectA = UUID.randomUUID().toString();
    String projectB = UUID.randomUUID().toString();
    String templateId = UUID.randomUUID().toString();
    String artA = UUID.randomUUID().toString();
    String artB = UUID.randomUUID().toString();
    String firstRevision;

    try (var repository = new WorkspaceRepository(temp)) {
      var service = new WorkspaceService(repository);
      service.update("client", object(new Client(clientId, "Estúdio Fictício", "", "", "", "", "")));
      service.update("project", object(new Project(projectA, clientId, "Projeto A", "Objetivo A", "", "Rascunho")));
      service.update("project", object(new Project(projectB, clientId, "Projeto B", "Objetivo B", "", "Em andamento")));
      service.update("template", object(new Template(templateId, "Post quadrado", "1080 x 1080", "Usar margem segura")));
      service.update("duplicate-template", json("{\"id\":\"" + templateId + "\",\"name\":\"Post quadrado - cópia\"}"));
      service.update("art", object(new Art(artA, projectA, "Arte A", "ignorado", "Briefing A", templateId, "", "")));
      service.update("art", object(new Art(artB, projectB, "Arte B", "Story", "Briefing B", null, "", "")));

      Workspace created = repository.read();
      Art snapshotted = findArt(created, artA);
      assertEquals("1080 x 1080", snapshotted.format());
      assertEquals("Post quadrado", snapshotted.templateName());
      assertEquals("Usar margem segura", snapshotted.templateInstructions());
      assertEquals(2, created.templates().size());
      assertNotEquals(created.templates().get(0).id(), created.templates().get(1).id());

      service.update("template", object(new Template(templateId, "Modelo editado", "Vertical", "Nova instrução")));
      assertEquals(snapshotted, findArt(repository.read(), artA));

      Workspace afterFirst = service.update("revision", revisionInput(artA, null, "Primeira", "Contexto 1"));
      firstRevision = afterFirst.revisions().get(0).id();
      Workspace afterSecond = service.update("revision-from", revisionInput(artA, firstRevision, "Segunda", "Contexto 2"));
      String secondRevision = afterSecond.revisions().get(1).id();
      service.update("revision-from", revisionInput(artA, firstRevision, "Terceira desde a primeira", "Contexto 3"));
      service.update("approve-revision", json("{\"id\":\"" + secondRevision + "\"}"));

      Workspace saved = repository.read();
      assertEquals(List.of(1, 2, 3), saved.revisions().stream().map(Revision::sequence).toList());
      assertEquals(firstRevision, saved.revisions().get(2).sourceRevisionId());
      assertNotNull(saved.revisions().get(1).approvedAt());
      assertNull(saved.revisions().get(0).approvedAt());
      assertNull(saved.revisions().get(2).approvedAt());
    }

    try (var reopened = new WorkspaceRepository(temp)) {
      Workspace data = reopened.read();
      assertEquals(2, data.projects().size());
      assertEquals(2, data.arts().size());
      assertEquals(2, data.templates().size());
      assertEquals(3, data.revisions().size());
      assertEquals(firstRevision, data.revisions().get(2).sourceRevisionId());
    }
  }

  @Test
  void invalidRelationsAndOperationsNeverPartiallyWrite() throws Exception {
    String clientId = UUID.randomUUID().toString();
    String projectId = UUID.randomUUID().toString();
    String artId = UUID.randomUUID().toString();
    try (var repository = new WorkspaceRepository(temp)) {
      var service = new WorkspaceService(repository);
      service.update("client", object(new Client(clientId, "Cliente Fictício", "", "", "", "", "")));
      service.update("project", object(new Project(projectId, clientId, "Projeto", "", "", "Rascunho")));
      service.update("art", object(new Art(artId, projectId, "Arte", "", "", null, "", "")));
      Workspace revisionData = service.update("revision", revisionInput(artId, null, "Original", "Contexto"));
      byte[] before = Files.readAllBytes(temp.resolve("workspace.json"));

      assertThrows(IllegalArgumentException.class,
          () -> service.update("project", object(new Project(UUID.randomUUID().toString(), UUID.randomUUID().toString(), "Órfão", "", "", "Rascunho"))));
      assertThrows(IllegalArgumentException.class,
          () -> service.update("art", object(new Art(UUID.randomUUID().toString(), UUID.randomUUID().toString(), "Órfã", "", "", null, "", ""))));
      assertThrows(IllegalArgumentException.class,
          () -> service.update("revision-from", revisionInput(artId, UUID.randomUUID().toString(), "Inválida", "")));
      assertThrows(IllegalArgumentException.class, () -> service.update("delete-project", new JsonObject()));

      Workspace broken = repository.read();
      broken.references().add(new Reference(
          UUID.randomUUID().toString(), clientId, null, artId, "órfã.png", "image/png", "", "2026-11-08T00:00:00Z"));
      assertThrows(IllegalArgumentException.class, () -> repository.save(broken));

      Workspace duplicateSequence = repository.read();
      Revision old = revisionData.revisions().get(0);
      duplicateSequence.revisions().add(new Revision(
          UUID.randomUUID().toString(), artId, 1, null, "Duplicada", List.of(), List.of(), "", "2026-11-08T00:00:00Z", null));
      assertThrows(IllegalArgumentException.class, () -> repository.save(duplicateSequence));
      assertNotNull(old);
      assertArrayEquals(before, Files.readAllBytes(temp.resolve("workspace.json")));
    }
  }

  @Test
  void v1AndV2BackupsRestoreWithSnapshotsAndInvalidBackupChangesNothing() throws Exception {
    Path exports = Files.createDirectory(temp.resolve("exports"));
    Path v2Backup = exports.resolve("v2.json");
    Path dataDir = temp.resolve("data");
    String clientId = UUID.randomUUID().toString();
    Workspace v2;
    try (var repository = new WorkspaceRepository(dataDir)) {
      new WorkspaceService(repository).update(
          "client", object(new Client(clientId, "Cliente do backup", "", "", "", "", "")));
      repository.exportBackup(v2Backup);
      v2 = repository.read();
    }

    Path restoredDir = temp.resolve("restored");
    try (var restored = new WorkspaceRepository(restoredDir)) {
      assertEquals(v2, restored.restore(v2Backup));
      byte[] currentV2 = Files.readAllBytes(restoredDir.resolve("workspace.json"));
      Workspace migratedV1 = restored.restore(legacyFixture);
      assertEquals(2, migratedV1.version());
      assertEquals("Marca Legada Fictícia", migratedV1.clients().get(0).name());
      try (var files = Files.list(restoredDir)) {
        Path snapshot = files
            .filter(path -> path.getFileName().toString().startsWith("workspace.json.before-restore-"))
            .findFirst()
            .orElseThrow();
        assertArrayEquals(currentV2, Files.readAllBytes(snapshot));
      }

      byte[] beforeInvalid = Files.readAllBytes(restoredDir.resolve("workspace.json"));
      long snapshotsBefore;
      try (var files = Files.list(restoredDir)) {
        snapshotsBefore = files.filter(path -> path.getFileName().toString().startsWith("workspace.json.before-restore-")).count();
      }
      Path invalid = exports.resolve("invalid.json");
      Files.writeString(invalid, "{invalid");
      assertThrows(IllegalArgumentException.class, () -> restored.restore(invalid));
      assertArrayEquals(beforeInvalid, Files.readAllBytes(restoredDir.resolve("workspace.json")));
      try (var files = Files.list(restoredDir)) {
        assertEquals(snapshotsBefore, files.filter(path -> path.getFileName().toString().startsWith("workspace.json.before-restore-")).count());
      }
    }

    try (var reopened = new WorkspaceRepository(restoredDir)) {
      assertEquals("Marca Legada Fictícia", reopened.read().clients().get(0).name());
    }
  }

  private JsonObject object(Object value) {
    return WorkspaceRepository.JSON.toJsonTree(value).getAsJsonObject();
  }

  private JsonObject json(String value) {
    return JsonParser.parseString(value).getAsJsonObject();
  }

  private JsonObject revisionInput(String artId, String sourceRevisionId, String instructions, String context) {
    JsonObject input = new JsonObject();
    input.addProperty("artId", artId);
    if (sourceRevisionId == null) input.add("sourceRevisionId", JsonNull.INSTANCE);
    else input.addProperty("sourceRevisionId", sourceRevisionId);
    input.addProperty("instructions", instructions);
    input.add("preserveElements", WorkspaceRepository.JSON.toJsonTree(List.of("logotipo", "cores")));
    input.add("modifyElements", WorkspaceRepository.JSON.toJsonTree(List.of("imagem principal")));
    input.addProperty("generatedContext", context);
    return input;
  }

  private Art findArt(Workspace data, String id) {
    return data.arts().stream().filter(art -> art.id().equals(id)).findFirst().orElseThrow();
  }

  private String validUuid(String value) {
    assertEquals(value, UUID.fromString(value).toString());
    return value;
  }
}
