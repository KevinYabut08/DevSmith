import {
  ArrowLeft,
  Check,
  Circle,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";

import type { Project } from "../types/project";
import type { Roadmap, Task } from "../types/roadmap";

interface ProjectWorkspaceProps {
  project: Project;
  onBack: () => void;
}

function ProjectWorkspace({
  project,
  onBack,
}: ProjectWorkspaceProps) {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRoadmap();
  }, [project.id]);

  const loadRoadmap = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get<Roadmap>(
        `http://localhost:3001/api/projects/${project.id}/roadmap`
      );

      setRoadmap(response.data);
    } catch (error) {
      console.error("Failed to load roadmap:", error);

      setError("Failed to load roadmap.");
    } finally {
      setLoading(false);
    }
  };

  const generateRoadmap = async () => {
    try {
      setGenerating(true);
      setError("");

      await axios.post(
        `http://localhost:3001/api/projects/${project.id}/roadmap/generate`
      );

      await loadRoadmap();
    } catch (error: any) {
      console.error(
        "Failed to generate roadmap:",
        error
      );

      if (
        error.response?.status === 409
      ) {
        await loadRoadmap();
      } else {
        setError(
          "Failed to generate roadmap."
        );
      }
    } finally {
      setGenerating(false);
    }
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
      {/* Header */}
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-10 py-5">
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#7B9998] transition hover:bg-white/[0.04] hover:text-[#F4FFFC]"
          >
            <ArrowLeft size={17} />
            Projects
          </button>

          <span className="text-[#38585B]">
            /
          </span>

          <span className="text-sm text-[#B8F2E6]">
            {project.title}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-10 py-10">
        {/* Project header */}
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

            {/* Progress */}
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
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <p className="mt-2 text-xs text-[#5C8A85]">
                {completedTasks} of {totalTasks} tasks
                completed
              </p>
            </div>
          </div>
        </section>

        {/* Roadmap header */}
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
                Break the project into milestones and
                actionable tasks.
              </p>
            </div>

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

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Loading */}
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
                turn this idea into actionable steps.
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
      </div>
    </main>
  );
}

function MilestoneCard({
  milestone,
  index,
}: {
  milestone: Roadmap["milestones"][number];
  index: number;
}) {
  const completed = milestone.tasks.filter(
    (task) => task.completed
  ).length;

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025]">
      {/* Milestone header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#7FD8AE]/20 bg-[#0E5666]/25 font-mono text-xs font-bold text-[#B8F2E6]">
            {String(index + 1).padStart(2, "0")}
          </div>

          <div>
            <h3 className="font-semibold">
              {milestone.title}
            </h3>

            <p className="mt-1 text-sm text-[#7B9998]">
              {milestone.description}
            </p>
          </div>
        </div>

        <span className="font-mono text-xs text-[#5C8A85]">
          {completed}/{milestone.tasks.length}
        </span>
      </div>

      {/* Tasks */}
      <div className="divide-y divide-white/[0.05]">
        {milestone.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
          />
        ))}
      </div>
    </div>
  );
}

function TaskRow({
  task,
}: {
  task: Task;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 transition hover:bg-white/[0.02]">
      <button
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#5C8A85] text-[#071A1F] transition hover:border-[#7FD8AE]"
      >
        {task.completed ? (
          <Check
            size={12}
            className="text-[#071A1F]"
          />
        ) : (
          <Circle
            size={5}
            className="fill-[#5C8A85] text-[#5C8A85]"
          />
        )}
      </button>

      <div className="min-w-0">
        <p
          className={`text-sm ${
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
      </div>
    </div>
  );
}

export default ProjectWorkspace;