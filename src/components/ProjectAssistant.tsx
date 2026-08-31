import {
  Bug,
  Check,
  Code2,
  File,
  FileCode2,
  FileText,
  HelpCircle,
  MessageSquare,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import axios from "axios";

import type {
  AssistantMessage,
  AssistantMode,
  IndexedFile,
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
      "Ask anything about your project...",
  },
  {
    id: "generate",
    label: "Generate",
    icon: Wand2,
    description: "Generate code from a description",
    placeholder:
      "Describe what you want DevSmith to build...",
  },
  {
    id: "explain",
    label: "Explain",
    icon: Code2,
    description: "Explain how code works",
    placeholder:
      "What would you like me to focus on?",
    codePlaceholder:
      "Paste the code you want explained...",
    requiresCode: true,
  },
  {
    id: "fix",
    label: "Fix",
    icon: Bug,
    description: "Find and fix bugs in code",
    placeholder:
      "Describe the error or unexpected behavior...",
    codePlaceholder:
      "Paste the code that needs fixing...",
    requiresCode: true,
  },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".html",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".md",
  ".txt",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".go",
  ".rs",
  ".php",
  ".sql",
  ".sh",
  ".yaml",
  ".yml",
  ".xml",
  ".env.example",
];

function buildTaskPrefill(
  context: TaskHandoffContext
) {
  const lines = [
    `Help me implement this task: ${context.taskTitle}`,
    `Milestone: ${context.milestoneTitle}`,
  ];

  if (context.taskDescription) {
    lines.push(
      `Details: ${context.taskDescription}`
    );
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(name: string) {
  const parts = name.split(".");

  if (parts.length < 2) {
    return "";
  }

  return `.${parts.pop()?.toLowerCase()}`;
}

function getFileIcon(extension?: string) {
  if (
    extension &&
    [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".py",
      ".java",
      ".c",
      ".cpp",
      ".cs",
      ".go",
      ".rs",
    ].includes(extension)
  ) {
    return FileCode2;
  }

  if (
    extension &&
    [
      ".md",
      ".txt",
      ".json",
      ".yaml",
      ".yml",
      ".xml",
    ].includes(extension)
  ) {
    return FileText;
  }

  return File;
}

function getAssistantErrorMessage(err: unknown) {
  if (!axios.isAxiosError(err)) {
    return "Failed to get AI response.";
  }

  if (err.response?.status === 404) {
    return "Assistant API not found. Restart the backend with npm run server.";
  }

  if (err.code === "ECONNABORTED") {
    return "Request timed out. The model may still be loading — try again or pick a smaller model in Settings.";
  }

  if (!err.response) {
    return "Cannot reach the DevSmith API. Make sure the backend is running on port 3001.";
  }

  const data = err.response.data as
    | { error?: string }
    | undefined;

  return (
    data?.error ||
    "Failed to get AI response."
  );
}

function renderContent(content: string) {
  const parts = content.split(
    /(```[\s\S]*?```)/g
  );

  return parts.map((part, index) => {
    if (part.startsWith("```")) {
      const lines = part
        .slice(3, -3)
        .split("\n");

      const language =
        lines[0]?.trim() || "";

      const code = (
        language
          ? lines.slice(1)
          : lines
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

  const [message, setMessage] =
    useState("");

  const [code, setCode] =
    useState("");

  const [messages, setMessages] =
    useState<AssistantMessage[]>([]);

  const [files, setFiles] =
    useState<IndexedFile[]>([]);

  const [loadingHistory, setLoadingHistory] =
    useState(true);

  const [loadingFiles, setLoadingFiles] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [dragActive, setDragActive] =
    useState(false);

  const [error, setError] =
    useState("");

  const [backendReady, setBackendReady] =
    useState(true);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const chatEndRef =
    useRef<HTMLDivElement>(null);

  const activeMode =
    MODES.find(
      (item) => item.id === mode
    )!;

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response =
          await axios.get<{
            features?: {
              assistant?: boolean;
              fileIndexer?: boolean;
            };
          }>(
            `${API_BASE_URL}/api/health`
          );

        setBackendReady(
          Boolean(
            response.data.features?.assistant
          )
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

        const response =
          await axios.get<
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

        if (
          axios.isAxiosError(err) &&
          err.response?.status === 404
        ) {
          setBackendReady(false);
          setError(
            getAssistantErrorMessage(err)
          );
        }
      } finally {
        setLoadingHistory(false);
      }
    };

    loadMessages();
  }, [project.id]);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        setLoadingFiles(true);

        const response =
          await axios.get<
            IndexedFile[]
          >(
            `${API_BASE_URL}/api/projects/${project.id}/files`
          );

        setFiles(response.data);
      } catch (err) {
        console.error(
          "Failed to load indexed files:",
          err
        );

        if (
          axios.isAxiosError(err) &&
          err.response?.status !== 404
        ) {
          setError(
            "Failed to load project files."
          );
        }
      } finally {
        setLoadingFiles(false);
      }
    };

    loadFiles();
  }, [project.id]);

  useEffect(() => {
    if (taskContext) {
      setMode("ask");
      setMessage(
        buildTaskPrefill(taskContext)
      );
    }
  }, [taskContext]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  const validateFile = (file: File) => {
    const extension =
      getFileExtension(file.name);

    if (
      !ACCEPTED_EXTENSIONS.includes(
        extension
      )
    ) {
      return `Unsupported file type: ${file.name}`;
    }

    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} is larger than 5 MB.`;
    }

    return null;
  };

  const uploadFiles = async (
    selectedFiles: File[]
  ) => {
    if (!selectedFiles.length) {
      return;
    }

    setError("");

    const validFiles: File[] = [];

    for (const file of selectedFiles) {
      const validation =
        validateFile(file);

      if (validation) {
        setError(validation);
        continue;
      }

      validFiles.push(file);
    }

    if (!validFiles.length) {
      return;
    }

    try {
      setUploading(true);

      const formData =
        new FormData();

      validFiles.forEach((file) => {
        formData.append(
          "files",
          file
        );
      });

      const response =
        await axios.post<
          IndexedFile[]
        >(
          `${API_BASE_URL}/api/projects/${project.id}/files`,
          formData,
          {
            headers: {
              "Content-Type":
                "multipart/form-data",
            },
            timeout: 120000,
          }
        );

      setFiles((prev) => [
        ...response.data,
        ...prev,
      ]);
    } catch (err) {
      console.error(
        "Failed to upload files:",
        err
      );

      setError(
        getAssistantErrorMessage(err)
      );
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles = Array.from(
      event.target.files || []
    );

    uploadFiles(selectedFiles);

    event.target.value = "";
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    setDragActive(false);

    const droppedFiles =
      Array.from(
        event.dataTransfer.files
      );

    uploadFiles(droppedFiles);
  };

  const removeFile = async (
    fileId: string
  ) => {
    try {
      await axios.delete(
        `${API_BASE_URL}/api/projects/${project.id}/files/${fileId}`
      );

      setFiles((prev) =>
        prev.filter(
          (file) =>
            file.id !== fileId
        )
      );
    } catch (err) {
      console.error(
        "Failed to remove file:",
        err
      );

      setError(
        "Failed to remove file."
      );
    }
  };

  const sendMessage = async () => {
    const trimmedMessage =
      message.trim();

    const trimmedCode =
      code.trim();

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
      setError(
        "Paste the code you want to analyze."
      );
      return;
    }

    const userContent =
      activeMode.requiresCode
        ? trimmedMessage ||
          (mode === "explain"
            ? "Explain this code."
            : "Find and fix issues in this code.")
        : trimmedMessage;

    const pendingUserMessage: AssistantMessage =
      {
        id: createMessageId(),
        role: "user",
        mode,
        content: userContent,
        ...(trimmedCode
          ? { code: trimmedCode }
          : {}),
        createdAt:
          new Date().toISOString(),
      };

    setMessages((prev) => [
      ...prev,
      pendingUserMessage,
    ]);

    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response =
        await axios.post<{
          answer: string;
          mode: AssistantMode;
          messages: AssistantMessage[];
        }>(
          `${API_BASE_URL}/api/projects/${project.id}/assistant`,
          {
            model: model || "default",
            mode,
            message: userContent,
            code:
              trimmedCode || undefined,
            taskId:
              taskContext?.taskId,

            useProjectFiles:
              files.length > 0,

            fileIds:
              files
                .filter(
                  (file) =>
                    file.status ===
                    "indexed"
                )
                .map(
                  (file) =>
                    file.id
                ),
          },
          {
            timeout: 180000,
          }
        );

      setMessages((prev) => [
        ...prev.filter(
          (item) =>
            item.id !==
            pendingUserMessage.id
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

      setError(
        getAssistantErrorMessage(err)
      );

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

  const clearConversation =
    async () => {
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

        setError(
          "Failed to clear conversation."
        );
      }
    };

  const handleKeyDown = (
    event: React.KeyboardEvent
  ) => {
    if (
      event.key === "Enter" &&
      (event.metaKey ||
        event.ctrlKey)
    ) {
      event.preventDefault();
      sendMessage();
    }
  };

  const indexedCount =
    files.filter(
      (file) =>
        file.status === "indexed"
    ).length;

  return (
    <section>
      {/* HEADER */}

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
            Ask questions, generate code,
            explain bugs, and work directly
            with your project files.
          </p>

          {model && (
            <div className="mt-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7FD8AE]" />

              <p className="font-mono text-[11px] text-[#5C8A85]">
                {model}
              </p>
            </div>
          )}
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={
              clearConversation
            }
            className="flex items-center gap-2 self-start rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-[#8FA9A8] transition hover:bg-white/[0.06] hover:text-[#F4FFFC]"
          >
            <Trash2 size={14} />
            Clear conversation
          </button>
        )}
      </div>

      {/* ERROR */}

      {(!backendReady || error) && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          <AlertCircle
            size={16}
            className="mt-0.5 shrink-0"
          />

          <span>
            {error ||
              "Assistant API unavailable. Restart the backend with npm run server."}
          </span>
        </div>
      )}

      {/* TASK CONTEXT */}

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

      {/* FILE INDEXER */}

      <div className="mb-6 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025]">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#7FD8AE]/20 bg-[#7FD8AE]/[0.06]">
                <FileCode2
                  size={15}
                  className="text-[#7FD8AE]"
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[#F4FFFC]">
                  Project files
                </h3>

                <p className="text-[11px] text-[#5C8A85]">
                  Give DevSmith access to
                  your codebase
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-1.5">
              <span className="font-mono text-[10px] text-[#7B9998]">
                {indexedCount} indexed
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg bg-[#7FD8AE] px-3 py-2 text-xs font-semibold text-[#071A1F] transition hover:bg-[#9AE7C2] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <Upload size={14} />
              )}

              {uploading
                ? "Indexing..."
                : "Add files"}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              accept={ACCEPTED_EXTENSIONS.join(
                ","
              )}
              onChange={
                handleFileSelect
              }
            />
          </div>
        </div>

        {/* DROPZONE */}

        <div className="p-4">
          <div
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDrop={handleDrop}
            onClick={() =>
              fileInputRef.current?.click()
            }
            className={`group cursor-pointer rounded-xl border border-dashed p-5 text-center transition ${
              dragActive
                ? "border-[#7FD8AE]/50 bg-[#7FD8AE]/[0.07]"
                : "border-white/[0.08] bg-black/10 hover:border-[#7FD8AE]/30 hover:bg-white/[0.02]"
            }`}
          >
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] transition group-hover:border-[#7FD8AE]/20 group-hover:bg-[#7FD8AE]/[0.05]">
              <Paperclip
                size={18}
                className="text-[#7B9998] group-hover:text-[#7FD8AE]"
              />
            </div>

            <p className="text-sm font-medium text-[#D8E9E5]">
              {dragActive
                ? "Drop your files here"
                : "Drop project files here"}
            </p>

            <p className="mt-1 text-[11px] text-[#5C8A85]">
              or click to browse · up to
              5 MB per file
            </p>

            <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-[#456B68]">
              TS · TSX · JS · JSX · PY · JSON
              · CSS · HTML · SQL · MD · more
            </p>
          </div>
        </div>

        {/* FILE LIST */}

        {loadingFiles ? (
          <div className="flex items-center justify-center border-t border-white/[0.06] px-5 py-6">
            <Loader2
              size={16}
              className="animate-spin text-[#7FD8AE]"
            />
          </div>
        ) : files.length > 0 ? (
          <div className="border-t border-white/[0.06]">
            <div className="max-h-56 overflow-y-auto">
              {files.map((file) => {
                const Icon =
                  getFileIcon(
                    file.extension
                  );

                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 border-b border-white/[0.04] px-5 py-3 last:border-b-0 hover:bg-white/[0.015]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.03]">
                      <Icon
                        size={15}
                        className={
                          file.status ===
                          "indexed"
                            ? "text-[#7FD8AE]"
                            : file.status ===
                              "error"
                            ? "text-red-300"
                            : "text-[#7B9998]"
                        }
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-medium text-[#D8E9E5]">
                          {file.name}
                        </p>

                        {file.status ===
                          "indexed" && (
                          <Check
                            size={12}
                            className="shrink-0 text-[#7FD8AE]"
                          />
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[9px] text-[#5C8A85]">
                        <span>
                          {formatFileSize(
                            file.size
                          )}
                        </span>

                        {file.chunks !==
                          undefined && (
                          <>
                            <span>
                              ·
                            </span>
                            <span>
                              {
                                file.chunks
                              }{" "}
                              chunks
                            </span>
                          </>
                        )}

                        {file.status ===
                          "indexing" && (
                          <>
                            <span>
                              ·
                            </span>
                            <span className="text-[#F2A65A]">
                              indexing
                            </span>
                          </>
                        )}

                        {file.status ===
                          "error" && (
                          <>
                            <span>
                              ·
                            </span>
                            <span className="text-red-300">
                              failed
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeFile(
                          file.id
                        )
                      }
                      className="rounded-md p-1.5 text-[#456B68] transition hover:bg-red-400/10 hover:text-red-300"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/[0.04] px-5 py-3">
              <div className="flex items-center gap-2">
                <Sparkles
                  size={12}
                  className="text-[#7FD8AE]"
                />

                <p className="text-[10px] text-[#5C8A85]">
                  DevSmith will use indexed
                  files as context when
                  answering your questions.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* MODES */}

      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((item) => {
          const Icon = item.icon;

          const isActive =
            mode === item.id;

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

      {/* CONVERSATION */}

      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#7B9998]">
              Conversation
            </p>

            {indexedCount > 0 && (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7FD8AE]" />

                <span className="text-[10px] text-[#5C8A85]">
                  {indexedCount} project{" "}
                  {indexedCount === 1
                    ? "file"
                    : "files"}{" "}
                  available
                </span>
              </div>
            )}
          </div>

          <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 font-mono text-[9px] uppercase text-[#5C8A85]">
            {activeMode.label}
          </span>
        </div>

        <div className="min-h-[320px] max-h-[480px] overflow-y-auto px-6 py-5">
          {loadingHistory ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <Loader2
                size={18}
                className="animate-spin text-[#7FD8AE]"
              />
            </div>
          ) : messages.length === 0 &&
            !loading ? (
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
                {indexedCount > 0
                  ? `DevSmith has access to ${indexedCount} indexed project ${
                      indexedCount ===
                      1
                        ? "file"
                        : "files"
                    }. Ask a question about your codebase.`
                  : taskContext
                  ? "Your task context is loaded. Send a message or switch modes."
                  : `Use ${activeMode.label.toLowerCase()} mode for ${project.title}.`}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map(
                (item) => (
                  <div
                    key={item.id}
                    className={`flex ${
                      item.role ===
                      "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 ${
                        item.role ===
                        "user"
                          ? "border border-[#F2A65A]/20 bg-[#F2A65A]/10 text-[#F4FFFC]"
                          : "border border-white/[0.06] bg-black/20 text-[#D8E9E5]"
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#5C8A85]">
                          {item.role ===
                          "user"
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

                      {item.role ===
                      "assistant" ? (
                        <div className="space-y-2">
                          {renderContent(
                            item.content
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">
                          {
                            item.content
                          }
                        </p>
                      )}
                    </div>
                  </div>
                )
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-[#7B9998]">
                      <Loader2
                        size={13}
                        className="animate-spin text-[#7FD8AE]"
                      />

                      DevSmith is
                      thinking...
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* COMPOSER */}

        <div className="border-t border-white/[0.06] p-6">
          {activeMode.requiresCode && (
            <div className="mb-4">
              <label className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-[#7B9998]">
                Code
              </label>

              <textarea
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value
                  )
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
                setMessage(
                  event.target.value
                )
              }
              onKeyDown={
                handleKeyDown
              }
              placeholder={
                activeMode.placeholder
              }
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#5C8A85]">
              Press Ctrl+Enter to send.
            </p>

            {indexedCount > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-[#7FD8AE]">
                <Sparkles size={11} />
                Project context enabled
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}