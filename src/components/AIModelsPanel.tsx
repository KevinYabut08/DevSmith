import {
  Check,
  Circle,
  Cpu,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  digest?: string;
}

interface ModelsResponse {
  connected: boolean;
  models: OllamaModel[];
  error?: string;
}

interface AIModelsPanelProps {
  selectedModel: string | null;
  onSelectModel: (model: string) => void;
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

function formatSize(bytes: number) {
  if (!bytes) return "Unknown";

  const gb = bytes / 1024 / 1024 / 1024;

  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }

  const mb = bytes / 1024 / 1024;

  return `${mb.toFixed(0)} MB`;
}

export default function AIModelsPanel({
  selectedModel,
  onSelectModel,
}: AIModelsPanelProps) {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadModels = async () => {
    try {
      setError("");

      const response = await axios.get<ModelsResponse>(
        `${API_BASE_URL}/api/ai/models`
      );

      setConnected(response.data.connected);
      setModels(response.data.models ?? []);

      /*
       * Automatically select the first installed model
       * if the user hasn't selected one yet.
       */
      if (
        response.data.models.length > 0 &&
        !selectedModel
      ) {
        onSelectModel(response.data.models[0].name);
      }
    } catch (error) {
      console.error(
        "Failed to load Ollama models:",
        error
      );

      setConnected(false);
      setModels([]);
      setError("Unable to connect to Ollama.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadModels();
  };

  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.025]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#7FD8AE]/20 bg-[#0E5666]/25">
            <Cpu
              size={18}
              className="text-[#7FD8AE]"
            />
          </div>

          <div>
            <h2 className="font-semibold">
              AI Models
            </h2>

            <p className="mt-0.5 text-xs text-[#7B9998]">
              Manage your local Ollama models.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-[#8FA9A8] transition hover:bg-white/[0.06] hover:text-[#F4FFFC] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>
      </div>

      {/* Ollama connection */}
      <div className="border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {connected ? (
              <Wifi
                size={16}
                className="text-[#7FD8AE]"
              />
            ) : (
              <WifiOff
                size={16}
                className="text-red-400"
              />
            )}

            <div>
              <p className="text-sm font-medium">
                Ollama
              </p>

              <p className="text-xs text-[#5C8A85]">
                localhost:11434
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              connected
                ? "border-[#7FD8AE]/20 bg-[#7FD8AE]/10 text-[#7FD8AE]"
                : "border-red-400/20 bg-red-400/10 text-red-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected
                  ? "bg-[#7FD8AE]"
                  : "bg-red-400"
              }`}
            />

            {connected
              ? "Connected"
              : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-[#7B9998]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#7FD8AE]/20 border-t-[#7FD8AE]" />
              Detecting Ollama models...
            </div>
          </div>
        ) : !connected ? (
          <div className="rounded-lg border border-dashed border-white/[0.08] bg-white/[0.015] px-6 py-10 text-center">
            <Server
              size={24}
              className="mx-auto mb-3 text-[#5C8A85]"
            />

            <h3 className="text-sm font-semibold">
              Ollama is not running
            </h3>

            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#7B9998]">
              Start Ollama on your computer and
              refresh this page to detect your
              installed models.
            </p>

            <code className="mt-4 inline-block rounded-md bg-black/20 px-3 py-2 font-mono text-xs text-[#B8F2E6]">
              ollama serve
            </code>
          </div>
        ) : models.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/[0.08] bg-white/[0.015] px-6 py-10 text-center">
            <Cpu
              size={24}
              className="mx-auto mb-3 text-[#5C8A85]"
            />

            <h3 className="text-sm font-semibold">
              No models installed
            </h3>

            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#7B9998]">
              Install an Ollama model to start
              using DevSmith AI.
            </p>

            <code className="mt-4 inline-block rounded-md bg-black/20 px-3 py-2 font-mono text-xs text-[#B8F2E6]">
              ollama pull llama3.2
            </code>
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#7B9998]">
                Installed Models
              </p>
            </div>

            <div className="space-y-2">
              {models.map((model) => {
                const isSelected =
                  selectedModel === model.name;

                return (
                  <button
                    key={model.name}
                    type="button"
                    onClick={() =>
                      onSelectModel(model.name)
                    }
                    className={`group flex w-full items-center justify-between rounded-lg border p-4 text-left transition ${
                      isSelected
                        ? "border-[#7FD8AE]/30 bg-[#7FD8AE]/[0.06]"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {isSelected ? (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7FD8AE]/10">
                          <Check
                            size={15}
                            className="text-[#7FD8AE]"
                          />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.04]">
                          <Circle
                            size={15}
                            className="text-[#5C8A85]"
                          />
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-medium text-[#F4FFFC]">
                          {model.name}
                        </p>

                        <p className="mt-1 text-xs text-[#5C8A85]">
                          {formatSize(model.size)}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="ml-4 shrink-0 font-mono text-[10px] uppercase tracking-wider text-[#7FD8AE]">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}