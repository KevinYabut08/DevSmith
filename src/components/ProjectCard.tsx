import { ArrowUpRight, Trash2 } from "lucide-react";
import type { Project } from "../types/project";
import { TerminalDots, STATUS_STYLES } from "./ui";

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ProjectCard({
  project,
  onClick,
  onDelete,
}: ProjectCardProps) {
  const status = STATUS_STYLES[project.status];

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full flex-col rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 text-left outline-none transition hover:border-[#7FD8AE]/30 hover:bg-white/[0.045] focus-visible:ring-2 focus-visible:ring-[#7FD8AE]/50"
    >
      {/* Status */}
      <div className="flex items-start justify-between">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${status.bg} ${status.text}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
          />

          {status.label}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            aria-label={`Delete ${project.title}`}
            className="rounded-lg p-1.5 text-[#7B9998] opacity-0 outline-none transition hover:bg-red-400/10 hover:text-red-300 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-400/40 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>

          <TerminalDots />
        </div>
      </div>

      {/* Title */}
      <h4 className="mt-4 text-base font-semibold tracking-tight text-[#F4FFFC]">
        {project.title}
      </h4>

      {/* Description */}
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[#8FA9A8]">
        {project.description || "No description yet."}
      </p>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[#5C8A85]">
          {formatDate(project.createdAt)}
        </span>

        <span className="flex items-center gap-1 text-xs font-medium text-[#B8F2E6] opacity-0 transition group-hover:opacity-100">
          Open
          <ArrowUpRight size={14} />
        </span>
      </div>
    </button>
  );
}