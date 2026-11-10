package io.github.juliaromeira.creativehub.model;

import java.nio.charset.StandardCharsets;
import java.util.*;

/** Contrato persistido v2. Bases v1 são convertidas em memória pelo repositório. */
public final class Workspace {
  private final int version;
  private final List<Client> clients;
  private final List<Project> projects;
  private final List<Art> arts;
  private final List<Revision> revisions;
  private final List<Template> templates;
  private final List<Decision> decisions;
  private final List<Reference> references;
  private transient List<Campaign> legacyCampaigns;

  public Workspace(
      int version,
      List<Client> clients,
      List<Project> projects,
      List<Art> arts,
      List<Revision> revisions,
      List<Template> templates,
      List<Decision> decisions,
      List<Reference> references) {
    this.version = version;
    this.clients = clients;
    this.projects = projects;
    this.arts = arts;
    this.revisions = revisions;
    this.templates = templates;
    this.decisions = decisions;
    this.references = references;
  }

  /** Mantém fontes Java v1 compiláveis durante a integração das demais camadas. */
  public Workspace(
      int version,
      List<Client> clients,
      List<Campaign> campaigns,
      List<Decision> decisions,
      List<Reference> references) {
    this(
        version == 1 ? 2 : -1,
        clients,
        projects(campaigns),
        arts(campaigns),
        revisions(campaigns),
        new ArrayList<>(),
        decisions,
        references);
    legacyCampaigns = campaigns;
  }

  public static Workspace empty() {
    return new Workspace(
        2,
        new ArrayList<>(),
        new ArrayList<>(),
        new ArrayList<>(),
        new ArrayList<>(),
        new ArrayList<>(),
        new ArrayList<>(),
        new ArrayList<>());
  }

  public int version() {
    return version;
  }

  public List<Client> clients() {
    return clients;
  }

  public List<Project> projects() {
    return projects;
  }

  public List<Art> arts() {
    return arts;
  }

  public List<Revision> revisions() {
    return revisions;
  }

  public List<Template> templates() {
    return templates;
  }

  public List<Decision> decisions() {
    return decisions;
  }

  public List<Reference> references() {
    return references;
  }

  public List<Campaign> campaigns() {
    if (legacyCampaigns == null) legacyCampaigns = campaignsFromV2();
    return legacyCampaigns;
  }

  public static String migratedId(String kind, String sourceId) {
    return UUID.nameUUIDFromBytes((kind + ":" + sourceId).getBytes(StandardCharsets.UTF_8)).toString();
  }

  private List<Campaign> campaignsFromV2() {
    Map<String, Revision> firstRevision = new HashMap<>();
    for (Revision revision : revisions)
      if (revision.sequence() == 1) firstRevision.put(revision.artId(), revision);
    List<Campaign> result = new ArrayList<>();
    for (Project project : projects) {
      Art art = arts.stream().filter(a -> a.projectId().equals(project.id())).findFirst().orElse(null);
      Revision revision = art == null ? null : firstRevision.get(art.id());
      result.add(
          new Campaign(
              project.id(),
              project.clientId(),
              project.title(),
              project.objective(),
              project.audience(),
              art == null ? "" : art.format(),
              art == null ? "" : art.briefing(),
              project.status(),
              revision == null ? "" : revision.generatedContext()));
    }
    return result;
  }

  private static List<Project> projects(List<Campaign> campaigns) {
    return campaigns.stream()
        .map(c -> new Project(c.id(), c.clientId(), c.title(), c.objective(), c.audience(), c.status()))
        .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
  }

  private static List<Art> arts(List<Campaign> campaigns) {
    return campaigns.stream()
        .map(c -> new Art(migratedId("art", c.id()), c.id(), c.title(), c.format(), c.request(), null, "", ""))
        .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
  }

  private static List<Revision> revisions(List<Campaign> campaigns) {
    return campaigns.stream()
        .filter(c -> c.draft() != null && !c.draft().isEmpty())
        .map(
            c ->
                new Revision(
                    migratedId("revision", c.id()),
                    migratedId("art", c.id()),
                    1,
                    null,
                    "",
                    new ArrayList<>(),
                    new ArrayList<>(),
                    c.draft(),
                    null,
                    null))
        .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
  }

  @Override
  public boolean equals(Object other) {
    if (!(other instanceof Workspace workspace)) return false;
    return version == workspace.version
        && Objects.equals(clients, workspace.clients)
        && Objects.equals(projects, workspace.projects)
        && Objects.equals(arts, workspace.arts)
        && Objects.equals(revisions, workspace.revisions)
        && Objects.equals(templates, workspace.templates)
        && Objects.equals(decisions, workspace.decisions)
        && Objects.equals(references, workspace.references);
  }

  @Override
  public int hashCode() {
    return Objects.hash(version, clients, projects, arts, revisions, templates, decisions, references);
  }
}
