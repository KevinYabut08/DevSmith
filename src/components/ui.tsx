export function TerminalDots() {
  return (
    <div className="flex gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-[#F2A65A]/70" />
      <span className="h-1.5 w-1.5 rounded-full bg-[#7FD8AE]/50" />
      <span className="h-1.5 w-1.5 rounded-full bg-[#F4FFFC]/20" />
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[#5C8A85]">
      {children}
    </p>
  );
}

/** Central status → color mapping so every component agrees on what each status looks like. */
export const STATUS_STYLES: Record<
  "Planning" | "In Progress" | "Completed",
  { label: string; dot: string; text: string; bg: string }
> = {
  Planning: {
    label: "Planning",
    dot: "bg-[#8FA9A8]",
    text: "text-[#B9CFCE]",
    bg: "bg-white/[0.04] border-white/[0.10]",
  },
  "In Progress": {
    label: "In Progress",
    dot: "bg-[#F2A65A]",
    text: "text-[#F5C089]",
    bg: "bg-[#F2A65A]/[0.08] border-[#F2A65A]/25",
  },
  Completed: {
    label: "Completed",
    dot: "bg-[#7FD8AE]",
    text: "text-[#B8F2E6]",
    bg: "bg-[#7FD8AE]/[0.08] border-[#7FD8AE]/25",
  },
};