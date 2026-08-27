import { useState, useEffect, useRef } from "react";
import { X, Plus } from "lucide-react";
import { TerminalDots } from "./ui";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, description: string) => void;
}

export default function CreateProjectModal({
  open,
  onClose,
  onCreate,
}: CreateProjectModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // Reset the form each time the modal opens, and focus the title field.
  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      const timer = setTimeout(() => titleRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onCreate(trimmedTitle, description.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#071A1F]/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/[0.10] bg-[#0B242B] shadow-2xl">
        {/* Ambient forge glow, matching the header treatment */}
        <div
          className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full opacity-[0.12] blur-[90px]"
          style={{
            background:
              "radial-gradient(circle, #F2A65A 0%, #7FD8AE 55%, transparent 75%)",
          }}
        />

        {/* Header */}
        <div className="relative flex items-center justify-between border-b border-white/[0.06] px-6 py-5">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[#5C8A85]">
              // new_project
            </p>
            <h2
              id="create-project-title"
              className="mt-1 text-lg font-semibold tracking-tight text-[#F4FFFC]"
            >
              Create a project
            </h2>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#7B9998] outline-none transition hover:bg-white/[0.06] hover:text-[#F4FFFC] focus-visible:ring-2 focus-visible:ring-[#7FD8AE]/50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="relative space-y-5 px-6 py-6">
          <div>
            <label
              htmlFor="project-title"
              className="mb-2 block text-sm font-medium text-[#F4FFFC]"
            >
              Project name
            </label>
            <input
              ref={titleRef}
              id="project-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Habit tracker API"
              className="w-full rounded-lg border border-white/[0.10] bg-white/[0.03] px-3.5 py-2.5 text-sm text-[#F4FFFC] outline-none placeholder:text-[#5C8A85] transition focus:border-[#7FD8AE]/40 focus:ring-2 focus:ring-[#7FD8AE]/20"
            />
          </div>

          <div>
            <label
              htmlFor="project-description"
              className="mb-2 block text-sm font-medium text-[#F4FFFC]"
            >
              Description
              <span className="ml-1.5 font-normal text-[#5C8A85]">
                (optional)
              </span>
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you building?"
              rows={3}
              className="w-full resize-none rounded-lg border border-white/[0.10] bg-white/[0.03] px-3.5 py-2.5 text-sm text-[#F4FFFC] outline-none placeholder:text-[#5C8A85] transition focus:border-[#7FD8AE]/40 focus:ring-2 focus:ring-[#7FD8AE]/20"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <TerminalDots />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-[#8FA9A8] outline-none transition hover:text-[#F4FFFC] focus-visible:ring-2 focus-visible:ring-[#7FD8AE]/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex items-center gap-2 rounded-lg bg-[#F2A65A] px-4 py-2.5 text-sm font-semibold text-[#071A1F] outline-none transition hover:bg-[#F5B673] hover:shadow-[0_0_20px_2px_rgba(242,166,90,0.2)] focus-visible:ring-2 focus-visible:ring-[#F2A65A]/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#F2A65A] disabled:hover:shadow-none"
              >
                <Plus size={16} strokeWidth={2.5} />
                Create project
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}