package io.github.juliaromeira.creativehub.model;

/** campaignId nulo significa regra permanente do cliente. */
public record Decision(
    String id,
    String clientId,
    String campaignId,
    String text,
    String createdAt,
    String invalidatedAt,
    String reason,
    String replaces) {}
