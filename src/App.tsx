import {
  FolderKanban,
  LayoutDashboard,
  Settings,
  Plus,
  Sparkles,
  ArrowUpRight,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";
import CreateProjectModal from "./components/CreateProjectModal";
import ProjectCard from "./components/ProjectCard";
import { TerminalDots, Eyebrow } from "./components/ui";
import type { Project } from "./types/project";

function App() {
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  const createProject = async (
    title: string,
    description: string
  ) => {
    try {
      const response = await axios.post<Project>(
        "http://localhost:3001/api/projects",
        {
          title,
          description,
        }
      );

      setProjects((prev) => [
        response.data,
        ...prev,
      ]);
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  const activeCount = projects.filter(
    (p) => p.status === "Planning" || p.status === "In Progress"
  ).length;
  const completedCount = projects.filter((p) => p.status === "Completed").length;

  useEffect(() => {
  const loadProjects = async () => {
    try {
      const response = await axios.get<Project[]>(
        "http://localhost:3001/api/projects"
      );

      setProjects(response.data);
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  };

  loadProjects();
}, []);

  return (
    <>
      <div className="min-h-screen bg-[#071A1F] font-sans text-[#F4FFFC] antialiased">
        {/* Sidebar */}
        <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-white/[0.06] bg-[#08191F]">
          {/* Logo */}
          <div className="flex h-20 items-center border-b border-white/[0.06] px-6">
            <img
              src="/devsmith-logo.png"
              alt="DevSmith"
              className="h-12 w-auto object-contain"
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6">
            <Eyebrow>// workspace</Eyebrow>

            <div className="mt-3 space-y-1">
              <button className="group relative flex w-full items-center gap-3 rounded-lg bg-[#0E5666]/30 px-3 py-2.5 text-sm font-medium text-[#B8F2E6] outline-none transition focus-visible:ring-2 focus-visible:ring-[#7FD8AE]/50">
                <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[#7FD8AE]" />
                <LayoutDashboard size={17} strokeWidth={2} />
                Dashboard
              </button>

              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#7B9998] outline-none transition hover:bg-white/[0.04] hover:text-[#F4FFFC] focus-visible:ring-2 focus-visible:ring-[#7FD8AE]/50">
                <FolderKanban size={17} strokeWidth={2} />
                Projects
              </button>
            </div>

            <div className="mt-8">
              <Eyebrow>// system</Eyebrow>
              <div className="mt-3">
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#7B9998] outline-none transition hover:bg-white/[0.04] hover:text-[#F4FFFC] focus-visible:ring-2 focus-visible:ring-[#7FD8AE]/50">
                  <Settings size={17} strokeWidth={2} />
                  Settings
                </button>
              </div>
            </div>
          </nav>

          {/* Bottom AI panel */}
          <div className="border-t border-white/[0.06] p-4">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-[#7FD8AE]" />
                  <span className="text-sm font-medium">AI Workspace</span>
                </div>
                <TerminalDots />
              </div>

              <p className="text-xs leading-relaxed text-[#7B9998]">
                Turn your next idea into an actionable development plan.
              </p>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="relative ml-64 min-h-screen overflow-hidden">
          {/* Ambient forge glow */}
          <div
            className="pointer-events-none absolute -top-40 right-0 h-[420px] w-[420px] rounded-full opacity-[0.10] blur-[110px]"
            style={{
              background:
                "radial-gradient(circle, #F2A65A 0%, #7FD8AE 55%, transparent 75%)",
            }}
          />

          {/* Header */}
          <header className="relative flex h-20 items-center justify-between border-b border-white/[0.06] px-10">
            <div>
              <Eyebrow>// dashboard</Eyebrow>
              <h1 className="mt-1 text-lg font-semibold tracking-tight">
                Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative hidden md:block">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5C8A85]"
                />
                <input
                  type="text"
                  placeholder="Search projects…"
                  className="w-56 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-[#F4FFFC] outline-none placeholder:text-[#5C8A85] transition focus:border-[#7FD8AE]/40 focus:ring-2 focus:ring-[#7FD8AE]/20"
                />
              </div>

              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#F2A65A] px-4 py-2.5 text-sm font-semibold text-[#071A1F] outline-none transition hover:bg-[#F5B673] hover:shadow-[0_0_20px_2px_rgba(242,166,90,0.25)] focus-visible:ring-2 focus-visible:ring-[#F2A65A]/60"
              >
                <Plus size={18} strokeWidth={2.5} />
                New Project
              </button>
            </div>
          </header>

          {/* Content */}
          <div className="relative mx-auto max-w-7xl px-10 py-10">
            {/* Welcome */}
            <section className="mb-10">
              <Eyebrow>// welcome_back</Eyebrow>
              <h2 className="mt-2 font-mono text-3xl font-bold tracking-tight text-[#F4FFFC]">
                Build something great.
              </h2>
              <p className="mt-3 max-w-xl leading-relaxed text-[#8FA9A8]">
                Turn your software ideas into structured roadmaps, milestones,
                and actionable development tasks.
              </p>
            </section>

            {/* Stats */}
            <section className="grid gap-5 md:grid-cols-3">
              <StatCard
                label="Total Projects"
                value={projects.length.toString()}
                description="All projects"
              />
              <StatCard
                label="Active Projects"
                value={activeCount.toString()}
                description="Currently building"
              />
              <StatCard
                label="Completed"
                value={completedCount.toString()}
                description="Successfully shipped"
              />
            </section>

            {/* Projects */}
            <section className="mt-12">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">
                    Your Projects
                  </h3>
                  <p className="mt-1 text-sm text-[#8FA9A8]">
                    Projects you're currently working on.
                  </p>
                </div>

                {projects.length > 0 && (
                  <button className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-[#B8F2E6] outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#7FD8AE]/50">
                    View all
                    <ArrowUpRight size={16} />
                  </button>
                )}
              </div>

              {projects.length === 0 ? (
                <div className="relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/[0.10] bg-white/[0.015] px-6 text-center">
                  <div className="absolute right-5 top-5">
                    <TerminalDots />
                  </div>

                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-[#7FD8AE]/20 bg-[#0E5666]/25">
                    <FolderKanban
                      size={24}
                      className="text-[#B8F2E6]"
                      strokeWidth={1.75}
                    />
                  </div>

                  <h4 className="text-lg font-semibold">No projects yet</h4>

                  <p className="mt-2 max-w-md text-sm leading-relaxed text-[#8FA9A8]">
                    Start with an idea. DevSmith will help you turn it into a
                    structured development plan.
                  </p>

                  <button
                    onClick={() => setShowModal(true)}
                    className="mt-6 flex items-center gap-2 rounded-lg bg-[#F2A65A] px-5 py-2.5 text-sm font-semibold text-[#071A1F] outline-none transition hover:bg-[#F5B673] hover:shadow-[0_0_20px_2px_rgba(242,166,90,0.2)] focus-visible:ring-2 focus-visible:ring-[#F2A65A]/60"
                  >
                    <Plus size={17} strokeWidth={2.5} />
                    Create your first project
                  </button>
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      <CreateProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreate={createProject}
      />
    </>
  );
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="group rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 transition hover:border-[#7FD8AE]/30 hover:bg-white/[0.04]">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#7B9998]">
          {label}
        </p>
        <TerminalDots />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <span className="font-mono text-3xl font-bold tabular-nums text-[#F4FFFC]">
          {value}
        </span>
        <span className="text-xs text-[#5C8A85]">{description}</span>
      </div>
    </div>
  );
}

export default App;