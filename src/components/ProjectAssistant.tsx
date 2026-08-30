import {
  Bug,
  Code2,
  HelpCircle,
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import axios from "axios";

import type {
  AssistantMessage,
  AssistantMode,
  TaskHandoffContext,
} from "../types/assistant";
import type { Project } from "../types/project";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

interface ProjectAssistantProps {
  project: Project;
  model: string | null;
  taskContext: TaskHandoffContext | null;
  onClearTaskContext: () => void;
}

const MODES: {
  id: AssistantMode;
  label: string;
  icon: typeof MessageSquare;
  description: string;
  placeholder: string;
  codePlaceholder?: string;
  requiresCode?: boolean;
}[] = [
  {
    id: "ask",
    label: "Ask",
    icon: HelpCircle,
    description: "Ask questions about your project",
    placeholder:
      "How should I structure authentication for this app?",
  },
  {
    id: "generate",
    label: "Generate",
    icon: Wand2,
    description: "Generate code from a description",
    placeholder:
      "Create a React hook for fetching and caching project data",
  },
  {
    id: "explain",
    label: "Explain",
    icon: Code2,
    description: "Explain how code works",
    placeholder: "Optional: what part should I focus on?",
    codePlaceholder: "Paste the code you want explained...",
    requiresCode: true,
  },
  {
    id: "fix",
    label: "Fix",
    icon: Bug,
    description: "Find and fix bugs in code",
    placeholder: "Describe the error or unexpected behavior...",
    codePlaceholder: "Paste the code that needs fixing...",
    requiresCode: true,
  },
];

function buildTaskPrefill(context: TaskHandoffContext) {
  const lines = [
    `Help me implement this task: ${context.taskTitle}`,
    `Milestone: ${context.milestoneTitle}`,
  ];

  if (context.taskDescription) {
    lines.push(`Details: ${context.taskDescription}`);
  }

  lines.push(
    "",
    "What's the best approach to build this?"
  );

  return lines.join("\n");
}

function createMessageId() {
  return crypto.randomUUID();
}

function getAssistantErrorMessage(err: unknown) {
  if (!axios.isAxiosError(err)) {
    return "Failed to get AI response.";
  }

  if (err.response?.status === 404) {
    return "Assistant API not found. Restart the backend with npm run server (or npm run dev:full).";
  }

  if (err.code === "ECONNABORTED") {
    return "Request timed out. The model may still be loading — try again or pick a smaller model in Settings.";
  }

  if (!err.response) {
    return "Cannot reach the DevSmith API. Make sure the backend is running on port 3001.";
  }

  const data = err.response.data as { error?: string } | undefined;

  return data?.error || "Failed to get AI response.";
}

function renderContent(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith("```")) {
      const lines = part.slice(3, -3).split("\n");
      const language = lines[0]?.trim() || "";
      const code = (
        language ? lines.slice(1) : lines
      ).join("\n");

      return (
        <pre
          key={index}
          className="my-3 overflow-x-auto rounded-lg border border-white/[0.08] bg-black/30 p-4 font-mono text-xs leading-relaxed text-[#B8F2E6]"
        >
          {language && (
            <div className="mb-2 font-sans text-[10px] uppercase tracking-wider text-[#5C8A85]">
              {language}
            </div>
          )}
          <code>{code.trim()}</code>
        </pre>
      );
    }

    if (!part.trim()) {
      return null;
    }

    return (
      <p
        key={index}
        className="whitespace-pre-wrap text-sm leading-relaxed"
      >
        {part.trim()}
      </p>
    );
  });
}

export default function ProjectAssistant({
  project,
  model,
  taskContext,
  onClearTaskContext,
}: ProjectAssistantProps) {
  const [mode, setMode] =
    useState<AssistantMode>("ask");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [messages, setMessages] = useState<
    AssistantMessage[]
  >([]);
  const [loadingHistory, setLoadingHistory] =
    useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backendReady, setBackendReady] =
    useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeMode = MODES.find(
    (item) => item.id === mode
  )!;

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await axios.get<{
          features?: { assistant?: boolean };
        }>(`${API_BASE_URL}/api/health`);

        setBackendReady(
          Boolean(response.data.features?.assistant)
        );
      } catch {
        setBackendReady(false);
      }
    };

    checkBackend();
  }, []);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        setLoadingHistory(true);
        setError("");

        const response = await axios.get<
          AssistantMessage[]
        >(
          `${API_BASE_URL}/api/projects/${project.id}/assistant/messages`
        );

        setMessages(response.data);
        setBackendReady(true);
      } catch (err) {
        console.error(
          "Failed to load assistant messages:",
          err
        );

        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setBackendReady(false);
          setError(getAssistantErrorMessage(err));
        }
      } finally {
        setLoadingHistory(false);
      }
    };

    loadMessages();
  }, [project.id]);

  useEffect(() => {
    if (taskContext) {
      setMode("ask");
      setMessage(buildTaskPrefill(taskContext));
    }
  }, [taskContext]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!model) {
      setError(
        "No Ollama model selected. Open Settings and select a model first."
      );
      return;
    }

    const trimmedMessage = message.trim();
    const trimmedCode = code.trim();

    if (
      !trimmedMessage &&
      !activeMode.requiresCode
    ) {
      return;
    }

    if (
      activeMode.requiresCode &&
      !trimmedCode
    ) {
      setError("Paste the code you want to analyze.");
      return;
    }

    const userContent = activeMode.requiresCode
      ? trimmedMessage ||
        (mode === "explain"
          ? "Explain this code."
          : "Find and fix issues in this code.")
      : trimmedMessage;

    const pendingUserMessage: AssistantMessage = {
      id: createMessageId(),
      role: "user",
      mode,
      content: userContent,
      ...(trimmedCode ? { code: trimmedCode } : {}),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, pendingUserMessage]);
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await axios.post<{
        answer: string;
        mode: AssistantMode;
        messages: AssistantMessage[];
      }>(
        `${API_BASE_URL}/api/projects/${project.id}/assistant`,
        {
          model,
          mode,
          message: userContent,
          code: trimmedCode || undefined,
          taskId: taskContext?.taskId,
        },
        { timeout: 180000 }
      );

      setMessages((prev) => [
        ...prev.filter(
          (item) => item.id !== pendingUserMessage.id
        ),
        ...response.data.messages,
      ]);
      setCode("");
      setBackendReady(true);
    } catch (err: unknown) {
      console.error(
        "Failed to run project assistant:",
        err
      );

      setError(getAssistantErrorMessage(err));

      if (
        axios.isAxiosError(err) &&
        err.response?.status === 404
      ) {
        setBackendReady(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = async () => {
    try {
      await axios.delete(
        `${API_BASE_URL}/api/projects/${project.id}/assistant/messages`
      );

      setMessages([]);
      onClearTaskContext();
      setMessage("");
      setCode("");
      setError("");
    } catch (err) {
      console.error(
        "Failed to clear conversation:",
        err
      );

      setError("Failed to clear conversation.");
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent
  ) => {
    if (
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles
              size={17}
              className="text-[#7FD8AE]"
            />

            <h2 className="text-xl font-semibold">
              AI Assistant
            </h2>
          </div>

          <p className="mt-1 text-sm text-[#7B9998]">
            Ask questions, generate code, and get
            explanations or fixes — saved per project.
          </p>

          {model && (
            <p className="mt-2 font-mono text-[11px] text-[#5C8A85]">
              Using model: {model}
            </p>
          )}
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearConversation}
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-[#8FA9A8] transition hover:bg-white/[0.06] hover:text-[#F4FFFC]"
          >
            <Trash2 size={14} />
            Clear conversation
          </button>
        )}
      </div>

      {(!backendReady || error) && (
        <div className="mb-6 rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {error ||
            "Assistant API unavailable. Restart the backend with npm run server."}
        </div>
      )}

      {taskContext && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-[#F2A65A]/20 bg-[#F2A65A]/10 px-4 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#F2A65A]">
              Task context
            </p>

            <p className="mt-1 text-sm font-medium text-[#F4FFFC]">
              {taskContext.taskTitle}
            </p>

            <p className="mt-1 text-xs text-[#8FA9A8]">
              {taskContext.milestoneTitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              onClearTaskContext();
              setMessage("");
            }}
            className="rounded-lg p-1.5 text-[#8FA9A8] transition hover:bg-white/[0.06] hover:text-[#F4FFFC]"
            aria-label="Clear task context"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((item) => {
          const Icon = item.icon;
          const isActive = mode === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMode(item.id);
                setError("");
              }}
              className={`rounded-xl border p-4 text-left transition ${
                isActive
                  ? "border-[#7FD8AE]/30 bg-[#7FD8AE]/[0.06]"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon
                  size={16}
                  className={
                    isActive
                      ? "text-[#7FD8AE]"
                      : "text-[#5C8A85]"
                  }
                />

                <span className="text-sm font-semibold">
                  {item.label}
                </span>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-[#7B9998]">
                {item.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025]">
        <div className="border-b border-white/[0.06] px-6 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#7B9998]">
            Conversation
          </p>
        </div>

        <div className="min-h-[320px] max-h-[480px] overflow-y-auto px-6 py-5">
          {loadingHistory ? (
            <div className="flex min-h-[280px] items-center justify-center text-sm text-[#7B9998]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#7FD8AE]/20 border-t-[#7FD8AE]" />
            </div>
          ) : messages.length === 0 && !loading ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-[#7FD8AE]/20 bg-[#0E5666]/25">
                <MessageSquare
                  size={24}
                  className="text-[#B8F2E6]"
                />
              </div>

              <h3 className="text-lg font-semibold">
                Start a conversation
              </h3>

              <p className="mt-2 max-w-md text-sm text-[#7B9998]">
                {taskContext
                  ? "Your task context is loaded. Send a message or switch modes."
                  : `Use ${activeMode.label.toLowerCase()} mode for ${project.title}.`}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((item) => (
                <div
                  key={item.id}
                  className={`flex ${
                    item.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 ${
                      item.role === "user"
                        ? "border border-[#F2A65A]/20 bg-[#F2A65A]/10 text-[#F4FFFC]"
                        : "border border-white/[0.06] bg-black/20 text-[#D8E9E5]"
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#5C8A85]">
                        {item.role === "user"
                          ? "You"
                          : "DevSmith"}
                      </span>

                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#7B9998]">
                        {item.mode}
                      </span>
                    </div>

                    {item.code && (
                      <pre className="mb-3 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/30 p-3 font-mono text-xs text-[#B8F2E6]">
                        {item.code}
                      </pre>
                    )}

                    {item.role === "assistant" ? (
                      <div className="space-y-2">
                        {renderContent(item.content)}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">
                        {item.content}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-[#7B9998]">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#7FD8AE]/20 border-t-[#7FD8AE]" />
                      DevSmith is thinking... This can take up to 2 minutes for local models.
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.06] p-6">
          {error && backendReady && (
            <div className="mb-4 rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {activeMode.requiresCode && (
            <div className="mb-4">
              <label className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-[#7B9998]">
                Code
              </label>

              <textarea
                value={code}
                onChange={(event) =>
                  setCode(event.target.value)
                }
                placeholder={
                  activeMode.codePlaceholder
                }
                rows={8}
                className="w-full resize-y rounded-lg border border-white/[0.08] bg-black/20 px-4 py-3 font-mono text-xs text-[#B8F2E6] outline-none placeholder:text-[#5C8A85] focus:border-[#7FD8AE]/40 focus:ring-2 focus:ring-[#7FD8AE]/20"
              />
            </div>
          )}

          <div className="flex gap-3">
            <textarea
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder={activeMode.placeholder}
              rows={3}
              className="min-h-[80px] flex-1 resize-y rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-[#F4FFFC] outline-none placeholder:text-[#5C8A85] focus:border-[#7FD8AE]/40 focus:ring-2 focus:ring-[#7FD8AE]/20"
            />

            <button
              type="button"
              onClick={sendMessage}
              disabled={
                loading ||
                (!message.trim() &&
                  !activeMode.requiresCode) ||
                (activeMode.requiresCode &&
                  !code.trim())
              }
              className="flex shrink-0 items-center gap-2 self-end rounded-lg bg-[#F2A65A] px-5 py-3 text-sm font-semibold text-[#071A1F] transition hover:bg-[#F5B673] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
              Send
            </button>
          </div>

          <p className="mt-3 text-xs text-[#5C8A85]">
            Press Ctrl+Enter to send. Messages are saved
            to this project.
          </p>
        </div>
      </div>
    </section>
  );
}
