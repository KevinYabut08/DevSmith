export type ProjectStatus = "Planning" | "In Progress" | "Completed";

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
}