export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  order: number;
  tasks: Task[];
}

export interface Roadmap {
  projectId: string;
  milestones: Milestone[];
}