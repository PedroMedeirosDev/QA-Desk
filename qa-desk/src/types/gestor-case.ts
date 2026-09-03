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
  /** Evidências do bug ligado — só na API, para baixar e anexar no Discord. */
  attachments?: GestorCaseAttachment[];
  /** Texto já formatado para o Discord (este caso só). */
  discordMessage?: string;
}

export interface GestorCaseAttachment {
  fileId: string;
  filename: string;
  type: "screenshot" | "video" | "log";
  sizeBytes: number;
  storageKey: string;
}

export interface GestorCasesListResponse {
  cases: GestorCase[];
  suggestedNextNumber: number;
  author: string;
  discordChannelUrl?: string;
}
