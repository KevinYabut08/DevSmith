import {
  ArrowLeft,
  Bot,
  Check,
  Circle,
  Pencil,
  Plus,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";

import ProjectAssistant from "./ProjectAssistant";
import type { TaskHandoffContext } from "../types/assistant";
import type { Project } from "../types/project";
import type { Milestone, Roadmap, Task } from "../types/roadmap";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

interface ProjectWorkspaceProps {
  project: Project;
  model: string | null;
  onBack: () => void;
}

type WorkspaceTab = "roadmap" | "assistant";

function ProjectWorkspace({
  project,
  model,
  onBack,
}: ProjectWorkspaceProps) {
  const [activeTab, setActiveTab] =
    useState<WorkspaceTab>("roadmap");
  const [taskHandoff, setTaskHandoff] =
    useState<TaskHandoffContext | null>(null);
  const [roadmap, setRoadmap] =
    useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] =
    useState(false);
  const [error, setError] = useState("");

  const loadRoadmap = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get<Roadmap>(
        `${API_BASE_URL}/api/projects/${project.id}/roadmap`
      );

      setRoadmap(response.data);
    } catch (err) {
      console.error("Failed to load roadmap:", err);
      setError("Failed to load roadmap.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoadmap();
  }, [project.id]);

  const generateRoadmap = async () => {
    if (!model) {
      setError(
        "No Ollama model selected. Open Settings and select a model first."
      );
      return;
    }

    try {
      setGenerating(true);
      setError("");

      await axios.post(
        `${API_BASE_URL}/api/projects/${project.id}/roadmap/generate`,
        { model }
      );

      await loadRoadmap();
    } catch (err: any) {
      console.error(
        "Failed to generate roadmap:",
        err
      );

      if (err.response?.status === 409) {
        await loadRoadmap();
      } else {
        setError(
          err.response?.data?.error ||
            "Failed to generate roadmap."
        );
      }
    } finally {
      setGenerating(false);
    }
  };

  const toggleTask = async (
    taskId: string,
    completed: boolean
  ) => {
    try {
      setError("");

      setRoadmap((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          milestones: prev.milestones.map(
            (milestone) => ({
              ...milestone,
              tasks: milestone.tasks.map(
                (task) =>
                  task.id === taskId
                    ? { ...task, completed }
                    : task
              ),
            })
          ),
        };
      });

      await axios.patch(
        `${API_BASE_URL}/api/projects/${project.id}/roadmap/tasks/${taskId}`,
        { completed }
      );
    } catch (err) {
      console.error("Failed to update task:", err);
      await loadRoadmap();
      setError(
        "Failed to update task. Please try again."
      );
    }
  };

  const updateMilestone = async (
    milestoneId: string,
    data: { title: string; description: string }
  ) => {
    await axios.patch(
      `${API_BASE_URL}/api/projects/${project.id}/roadmap/milestones/${milestoneId}`,
      data
    );
    await loadRoadmap();
  };

  const deleteMilestone = async (
    milestoneId: string
  ) => {
    await axios.delete(
      `${API_BASE_URL}/api/projects/${project.id}/roadmap/milestones/${milestoneId}`
    );
    await loadRoadmap();
  };

  const addMilestone = async () => {
    await axios.post(
      `${API_BASE_URL}/api/projects/${project.id}/roadmap/milestones`,
      {
        title: "New milestone",
        description: "",
      }
    );
    await loadRoadmap();
  };

  const updateTask = async (
    taskId: string,
    data: { title: string; description: string }
  ) => {
    await axios.patch(
      `${API_BASE_URL}/api/projects/${project.id}/roadmap/tasks/${taskId}`,
      data
    );
    await loadRoadmap();
  };

  const addTask = async (milestoneId: string) => {
    await axios.post(
      `${API_BASE_URL}/api/projects/${project.id}/roadmap/milestones/${milestoneId}/tasks`,
      {
        title: "New task",
        description: "",
      }
    );
    await loadRoadmap();
  };

  const deleteTask = async (taskId: string) => {
    await axios.delete(
      `${API_BASE_URL}/api/projects/${project.id}/roadmap/tasks/${taskId}`
    );
    await loadRoadmap();
  };

  const openTaskInAssistant = (
    task: Task,
    milestoneTitle: string
  ) => {
    setTaskHandoff({
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description,
      milestoneTitle,
    });
    setActiveTab("assistant");
  };

  const totalTasks =
    roadmap?.milestones.reduce(
      (total, milestone) =>
        total + milestone.tasks.length,
      0
    ) ?? 0;

  const completedTasks =
    roadmap?.milestones.reduce(
      (total, milestone) =>
        total +
        milestone.tasks.filter(
          (task) => task.completed
        ).length,
      0
    ) ?? 0;

  const progress =
    totalTasks === 0
      ? 0
      : Math.round(
          (completedTasks / totalTasks) * 100
        );

  return (
    <main className="min-h-screen bg-[#071A1F] text-[#F4FFFC]">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-10 py-5">
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#7B9998] transition hover:bg-white/[0.04] hover:text-[#F4FFFC]"
          >
            <ArrowLeft size={17} />
            Projects
          </button>

          <span className="text-[#38585B]">/</span>

          <span className="text-sm text-[#B8F2E6]">
            {project.title}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-10 py-10">
        <section className="mb-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md border border-[#F2A65A]/20 bg-[#F2A65A]/10 px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-[#F2A65A]">
                  {project.status}
                </span>

                <span className="font-mono text-xs text-[#5C8A85]">
                  #{project.id.slice(0, 8)}
                </span>
              </div>

              <h1 className="font-mono text-3xl font-bold tracking-tight">
                {project.title}
              </h1>

              <p className="mt-3 max-w-2xl leading-relaxed text-[#8FA9A8]">
                {project.description ||
                  "No project description provided."}
              </p>
            </div>

            <div className="min-w-[220px] rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#7B9998]">
                  Progress
                </span>

                <span className="font-mono text-sm font-semibold text-[#B8F2E6]">
                  {progress}%
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-[#7FD8AE] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-[#5C8A85]">
                {completedTasks} of {totalTasks} tasks
                completed
              </p>
            </div>
          </div>
        </section>

        <div className="mb-8 flex gap-2 border-b border-white/[0.06]">
          <button
            type="button"
            onClick={() => setActiveTab("roadmap")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
              activeTab === "roadmap"
                ? "border-[#7FD8AE] text-[#B8F2E6]"
                : "border-transparent text-[#7B9998] hover:text-[#F4FFFC]"
            }`}
          >
            <Terminal size={16} />
            Roadmap
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("assistant")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
              activeTab === "assistant"
                ? "border-[#7FD8AE] text-[#B8F2E6]"
                : "border-transparent text-[#7B9998] hover:text-[#F4FFFC]"
            }`}
          >
            <Bot size={16} />
            AI Assistant
          </button>
        </div>

        {activeTab === "assistant" ? (
          <ProjectAssistant
            project={project}
            model={model}
            taskContext={taskHandoff}
            onClearTaskContext={() =>
              setTaskHandoff(null)
            }
          />
        ) : (
          <section>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Terminal
                    size={17}
                    className="text-[#7FD8AE]"
                  />

                  <h2 className="text-xl font-semibold">
                    Development Roadmap
                  </h2>
                </div>

                <p className="mt-1 text-sm text-[#7B9998]">
                  Edit milestones and tasks, or open a
                  task in the AI Assistant.
                </p>

                {model && (
                  <p className="mt-2 font-mono text-[11px] text-[#5C8A85]">
                    Using model: {model}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {roadmap &&
                  roadmap.milestones.length > 0 && (
                    <button
                      type="button"
                      onClick={addMilestone}
                      className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-[#B8F2E6] transition hover:bg-white/[0.06]"
                    >
                      <Plus size={16} />
                      Add milestone
                    </button>
                  )}

                {(!roadmap ||
                  roadmap.milestones.length === 0) && (
                  <button
                    onClick={generateRoadmap}
                    disabled={generating}
                    className="flex items-center justify-center gap-2 rounded-lg bg-[#F2A65A] px-4 py-2.5 text-sm font-semibold text-[#071A1F] transition hover:bg-[#F5B673] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles
                      size={17}
                      className={
                        generating
                          ? "animate-pulse"
                          : ""
                      }
                    />

                    {generating
                      ? "Generating..."
                      : "Generate Roadmap"}
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-3 text-sm text-[#7B9998]">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#7FD8AE]/20 border-t-[#7FD8AE]" />
                  Loading roadmap...
                </div>
              </div>
            ) : roadmap &&
              roadmap.milestones.length > 0 ? (
              <div className="space-y-5">
                {roadmap.milestones.map(
                  (milestone, index) => (
                    <MilestoneCard
                      key={milestone.id}
                      milestone={milestone}
                      index={index}
                      onToggleTask={toggleTask}
                      onUpdateMilestone={
                        updateMilestone
                      }
                      onDeleteMilestone={
                        deleteMilestone
                      }
                      onUpdateTask={updateTask}
                      onAddTask={addTask}
                      onDeleteTask={deleteTask}
                      onOpenInAssistant={
                        openTaskInAssistant
                      }
                    />
                  )
                )}
              </div>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.10] bg-white/[0.015] text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-[#7FD8AE]/20 bg-[#0E5666]/25">
                  <Sparkles
                    size={24}
                    className="text-[#B8F2E6]"
                  />
                </div>

                <h3 className="text-lg font-semibold">
                  No roadmap yet
                </h3>

                <p className="mt-2 max-w-md text-sm text-[#7B9998]">
                  Generate a development roadmap to
                  turn this idea into actionable
                  steps.
                </p>

                <button
                  onClick={generateRoadmap}
                  disabled={generating}
                  className="mt-6 flex items-center gap-2 rounded-lg bg-[#F2A65A] px-5 py-2.5 text-sm font-semibold text-[#071A1F] transition hover:bg-[#F5B673] disabled:opacity-50"
                >
                  <Sparkles size={17} />

                  {generating
                    ? "Generating..."
                    : "Generate Roadmap"}
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function MilestoneCard({
  milestone,
  index,
  onToggleTask,
  onUpdateMilestone,
  onDeleteMilestone,
  onUpdateTask,
  onAddTask,
  onDeleteTask,
  onOpenInAssistant,
}: {
  milestone: Milestone;
  index: number;
  onToggleTask: (
    taskId: string,
    completed: boolean
  ) => void;
  onUpdateMilestone: (
    milestoneId: string,
    data: { title: string; description: string }
  ) => Promise<void>;
  onDeleteMilestone: (
    milestoneId: string
  ) => Promise<void>;
  onUpdateTask: (
    taskId: string,
    data: { title: string; description: string }
  ) => Promise<void>;
  onAddTask: (milestoneId: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onOpenInAssistant: (
    task: Task,
    milestoneTitle: string
  ) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(
    milestone.title
  );
  const [description, setDescription] = useState(
    milestone.description
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(milestone.title);
    setDescription(milestone.description);
  }, [milestone.title, milestone.description]);

  const save = async () => {
    setSaving(true);

    try {
      await onUpdateMilestone(milestone.id, {
        title,
        description,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const completed = milestone.tasks.filter(
    (task) => task.completed
  ).length;

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025]">
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#7FD8AE]/20 bg-[#0E5666]/25 font-mono text-xs font-bold text-[#B8F2E6]">
            {String(index + 1).padStart(2, "0")}
          </div>

          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="space-y-3">
                <input
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-[#7FD8AE]/40"
                />

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value
                    )
                  }
                  rows={2}
                  className="w-full resize-y rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-[#7FD8AE]/40"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !title.trim()}
                    className="rounded-lg bg-[#7FD8AE] px-3 py-1.5 text-xs font-semibold text-[#071A1F] disabled:opacity-50"
                  >
                    Save
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTitle(milestone.title);
                      setDescription(
                        milestone.description
                      );
                      setEditing(false);
                    }}
                    className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-[#8FA9A8]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-semibold">
                  {milestone.title}
                </h3>

                <p className="mt-1 text-sm text-[#7B9998]">
                  {milestone.description ||
                    "No description"}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-xs text-[#5C8A85]">
            {completed}/{milestone.tasks.length}
          </span>

          {!editing && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg p-2 text-[#7B9998] transition hover:bg-white/[0.04] hover:text-[#F4FFFC]"
                aria-label="Edit milestone"
              >
                <Pencil size={14} />
              </button>

              <button
                type="button"
                onClick={() =>
                  onDeleteMilestone(milestone.id)
                }
                className="rounded-lg p-2 text-[#7B9998] transition hover:bg-red-400/10 hover:text-red-300"
                aria-label="Delete milestone"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="divide-y divide-white/[0.05]">
        {milestone.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            milestoneTitle={milestone.title}
            onToggle={onToggleTask}
            onUpdate={onUpdateTask}
            onDelete={onDeleteTask}
            onOpenInAssistant={onOpenInAssistant}
          />
        ))}
      </div>

      <div className="border-t border-white/[0.05] px-6 py-3">
        <button
          type="button"
          onClick={() => onAddTask(milestone.id)}
          className="flex items-center gap-2 text-xs font-medium text-[#7FD8AE] transition hover:text-[#B8F2E6]"
        >
          <Plus size={14} />
          Add task
        </button>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  milestoneTitle,
  onToggle,
  onUpdate,
  onDelete,
  onOpenInAssistant,
}: {
  task: Task;
  milestoneTitle: string;
  onToggle: (
    taskId: string,
    completed: boolean
  ) => void;
  onUpdate: (
    taskId: string,
    data: { title: string; description: string }
  ) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onOpenInAssistant: (
    task: Task,
    milestoneTitle: string
  ) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(
    task.description
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
  }, [task.title, task.description]);

  const save = async () => {
    setSaving(true);

    try {
      await onUpdate(task.id, {
        title,
        description,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-4 transition hover:bg-white/[0.02]">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() =>
            onToggle(task.id, !task.completed)
          }
          aria-label={
            task.completed
              ? `Mark ${task.title} as incomplete`
              : `Mark ${task.title} as complete`
          }
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
            task.completed
              ? "border-[#7FD8AE] bg-[#7FD8AE]"
              : "border-[#5C8A85] hover:border-[#7FD8AE]"
          }`}
        >
          {task.completed ? (
            <Check
              size={12}
              strokeWidth={3}
              className="text-[#071A1F]"
            />
          ) : (
            <Circle
              size={5}
              className="fill-[#5C8A85] text-[#5C8A85]"
            />
          )}
        </button>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-3">
              <input
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-[#7FD8AE]/40"
              />

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                rows={2}
                placeholder="Task description (optional)"
                className="w-full resize-y rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-[#7FD8AE]/40"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !title.trim()}
                  className="rounded-lg bg-[#7FD8AE] px-3 py-1.5 text-xs font-semibold text-[#071A1F] disabled:opacity-50"
                >
                  Save
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTitle(task.title);
                    setDescription(task.description);
                    setEditing(false);
                  }}
                  className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-[#8FA9A8]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p
                className={`text-sm transition ${
                  task.completed
                    ? "text-[#5C8A85] line-through"
                    : "text-[#D8E9E5]"
                }`}
              >
                {task.title}
              </p>

              {task.description && (
                <p className="mt-1 text-xs text-[#5C8A85]">
                  {task.description}
                </p>
              )}
            </>
          )}
        </div>

        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() =>
                onOpenInAssistant(
                  task,
                  milestoneTitle
                )
              }
              className="flex items-center gap-1.5 rounded-lg border border-[#7FD8AE]/20 bg-[#7FD8AE]/10 px-3 py-1.5 text-xs font-medium text-[#7FD8AE] transition hover:bg-[#7FD8AE]/15"
            >
              <Bot size={13} />
              Open in Assistant
            </button>

            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg p-2 text-[#7B9998] transition hover:bg-white/[0.04] hover:text-[#F4FFFC]"
              aria-label="Edit task"
            >
              <Pencil size={14} />
            </button>

            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="rounded-lg p-2 text-[#7B9998] transition hover:bg-red-400/10 hover:text-red-300"
              aria-label="Delete task"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectWorkspace;
