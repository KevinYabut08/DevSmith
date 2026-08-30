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
