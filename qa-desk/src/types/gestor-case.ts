export type GestorCaseStatus = "pendente" | "devolvido";
export type GestorCaseEntryKind = "intro" | "continuacao";

export interface GestorCaseEntry {
  at: string;
  kind: GestorCaseEntryKind;
  body: string;
}

export interface GestorCase {
  id: string;
  number: number;
  author: string;
  title: string;
  status: GestorCaseStatus;
  discordUrl: string;
  internalRef?: string;
  linkedTestId?: string;
  entries: GestorCaseEntry[];
  createdAt: string;
  updatedAt: string;
  devolvidoAt?: string;
}

export interface GestorCasesListResponse {
  cases: GestorCase[];
  suggestedNextNumber: number;
  author: string;
  discordChannelUrl?: string;
}
