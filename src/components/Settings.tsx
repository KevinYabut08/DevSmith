import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";

import AIModelsPanel from "./AIModelsPanel";

interface SettingsProps {
  selectedModel: string | null;
  onSelectModel: (model: string) => void;
  onBack: () => void;
}

export default function Settings({
  selectedModel,
  onSelectModel,
  onBack,
}: SettingsProps) {
  return (
    <main className="min-h-screen bg-[#071A1F] text-[#F4FFFC]">
      {/* Header */}
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-10 py-5">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#7B9998] transition hover:bg-white/[0.04] hover:text-[#F4FFFC]"
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>

          <span className="text-[#38585B]">
            /
          </span>

          <div className="flex items-center gap-2">
            <SettingsIcon
              size={16}
              className="text-[#7FD8AE]"
            />

            <span className="text-sm text-[#B8F2E6]">
              Settings
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-10 py-10">
        <div className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#7B9998]">
            // system
          </p>

          <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight">
            Settings
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-[#8FA9A8]">
            Configure DevSmith and your local AI
            environment.
          </p>
        </div>

        <AIModelsPanel
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
        />
      </div>
    </main>
  );
}