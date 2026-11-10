package io.github.juliaromeira.creativehub.model;

public record Art(
    String id,
    String projectId,
    String title,
    String format,
    String briefing,
    String templateId,
    String templateName,
    String templateInstructions) {}
