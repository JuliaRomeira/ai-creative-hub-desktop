package io.github.juliaromeira.creativehub.model;

public record Project(
    String id,
    String clientId,
    String title,
    String objective,
    String audience,
    String status) {}
