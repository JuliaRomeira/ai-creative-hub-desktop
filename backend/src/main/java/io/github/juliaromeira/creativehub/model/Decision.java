package io.github.juliaromeira.creativehub.model;

/** projectId nulo significa regra permanente do cliente. */
public record Decision(
    String id,
    String clientId,
    String projectId,
    String text,
    String createdAt,
    String invalidatedAt,
    String reason,
    String replaces) {
  /** Compatibilidade temporária com os chamadores v1. */
  public String campaignId() {
    return projectId;
  }
}
