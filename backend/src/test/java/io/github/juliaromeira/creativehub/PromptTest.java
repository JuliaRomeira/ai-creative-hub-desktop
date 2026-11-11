package io.github.juliaromeira.creativehub;

import static org.junit.jupiter.api.Assertions.*;

import io.github.juliaromeira.creativehub.model.*;
import io.github.juliaromeira.creativehub.persistence.WorkspaceRepository;
import io.github.juliaromeira.creativehub.service.ContextService;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.List;
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

  @Test
  void revisionContextCombinesTheSelectedChainWithoutLeakingOtherProjects() {
    Client client = new Client("client-a", "Marca A", "Empresa A", "Designers", "Direto",
        "Azul e branco", "O logotipo e a tipografia devem permanecer.");
    Project project = new Project("project-a", client.id(), "Instagram de lançamento",
        "Apresentar produto", "Designers", "Em andamento");
    Art art = new Art("art-a", project.id(), "Publicação principal", "Instagram 1080x1350",
        "Destacar o produto Alpha", "template-a", "Post editorial", "Usar hierarquia clara");
    Revision revision = new Revision("revision-a", art.id(), 2, null,
        "Trocar somente a imagem principal.", List.of("cores", "logotipo", "tipografia"),
        List.of("imagem principal"), "", "2026-11-11T12:00:00Z", null);
    Workspace data = new Workspace(2,
        new ArrayList<>(List.of(client, new Client("client-b", "MARCA PRIVADA B", "", "", "", "", ""))),
        new ArrayList<>(List.of(project,
            new Project("project-other", client.id(), "PROJETO PRIVADO A2", "", "", "Rascunho"),
            new Project("project-b", "client-b", "PROJETO PRIVADO B", "", "", "Rascunho"))),
        new ArrayList<>(List.of(art,
            new Art("art-other", "project-other", "ARTE PRIVADA A2", "", "", null, "", ""))),
        new ArrayList<>(List.of(revision)), new ArrayList<>(),
        new ArrayList<>(List.of(
            new Decision("rule-a", client.id(), null, "Manter sempre o logotipo e a tipografia.", "", null, "", null),
            new Decision("project-decision", client.id(), project.id(), "Usar chamada curta.", "", null, "", null),
            new Decision("other-decision", client.id(), "project-other", "DECISÃO PRIVADA A2", "", null, "", null))),
        new ArrayList<>(List.of(
            new Reference("ref-a", client.id(), project.id(), art.id(), "produto-alpha.png", "image/png", "", ""),
            new Reference("ref-other", client.id(), "project-other", "art-other", "REFERÊNCIA PRIVADA A2", "image/png", "", ""),
            new Reference("ref-b", "client-b", "project-b", null, "REFERÊNCIA PRIVADA B", "image/png", "", ""))));
    String original = WorkspaceRepository.JSON.toJson(data);

    String text = new ContextService().prepare(
        data, client.id(), project.id(), art.id(), revision.id(), "art");

    assertAll(
        () -> assertTrue(text.contains("Instagram de lançamento")),
        () -> assertTrue(text.contains("Post editorial")),
        () -> assertTrue(text.contains("Destacar o produto Alpha")),
        () -> assertTrue(text.contains("Trocar somente a imagem principal")),
        () -> assertTrue(text.contains("Preservar: cores, logotipo, tipografia")),
        () -> assertTrue(text.contains("Modificar: imagem principal")),
        () -> assertTrue(text.contains("Azul e branco")),
        () -> assertTrue(text.contains("produto-alpha.png")),
        () -> assertFalse(text.contains("PRIVAD")),
        () -> assertEquals(original, WorkspaceRepository.JSON.toJson(data)),
        () -> assertThrows(IllegalArgumentException.class,
            () -> new ContextService().prepare(data, client.id(), project.id(), "art-other", null, "art")));
  }

  @Test
  void revisionConflictWithPreservedOrMandatoryElementsIsRejected() {
    Client client = new Client("client", "Marca", "", "", "", "", "O logotipo deve permanecer.");
    Project project = new Project("project", client.id(), "Projeto", "", "", "Rascunho");
    Art art = new Art("art", project.id(), "Arte", "", "", null, "", "");
    Revision overlap = new Revision("overlap", art.id(), 1, null, "",
        List.of("logotipo"), List.of("logotipo"), "", "", null);
    Revision mandatory = new Revision("mandatory", art.id(), 2, null, "Remover o logotipo.",
        List.of(), List.of("logotipo"), "", "", null);
    Workspace data = new Workspace(2, new ArrayList<>(List.of(client)),
        new ArrayList<>(List.of(project)), new ArrayList<>(List.of(art)),
        new ArrayList<>(List.of(overlap, mandatory)), new ArrayList<>(), new ArrayList<>(), new ArrayList<>());
    ContextService service = new ContextService();

    assertAll(
        () -> assertThrows(IllegalArgumentException.class,
            () -> service.prepare(data, client.id(), project.id(), art.id(), overlap.id(), "context")),
        () -> assertThrows(IllegalArgumentException.class,
            () -> service.prepare(data, client.id(), project.id(), art.id(), mandatory.id(), "context")));
  }
}
