package io.github.juliaromeira.creativehub;

import static org.junit.jupiter.api.Assertions.*;

import io.github.juliaromeira.creativehub.model.*;
import io.github.juliaromeira.creativehub.persistence.WorkspaceRepository;
import io.github.juliaromeira.creativehub.service.ContextService;
import java.nio.file.*;
import org.junit.jupiter.api.Test;

class PromptTest {
  private Workspace fixture() throws Exception {
    return WorkspaceRepository.JSON.fromJson(
        Files.readString(Path.of("../tests/fixtures/legacy-v1.json")), Workspace.class);
  }

  @Test
  void legacyAndExplicitContextRemainIdenticalWithoutChangingData() throws Exception {
    Workspace data = fixture();
    String original = WorkspaceRepository.JSON.toJson(data);
    var service = new ContextService();
    var campaign = data.campaigns().get(0);
    String legacy = service.prepare(data, campaign.clientId(), campaign.id());
    assertTrue(legacy.startsWith("CONTEXTO CRIATIVO"));
    assertEquals(legacy, service.prepare(data, campaign.clientId(), campaign.id(), null));
    assertEquals(legacy, service.prepare(data, campaign.clientId(), campaign.id(), "context"));
    assertThrows(IllegalArgumentException.class,
        () -> service.prepare(data, campaign.clientId(), campaign.id(), "invalid"));
    assertEquals(original, WorkspaceRepository.JSON.toJson(data));
  }

  @Test
  void everyOutputKeepsOnlySelectedClientCampaignAndValidDecisions() throws Exception {
    Workspace data = fixture();
    var campaign = data.campaigns().get(0);
    data.clients().add(new Client("other", "MARCA PRIVADA B", "", "", "", "", ""));
    data.campaigns().add(new Campaign("other-campaign", "other", "CAMPANHA B", "", "", "", "", "Rascunho", ""));
    data.decisions().add(new Decision("other-rule", "other", null, "REGRA PRIVADA B", "2026-11-05", null, "", null));
    data.decisions().add(new Decision("same-client-other-campaign", campaign.clientId(), "elsewhere", "DECISÃO OUTRA CAMPANHA", "2026-11-05", null, "", null));
    for (String output : new String[] {"art", "script", "image-prompt", "context"}) {
      String text = new ContextService().prepare(data, campaign.clientId(), campaign.id(), output);
      assertTrue(text.contains("Regra permanente válida"), output);
      assertTrue(text.contains("Decisão da campanha legada"), output);
      assertTrue(text.contains("referencia.png"), output);
      assertFalse(text.contains("Regra anterior"), output);
      assertFalse(text.contains("PRIVADA B"), output);
      assertFalse(text.contains("CAMPANHA B"), output);
      assertFalse(text.contains("DECISÃO OUTRA CAMPANHA"), output);
      assertThrows(IllegalArgumentException.class,
          () -> new ContextService().prepare(data, "other", campaign.id(), output));
    }
  }
}
