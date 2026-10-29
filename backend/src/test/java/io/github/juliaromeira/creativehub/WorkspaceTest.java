package io.github.juliaromeira.creativehub;

import static org.junit.jupiter.api.Assertions.*;

import com.google.gson.JsonObject;
import io.github.juliaromeira.creativehub.model.*;
import io.github.juliaromeira.creativehub.persistence.WorkspaceRepository;
import io.github.juliaromeira.creativehub.service.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class WorkspaceTest {
  @TempDir Path temp;
  final Path fixture = Path.of("../tests/fixtures/legacy-v1.json");

  private WorkspaceRepository legacy() throws Exception {
    Files.copy(fixture, temp.resolve("workspace.json"));
    return new WorkspaceRepository(temp);
  }

  private JsonObject input(String json) {
    return WorkspaceRepository.JSON.fromJson(json, JsonObject.class);
  }

  @Test
  void legacyReadDoesNotWriteAndFirstSavePreservesOriginalBytes() throws Exception {
    byte[] original = Files.readAllBytes(fixture);
    try (var repo = legacy()) {
      Workspace data = repo.read();
      assertEquals("Marca Legada Fictícia", data.clients().get(0).name());
      assertEquals("Rascunho editado na versão anterior.", data.campaigns().get(0).draft());
      assertArrayEquals(original, Files.readAllBytes(temp.resolve("workspace.json")));
      assertFalse(Files.exists(temp.resolve("workspace.json.before-java-v020")));
      repo.save(data);
      repo.save(repo.read());
      assertArrayEquals(
          original, Files.readAllBytes(temp.resolve("workspace.json.before-java-v020")));
      assertEquals(data, repo.read());
    }
  }

  @Test
  void correctionAndInvalidationKeepHistoryAndContextUsesOnlyValidDecisions() throws Exception {
    try (var repo = legacy()) {
      var service = new WorkspaceService(repo);
      Workspace before = repo.read();
      Decision old = before.decisions().get(1);
      JsonObject change = new JsonObject();
      change.addProperty("id", old.id());
      change.addProperty("reason", "Revisão aprovada");
      change.addProperty("text", "Nova orientação válida");
      Workspace after = service.update("correct", change);
      assertEquals(before.decisions().size() + 1, after.decisions().size());
      assertNotNull(after.decisions().get(1).invalidatedAt());
      assertEquals(old.id(), after.decisions().get(3).replaces());
      assertThrows(IllegalArgumentException.class, () -> service.update("invalidate", change));
      String context =
          new ContextService()
              .prepare(after, before.clients().get(0).id(), before.campaigns().get(0).id());
      assertTrue(context.contains("Nova orientação válida"));
      assertFalse(context.contains("Regra permanente válida"));
      assertTrue(context.contains("referencia.png"));
    }
  }

  @Test
  void contextDoesNotMixCampaignsOrClients() throws Exception {
    try (var repo = legacy()) {
      Workspace data = repo.read();
      Campaign other =
          new Campaign(
              UUID.randomUUID().toString(),
              data.clients().get(0).id(),
              "Outra",
              "",
              "",
              "",
              "",
              "Rascunho",
              "");
      data.campaigns().add(other);
      String context = new ContextService().prepare(data, other.clientId(), other.id());
      assertTrue(context.contains("Regra permanente válida"));
      assertFalse(context.contains("Decisão da campanha legada"));
      assertThrows(
          IllegalArgumentException.class,
          () -> new ContextService().prepare(data, UUID.randomUUID().toString(), other.id()));
    }
  }

  @Test
  void malformedBackupAndInvalidRelationshipsNeverOverwriteData() throws Exception {
    try (var repo = legacy()) {
      byte[] original = Files.readAllBytes(temp.resolve("workspace.json"));
      Path bad = temp.resolve("bad.json");
      Files.writeString(bad, "{broken");
      assertThrows(IllegalArgumentException.class, () -> repo.restore(bad));
      Workspace data = repo.read();
      data.clients().clear();
      assertThrows(IllegalArgumentException.class, () -> repo.save(data));
      Workspace duplicates = repo.read();
      duplicates.clients().add(duplicates.clients().get(0));
      assertThrows(IllegalArgumentException.class, () -> repo.save(duplicates));
      Workspace unknown =
          new Workspace(
              2, new ArrayList<>(), new ArrayList<>(), new ArrayList<>(), new ArrayList<>());
      assertThrows(IllegalArgumentException.class, () -> repo.save(unknown));
      assertArrayEquals(original, Files.readAllBytes(temp.resolve("workspace.json")));
    }
  }

  @Test
  void referencesAndBackupSurviveOriginalRemovalAndRestart() throws Exception {
    Path backupDir = Files.createDirectory(temp.resolve("backup"));
    Path backup = backupDir.resolve("backup.json");
    byte[] expected = "%PDF-1.4\nFictício".getBytes(java.nio.charset.StandardCharsets.UTF_8);
    String referenceId;
    try (var repo = legacy()) {
      var service = new WorkspaceService(repo);
      Path original = temp.resolve("exemplo.pdf");
      Files.write(original, expected);
      Workspace data =
          service.addReferences(repo.read().clients().get(0).id(), List.of(original.toString()));
      referenceId = data.references().get(1).id();
      Files.delete(original);
      repo.exportBackup(backup);
    }
    try (var restored = new WorkspaceRepository(temp.resolve("restored"))) {
      restored.restore(backup);
      Path copy = backupDir.resolve("copy.pdf");
      new WorkspaceService(restored).saveReference(referenceId, copy);
      assertArrayEquals(expected, Files.readAllBytes(copy));
    }
  }

  @Test
  void oversizedAttachmentsAndInvalidFieldsAreRejectedWithoutPartialSave() throws Exception {
    try (var repo = legacy()) {
      var service = new WorkspaceService(repo);
      byte[] original = Files.readAllBytes(temp.resolve("workspace.json"));
      Path huge = temp.resolve("large.png");
      Files.write(huge, new byte[10 * 1024 * 1024 + 1]);
      assertThrows(
          IllegalArgumentException.class,
          () -> service.addReferences(repo.read().clients().get(0).id(), List.of(huge.toString())));
      JsonObject invalid = input("{\"id\":\"invalid\",\"name\":\" \"}");
      assertThrows(IllegalArgumentException.class, () -> service.update("client", invalid));
      Campaign campaign = repo.read().campaigns().get(0);
      JsonObject moved = WorkspaceRepository.JSON.toJsonTree(campaign).getAsJsonObject();
      moved.addProperty("clientId", UUID.randomUUID().toString());
      assertThrows(IllegalArgumentException.class, () -> service.update("campaign", moved));
      assertArrayEquals(original, Files.readAllBytes(temp.resolve("workspace.json")));
    }
  }

  @Test
  void restoreKeepsSeparateRecoverySnapshot() throws Exception {
    try (var repo = legacy()) {
      byte[] original = Files.readAllBytes(temp.resolve("workspace.json"));
      repo.restore(fixture);
      repo.save(repo.read());
      try (var files = Files.list(temp)) {
        Path snapshot =
            files
                .filter(
                    p -> p.getFileName().toString().startsWith("workspace.json.before-restore-"))
                .findFirst()
                .orElseThrow();
        assertArrayEquals(original, Files.readAllBytes(snapshot));
      }
    }
  }

  @Test
  void secondWriterCannotAcquireSameDatabase() throws Exception {
    try (var repo = legacy()) {
      assertThrows(Exception.class, () -> new WorkspaceRepository(temp));
      assertEquals(1, repo.read().clients().size());
    }
    try (var repo = new WorkspaceRepository(temp)) {
      assertEquals(1, repo.read().clients().size());
    }
  }

  @Test
  void exportCannotOverwriteInternalFiles() throws Exception {
    try (var repo = legacy()) {
      byte[] original = Files.readAllBytes(temp.resolve("workspace.json"));
      assertThrows(
          java.io.IOException.class, () -> repo.exportBackup(temp.resolve("workspace.json")));
      assertArrayEquals(original, Files.readAllBytes(temp.resolve("workspace.json")));
    }
  }
}
