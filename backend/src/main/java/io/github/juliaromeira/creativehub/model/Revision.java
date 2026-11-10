package io.github.juliaromeira.creativehub.model;

import java.util.List;

public record Revision(
    String id,
    String artId,
    int sequence,
    String sourceRevisionId,
    String instructions,
    List<String> preserveElements,
    List<String> modifyElements,
    String generatedContext,
    String createdAt,
    String approvedAt) {}
