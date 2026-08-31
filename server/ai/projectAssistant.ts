// import { generateWithOllama } from "./ollama";
import { generateWithOllama } from "./llmProvider";

import {
  formatProjectContext,
  type ProjectContext,
} from "./projectContext";
import {
  formatIndexedFiles,
  type IndexedFile,
} from "./fileIndexer";

/**
 * Modes supported by the DevSmith AI assistant.
 */
export type AssistantMode =
  | "ask"
  | "generate"
  | "explain"
  | "fix";

/**
 * A previous conversation message.
 */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Current roadmap task context.
 */
export interface TaskContext {
  id: string;
  title: string;
  description: string;
  milestoneTitle: string;
}

/**
 * Project context supplied to the AI.
 *
 * `files` contains files indexed from the user's
 * local project directory.
 */
export interface AssistantProjectContext
  extends ProjectContext {
  files?: IndexedFile[];
}

/**
 * Maximum amount of conversation history
 * sent to the model.
 */
const MAX_HISTORY_TURNS = 8;

/**
 * Maximum amount of project source code
 * sent to the model.
 */
const MAX_PROJECT_FILE_CONTEXT = 40_000;

/**
 * Format previous conversation history.
 */
function formatHistory(
  history: ChatTurn[]
): string {
  if (!history.length) {
    return "";
  }

  const recentHistory = history.slice(
    -MAX_HISTORY_TURNS
  );

  return `
PREVIOUS CONVERSATION:

${recentHistory
  .map((turn) => {
    const role =
      turn.role === "user"
        ? "User"
        : "DevSmith";

    return `${role}:
${turn.content}`;
  })
  .join("\n\n")}
`;
}

/**
 * Format the currently selected roadmap task.
 */
function formatTaskContext(
  task: TaskContext
): string {
  return `
CURRENT ROADMAP TASK:

Milestone:
${task.milestoneTitle}

Task:
${task.title}

Task Description:
${task.description || "No task description provided."}
`;
}

/**
 * Format indexed project files.
 */
function formatFiles(
  files?: IndexedFile[]
): string {
  if (!files?.length) {
    return `
PROJECT FILES:

No project files have been indexed yet.
`;
  }

  return `
PROJECT FILES:

${formatIndexedFiles(
  files,
  MAX_PROJECT_FILE_CONTEXT
)}
`;
}

/**
 * Build the shared context used by every assistant mode.
 */
function baseContext(
  project: AssistantProjectContext,
  history: ChatTurn[],
  task?: TaskContext
): string {
  return `
You are DevSmith.

You are an AI software development assistant designed to help
developers build, understand, debug, and improve web applications.

You are running locally through Ollama.

Your primary responsibility is to provide accurate,
project-aware software engineering assistance.

${formatProjectContext(project)}

${task ? formatTaskContext(task) : ""}

${formatFiles(project.files)}

${formatHistory(history)}

IMPORTANT PROJECT RULES:

1. Treat the provided project information as the source of truth.

2. Use the provided project files whenever they are relevant.

3. Never claim that a file exists unless it appears in the
   provided project files.

4. Never invent functions, components, APIs, database tables,
   routes, environment variables, or dependencies.

5. Prefer the existing project architecture over introducing
   unnecessary new architecture.

6. Prefer the project's existing libraries and patterns.

7. If a required file or piece of information is missing,
   explicitly say what is missing.

8. Never expose, reproduce, or request secrets such as:
   API keys, passwords, tokens, private keys, or credentials.

9. Do not assume this is an Electron or desktop application.

10. This is a WEB APPLICATION unless the project context
    explicitly indicates otherwise.

11. When discussing frontend code, consider:
    React, TypeScript, JavaScript, CSS, routing,
    state management, accessibility, and browser behavior.

12. When discussing backend code, consider:
    Node.js, Express, APIs, databases, validation,
    error handling, and security.

13. Give practical implementation advice rather than
    vague conceptual answers.

14. Do not pretend to have executed code, installed packages,
    modified files, or tested the application.

15. When code changes are requested, clearly explain which
    files should be created or modified.
`;
}

/**
 * Build prompt for general questions.
 */
function buildAskPrompt(
  project: AssistantProjectContext,
  message: string,
  history: ChatTurn[],
  task?: TaskContext
): string {
  return `
${baseContext(project, history, task)}

The developer is asking a software development question.

QUESTION:

${message}

Answer the developer directly.

Your response should:

- Understand the existing project before suggesting changes.
- Reference actual project files when relevant.
- Explain why your recommendation makes sense.
- Provide concrete implementation steps.
- Include code examples when they improve the answer.
- Mention important edge cases.
- Avoid unnecessary complexity.

If the requested feature cannot be implemented correctly
with the available project information, explain exactly
what information is missing.
`;
}

/**
 * Build prompt for code generation.
 */
function buildGeneratePrompt(
  project: AssistantProjectContext,
  message: string,
  history: ChatTurn[],
  task?: TaskContext
): string {
  return `
${baseContext(project, history, task)}

The developer wants you to generate or modify code.

REQUEST:

${message}

Generate a practical implementation for the existing
web application.

Requirements:

- Match the existing technology stack.
- Match the existing architecture.
- Reuse existing components, utilities, services,
  API routes, and patterns when appropriate.
- Include all necessary imports.
- Use valid TypeScript or JavaScript.
- Generate complete runnable code.
- Do not generate pseudocode.
- Do not invent files that are not necessary.
- Do not introduce dependencies unless necessary.
- If a dependency is required, clearly state it.
- Clearly identify every file that should be created
  or modified.
- Explain how the changes fit into the existing application.
- Consider error handling and edge cases.
- Consider browser compatibility.
- Consider security where relevant.

Use Markdown code blocks.

IMPORTANT:

You are providing code for the developer to apply.

You do NOT directly modify their filesystem.
`;
}

/**
 * Build prompt for explaining code.
 */
function buildExplainPrompt(
  project: AssistantProjectContext,
  message: string,
  code: string,
  history: ChatTurn[],
  task?: TaskContext
): string {
  return `
${baseContext(project, history, task)}

The developer wants help understanding code.

QUESTION:

${message || "Explain this code."}

CODE:

${code}

Explain the code in a way that is useful to a developer
working on this project.

Cover:

1. What the code does
2. How the important parts work
3. How data flows through the code
4. Important functions and components
5. Libraries or APIs being used
6. How it interacts with the rest of the application
7. Potential bugs or weaknesses
8. Edge cases
9. Possible improvements

Do not invent behavior that is not present in the code.

If something cannot be determined from the provided code,
say so.
`;
}

/**
 * Build prompt for debugging/fixing code.
 */
function buildFixPrompt(
  project: AssistantProjectContext,
  message: string,
  code: string,
  history: ChatTurn[],
  task?: TaskContext
): string {
  return `
${baseContext(project, history, task)}

The developer needs help debugging code.

PROBLEM:

${message || "Find and fix the problems in this code."}

CODE:

${code}

Analyze the code carefully.

Your response must contain:

## 1. Problem

Explain what is wrong.

## 2. Cause

Explain why the problem happens.

## 3. Fix

Provide corrected code.

## 4. Explanation

Explain the important changes.

## 5. Testing

Explain how the developer can verify the fix.

## 6. Additional Issues

Mention other important problems you notice.

When fixing the code:

- Preserve the existing architecture.
- Avoid unnecessary dependencies.
- Preserve existing functionality.
- Use correct TypeScript types.
- Handle errors appropriately.
- Consider null and undefined values.
- Consider asynchronous behavior.
- Consider API failures.
- Consider browser behavior.
- Consider security implications.
- Do not invent APIs or project files.

Use Markdown code blocks.
`;
}

/**
 * Run DevSmith's project assistant.
 */
export async function runProjectAssistant(
  mode: AssistantMode,
  project: AssistantProjectContext,
  message: string,
  model: string,
  code?: string,
  history: ChatTurn[] = [],
  task?: TaskContext
): Promise<string> {
  const trimmedMessage =
    message?.trim() ?? "";

  const selectedModel =
    model?.trim();

  if (!selectedModel) {
    throw new Error(
      "Ollama model is required."
    );
  }

  if (
    !trimmedMessage &&
    mode !== "explain" &&
    mode !== "fix"
  ) {
    throw new Error(
      "Message is required."
    );
  }

  if (
    (mode === "explain" ||
      mode === "fix") &&
    !code?.trim()
  ) {
    throw new Error(
      "Code is required for explain and fix modes."
    );
  }

  let prompt: string;

  switch (mode) {
    case "ask":
      prompt = buildAskPrompt(
        project,
        trimmedMessage,
        history,
        task
      );
      break;

    case "generate":
      prompt = buildGeneratePrompt(
        project,
        trimmedMessage,
        history,
        task
      );
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
      throw new Error(
        `Unknown assistant mode: ${mode}`
      );
  }

  return generateWithOllama(
    selectedModel,
    prompt,
    {
      timeout: 180000,
    }
  );
}