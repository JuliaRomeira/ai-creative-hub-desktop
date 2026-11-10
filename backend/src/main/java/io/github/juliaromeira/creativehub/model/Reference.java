package io.github.juliaromeira.creativehub.model;

public record Reference(
    String id,
    String clientId,
    String projectId,
    String artId,
    String name,
    String mime,
    String data,
    String createdAt) {
  public Reference(
      String id, String clientId, String name, String mime, String data, String createdAt) {
    this(id, clientId, null, null, name, mime, data, createdAt);
  }
}
