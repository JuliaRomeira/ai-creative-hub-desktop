package io.github.juliaromeira.creativehub.model;

/** Dados permanentes de uma marca. Um record representa dados sem setters. */
public record Client(
    String id,
    String name,
    String description,
    String audience,
    String tone,
    String colors,
    String guidelines) {}
