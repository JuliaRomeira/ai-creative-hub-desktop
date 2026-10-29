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

  public void validate(Workspace data) {
    require(data != null && data.version() == 1, "Versão de dados não suportada.");
    size(data.clients(), 1000);
    size(data.campaigns(), 10000);
    size(data.decisions(), 20000);
    size(data.references(), 1000);
    Set<String> allIds = new HashSet<>();
    Set<String> clients = new HashSet<>();
    Map<String, Campaign> campaigns = new HashMap<>();
    Map<String, Decision> decisions = new HashMap<>();
    for (Client c : data.clients()) {
      unique(c.id(), allIds);
      clients.add(c.id());
      text(c.name(), true, 20000);
      for (String value :
          new String[] {c.description(), c.audience(), c.tone(), c.colors(), c.guidelines()})
        text(value, false, 20000);
    }
    for (Campaign c : data.campaigns()) {
      unique(c.id(), allIds);
      require(clients.contains(c.clientId()), "Cliente da campanha não existe.");
      campaigns.put(c.id(), c);
      text(c.title(), true, 20000);
      for (String value : new String[] {c.objective(), c.audience(), c.format(), c.request()})
        text(value, false, 20000);
      text(c.draft(), false, 200000);
      require(
          c.status() != null
              && Set.of("Rascunho", "Em andamento", "Aprovada", "Concluída").contains(c.status()),
          "Status inválido.");
    }
    for (Decision d : data.decisions()) {
      unique(d.id(), allIds);
      require(clients.contains(d.clientId()), "Cliente da orientação não existe.");
      decisions.put(d.id(), d);
      text(d.text(), true, 20000);
      text(d.reason(), false, 20000);
      date(d.createdAt());
      if (d.invalidatedAt() != null) date(d.invalidatedAt());
      if (d.campaignId() != null)
        require(
            campaigns.containsKey(d.campaignId())
                && campaigns.get(d.campaignId()).clientId().equals(d.clientId()),
            "Campanha da orientação inválida.");
    }
    for (Decision d : data.decisions()) {
      if (d.replaces() == null) continue;
      Decision old = decisions.get(d.replaces());
      require(
          old != null
              && !old.id().equals(d.id())
              && old.invalidatedAt() != null
              && old.clientId().equals(d.clientId())
              && Objects.equals(old.campaignId(), d.campaignId()),
          "Histórico de correção inválido.");
    }
    for (Reference r : data.references()) {
      unique(r.id(), allIds);
      require(clients.contains(r.clientId()), "Cliente da referência não existe.");
      text(r.name(), true, 255);
      date(r.createdAt());
      require(r.mime() != null && MIME_TYPES.contains(r.mime()), "Tipo de referência inválido.");
      text(r.data(), false, 14000000);
      byte[] bytes;
      try {
        bytes = Base64.getDecoder().decode(r.data());
      } catch (IllegalArgumentException e) {
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
    } catch (Exception e) {
      throw new IllegalArgumentException("Data inválida.");
    }
  }
}
