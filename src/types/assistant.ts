export type AssistantMode =
  | "ask"
  | "generate"
  | "explain"
  | "fix";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  mode: AssistantMode;
  content: string;
  code?: string;
  taskId?: string;
  createdAt: string;
}

export interface TaskHandoffContext {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  milestoneTitle: string;
}

export type IndexedFileStatus =
  | "indexing"
  | "indexed"
  | "error";

export interface IndexedFile {
  id: string;
  projectId: string;
  name: string;
  path?: string;
  extension?: string;
  size: number;
  status: IndexedFileStatus;
  chunks?: number;
  createdAt: string;
  updatedAt?: string;
  error?: string;
}