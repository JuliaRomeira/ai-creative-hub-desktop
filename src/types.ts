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
export interface Decision {
  id: string;
  clientId: string;
  campaignId: string | null;
  text: string;
  createdAt: string;
  invalidatedAt: string | null;
  reason: string;
  replaces: string | null;
}
export interface Reference {
  id: string;
  clientId: string;
  name: string;
  mime: string;
  data: string;
  createdAt: string;
}
export interface Workspace {
  version: 1;
  clients: Client[];
  campaigns: Campaign[];
  decisions: Decision[];
  references: Reference[];
}
declare global {
  interface Window {
    hub: {
      read(): Promise<Workspace>;
      update(type: string, input: unknown): Promise<Workspace>;
      context(clientId: string, campaignId: string): Promise<string>;
      attach(id: string): Promise<Workspace | null>;
      saveReference(id: string): Promise<boolean>;
      copy(text: string): Promise<boolean>;
      export(): Promise<boolean>;
      import(): Promise<Workspace | null>;
    };
  }
}
