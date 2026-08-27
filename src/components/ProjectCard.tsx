import { ArrowUpRight } from "lucide-react";
import type { Project } from "../types/project";
import { TerminalDots, STATUS_STYLES } from "./ui";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ProjectCard({ project }: { project: Project }) {
  const status = STATUS_STYLES[project.status];

  return (
    <button
      className="group relative flex flex-col rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 text-left outline-none transition hover:border-[#7FD8AE]/30 hover:bg-white/[0.045] focus-visible:ring-2 focus-visible:ring-[#7FD8AE]/50"
    >
      <div className="flex items-start justify-between">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${status.bg} ${status.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
        <TerminalDots />
      </div>

      <h4 className="mt-4 text-base font-semibold tracking-tight text-[#F4FFFC]">
        {project.title}
      </h4>

      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[#8FA9A8]">
        {project.description || "No description yet."}
      </p>

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