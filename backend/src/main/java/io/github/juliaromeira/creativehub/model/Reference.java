package io.github.juliaromeira.creativehub.model;

public record Reference(
    String id, String clientId, String name, String mime, String data, String createdAt) {}
