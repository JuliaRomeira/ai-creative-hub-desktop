package io.github.juliaromeira.creativehub.model;

import java.util.ArrayList;
import java.util.List;

/** Mantém o contrato JSON da versão 0.1.0 para preservar bases e backups. */
public record Workspace(
    int version,
    List<Client> clients,
    List<Campaign> campaigns,
    List<Decision> decisions,
    List<Reference> references) {
  public static Workspace empty() {
    return new Workspace(
        1, new ArrayList<>(), new ArrayList<>(), new ArrayList<>(), new ArrayList<>());
  }
}
