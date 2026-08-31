/**
 * WebMCP tool registrations for DevSmith.
 *
 * These expose DevSmith's core actions directly to agents (e.g. ChatGPT's
 * in-app browser) via `document.modelContext.registerTool`, instead of
 * making the agent guess its way through clicks and forms.
 *
 * USAGE:
 *   Drop this file in `src/webmcpTools.ts` and call it inside App.tsx,
 *   passing the currently selected Ollama model so agents don't have to
 *   guess a model name:
 *
 *     import { useDevSmithWebMCPTools } from "./webmcpTools";
 *     ...
 *     function App() {
 *       const [selectedModel, setSelectedModel] = useState(...);
 *       useDevSmithWebMCPTools(selectedModel);
 *       ...
 *     }
 *
 * Tools re-register whenever `selectedModel` changes, so the model an
 * agent uses always matches what's shown as "Active Model" in the sidebar.
 *
 * NOTE ON BROWSER SUPPORT:
 *   `document.modelContext` only exists in WebMCP-enabled browsers
 *   (ChatGPT's in-app browser, or Chrome with the WebMCP flag on). This
 *   file guards every call so it's a safe no-op everywhere else.
 */

import { useEffect } from "react";

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:3001";

/* -------------------------------------------------------------------- */
/*  Minimal WebMCP type shims (the real types ship with the WebMCP spec  */
/*  polyfill / browser typings; these keep this file self-contained).    */
/* -------------------------------------------------------------------- */

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: any) => Promise<unknown>;
}

declare global {
  interface Window {
    // Present only in WebMCP-enabled browsers.
  }
  interface Document {
    modelContext?: {
      registerTool: (tool: ToolDefinition) => { unregister?: () => void } | void;
    };
  }
}

function isWebMCPAvailable(): boolean {
  return typeof document !== "undefined" && !!document.modelContext;
}

/* -------------------------------------------------------------------- */
/*  Small fetch helper matching your existing API conventions            */
/* -------------------------------------------------------------------- */

async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || `Request to ${path} failed`);
  }

  return data as T;
}

/* -------------------------------------------------------------------- */
/*  Tool definitions                                                     */
/* -------------------------------------------------------------------- */

function buildTools(defaultModel: string | null): ToolDefinition[] {
  return [
    {
      name: "list_projects",
      description:
        "List all DevSmith projects with their id, title, description, and status (Planning, In Progress, Completed).",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        return api("/api/projects");
      },
    },

    {
      name: "create_project",
      description:
        "Create a new DevSmith project with a title and optional description. Returns the created project including its id, which is needed for roadmap and task tools.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Project name" },
          description: {
            type: "string",
            description: "What the project is about",
          },
        },
        required: ["title"],
      },
      execute: async (input: { title: string; description?: string }) => {
        return api("/api/projects", {
          method: "POST",
          body: JSON.stringify({
            title: input.title,
            description: input.description ?? "",
          }),
        });
      },
    },

    {
      name: "get_project",
      description: "Get a single DevSmith project by its id.",
      inputSchema: {
        type: "object",
        properties: { projectId: { type: "string" } },
        required: ["projectId"],
      },
      execute: async (input: { projectId: string }) => {
        return api(`/api/projects/${input.projectId}`);
      },
    },

    {
      name: "generate_roadmap",
      description:
        "Generate an AI roadmap (milestones and tasks) for a project. Uses the model currently selected in DevSmith's Settings unless a different model name is given.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          model: {
            type: "string",
            description: "Optional model name override",
          },
        },
        required: ["projectId"],
      },
      execute: async (input: { projectId: string; model?: string }) => {
        const model = input.model ?? defaultModel;
        if (!model) {
          throw new Error(
            "No model selected. Ask the user to pick an Ollama model in DevSmith Settings first."
          );
        }
        return api(`/api/projects/${input.projectId}/roadmap/generate`, {
          method: "POST",
          body: JSON.stringify({ model }),
        });
      },
    },

    {
      name: "get_roadmap",
      description:
        "Get the current roadmap (milestones and their tasks) for a project.",
      inputSchema: {
        type: "object",
        properties: { projectId: { type: "string" } },
        required: ["projectId"],
      },
      execute: async (input: { projectId: string }) => {
        return api(`/api/projects/${input.projectId}/roadmap`);
      },
    },

    {
      name: "create_task",
      description: "Add a new task to an existing milestone in a project's roadmap.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          milestoneId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["projectId", "milestoneId", "title"],
      },
      execute: async (input: {
        projectId: string;
        milestoneId: string;
        title: string;
        description?: string;
      }) => {
        return api(
          `/api/projects/${input.projectId}/roadmap/milestones/${input.milestoneId}/tasks`,
          {
            method: "POST",
            body: JSON.stringify({
              title: input.title,
              description: input.description ?? "",
            }),
          }
        );
      },
    },

    {
      name: "update_task",
      description:
        "Update a task's title, description, or completed status (e.g. mark a task done).",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          taskId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          completed: { type: "boolean" },
        },
        required: ["projectId", "taskId"],
      },
      execute: async (input: {
        projectId: string;
        taskId: string;
        title?: string;
        description?: string;
        completed?: boolean;
      }) => {
        const { projectId, taskId, ...body } = input;
        return api(`/api/projects/${projectId}/roadmap/tasks/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      },
    },

    {
      name: "ask_devsmith_assistant",
      description:
        "Ask the DevSmith AI assistant a software-development question about a specific project (mode: ask, generate, explain, or fix). Uses project context and indexed files when available.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string" },
          message: { type: "string" },
          mode: {
            type: "string",
            enum: ["ask", "generate", "explain", "fix"],
          },
          model: { type: "string" },
        },
        required: ["projectId", "message"],
      },
      execute: async (input: {
        projectId: string;
        message: string;
        mode?: string;
        model?: string;
      }) => {
        const model = input.model ?? defaultModel;
        if (!model) {
          throw new Error(
            "No model selected. Ask the user to pick an Ollama model in DevSmith Settings first."
          );
        }
        return api(`/api/projects/${input.projectId}/assistant`, {
          method: "POST",
          body: JSON.stringify({
            message: input.message,
            mode: input.mode ?? "ask",
            model,
          }),
        });
      },
    },
  ];
}

/* -------------------------------------------------------------------- */
/*  React hook: registers on mount, unregisters on unmount               */
/* -------------------------------------------------------------------- */

export function useDevSmithWebMCPTools(selectedModel: string | null) {
  useEffect(() => {
    if (!isWebMCPAvailable()) {
      console.info(
        "[DevSmith] WebMCP not available in this browser — tools not registered."
      );
      return;
    }

    const registrations = buildTools(selectedModel).map((tool) =>
      document.modelContext!.registerTool(tool)
    );

    console.info(`[DevSmith] Registered ${registrations.length} WebMCP tools.`);

    return () => {
      for (const registration of registrations) {
        registration?.unregister?.();
      }
    };
    // Re-register whenever the active model changes so tool calls always
    // match what the user sees as "Active Model" in the sidebar.
  }, [selectedModel]);
}