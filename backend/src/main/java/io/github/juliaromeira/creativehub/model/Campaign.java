package io.github.juliaromeira.creativehub.model;

public record Campaign(
    String id,
    String clientId,
    String title,
    String objective,
    String audience,
    String format,
    String request,
    String status,
    String draft) {}
