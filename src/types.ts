export type ContextOutput = "art" | "script" | "image-prompt" | "context";
export interface Client {
  id: string;
  name: string;
  description: string;
  audience: string;
  tone: string;
  colors: string;
  guidelines: string;
}
export interface Campaign {
  id: string;
  clientId: string;
  title: string;
  objective: string;
  audience: string;
  format: string;
  request: string;
  status: "Rascunho" | "Em andamento" | "Aprovada" | "Concluída";
  draft: string;
}
export interface Project {
  id: string;
  clientId: string;
  title: string;
  objective: string;
  audience: string;
  status: Campaign["status"];
}
export interface Art {
  id: string;
  projectId: string;
  title: string;
  format: string;
  briefing: string;
  templateId: string | null;
  templateName: string;
  templateInstructions: string;
}
export interface Revision {
  id: string;
  artId: string;
  sequence: number;
  sourceRevisionId: string | null;
  instructions: string;
  preserveElements: string[];
  modifyElements: string[];
  generatedContext: string;
  createdAt: string | null;
  approvedAt: string | null;
}
export interface ArtTemplate {
  id: string;
  name: string;
  format: string;
  instructions: string;
}
export interface Decision {
  id: string;
  clientId: string;
  projectId: string | null;
  text: string;
  createdAt: string;
  invalidatedAt: string | null;
  reason: string;
  replaces: string | null;
}
export interface Reference {
  id: string;
  clientId: string;
  projectId: string | null;
  artId: string | null;
  name: string;
  mime: string;
  data: string;
  createdAt: string;
}
export interface Workspace {
  version: 2;
  clients: Client[];
  projects: Project[];
  arts: Art[];
  revisions: Revision[];
  templates: ArtTemplate[];
  decisions: Decision[];
  references: Reference[];
}
declare global {
  interface Window {
    hub: {
      read(): Promise<Workspace>;
      update(type: string, input: unknown): Promise<Workspace>;
      context(
        clientId: string,
        campaignId: string,
        output?: ContextOutput,
      ): Promise<string>;
      attach(id: string): Promise<Workspace | null>;
      saveReference(id: string): Promise<boolean>;
      copy(text: string): Promise<boolean>;
      export(): Promise<boolean>;
      import(): Promise<Workspace | null>;
    };
  }
}
