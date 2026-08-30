import { generateWithOllama } from "./ollama";

export type AssistantMode =
  | "ask"
  | "generate"
  | "explain"
  | "fix";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface ProjectContext {
  title: string;
  description: string;
}

interface TaskContext {
  id: string;
  title: string;
  description: string;
  milestoneTitle: string;
}

function formatHistory(history: ChatTurn[]): string {
  if (history.length === 0) {
    return "";
  }

  const turns = history
    .slice(-6)
    .map(
      (turn) =>
        `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`
    )
    .join("\n\n");

  return `
Previous conversation:
${turns}
`;
}

function formatTaskContext(task: TaskContext): string {
  return `
CURRENT TASK (focus your answer on implementing this):
- Milestone: ${task.milestoneTitle}
- Task: ${task.title}
- Description: ${task.description || "No description provided."}
`;
}

function buildAskPrompt(
  project: ProjectContext,
  message: string,
  history: ChatTurn[],
  task?: TaskContext
): string {
  return `
You are DevSmith, an AI software development assistant embedded in a project workspace.

PROJECT:
${project.title}

PROJECT DESCRIPTION:
${project.description || "No description provided."}

${task ? formatTaskContext(task) : ""}

${formatHistory(history)}

The developer is asking a question about this project.

QUESTION:
${message}

Answer clearly and practically. Reference the project context when relevant.
Use code examples when they help. Be concise but thorough.
`;
}

function buildGeneratePrompt(
  project: ProjectContext,
  message: string,
  history: ChatTurn[],
  task?: TaskContext
): string {
  return `
You are DevSmith, an expert software engineer generating production-ready code.

PROJECT:
${project.title}

PROJECT DESCRIPTION:
${project.description || "No description provided."}

${task ? formatTaskContext(task) : ""}

${formatHistory(history)}

The developer wants you to generate code for this request:

${message}

Requirements:
- Write complete, runnable code
- Match the project's likely tech stack from the description
- Include brief comments for non-obvious logic
- Wrap code in markdown fenced blocks with the correct language tag
- After the code, add a short "How to use" section
- Do not give vague pseudocode — write real implementation
`;
}

function buildExplainPrompt(
  project: ProjectContext,
  message: string,
  code: string,
  history: ChatTurn[],
  task?: TaskContext
): string {
  return `
You are DevSmith, an AI software development assistant.

PROJECT:
${project.title}

PROJECT DESCRIPTION:
${project.description || "No description provided."}

${task ? formatTaskContext(task) : ""}

${formatHistory(history)}

The developer wants you to explain the following code.

${message ? `Additional context:\n${message}\n` : ""}

CODE:
\`\`\`
${code}
\`\`\`

Explain:
1. What the code does overall
2. How key parts work
3. Important patterns, libraries, or conventions used
4. Potential edge cases or limitations

Be clear and educational.
`;
}

function buildFixPrompt(
  project: ProjectContext,
  message: string,
  code: string,
  history: ChatTurn[],
  task?: TaskContext
): string {
  return `
You are DevSmith, an expert debugger and code reviewer.

PROJECT:
${project.title}

PROJECT DESCRIPTION:
${project.description || "No description provided."}

${task ? formatTaskContext(task) : ""}

${formatHistory(history)}

The developer needs help fixing or improving the following code.

${message ? `Problem description:\n${message}\n` : "Find and fix bugs, improve correctness, and explain what was wrong.\n"}

CODE:
\`\`\`
${code}
\`\`\`

Your response must include:
1. What is wrong or could be improved
2. The corrected code in a markdown fenced block
3. A concise explanation of each fix
`;
}

export async function runProjectAssistant(
  mode: AssistantMode,
  project: ProjectContext,
  message: string,
  model: string,
  code?: string,
  history: ChatTurn[] = [],
  task?: TaskContext
): Promise<string> {
  const trimmedMessage = message.trim();

  if (!trimmedMessage && mode !== "explain" && mode !== "fix") {
    throw new Error("Message is required.");
  }

  if ((mode === "explain" || mode === "fix") && !code?.trim()) {
    throw new Error("Code is required for explain and fix modes.");
  }

  let prompt: string;

  switch (mode) {
    case "ask":
      prompt = buildAskPrompt(project, trimmedMessage, history, task);
      break;
    case "generate":
      prompt = buildGeneratePrompt(project, trimmedMessage, history, task);
      break;
    case "explain":
      prompt = buildExplainPrompt(
        project,
        trimmedMessage,
        code!.trim(),
        history,
        task
      );
      break;
    case "fix":
      prompt = buildFixPrompt(
        project,
        trimmedMessage,
        code!.trim(),
        history,
        task
      );
      break;
    default:
      throw new Error(`Unknown assistant mode: ${mode}`);
  }

  return generateWithOllama(model, prompt);
}
