// import {
//   generateWithOllama,
// } from "./ollama";

 import {
  generateWithOllama,
 } from "./llmProvider";

import {
  formatIndexedFiles,
  type IndexedFile,
} from "./fileIndexer";

export interface GeneratedCode {
  explanation: string;

  files: {
    path: string;
    content: string;
  }[];
}

function extractJson(
  raw: string
): string {
  const text = raw.trim();

  const fencedMatch =
    text.match(
      /```(?:json)?\s*([\s\S]*?)\s*```/i
    );

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace =
    text.indexOf("{");

  const lastBrace =
    text.lastIndexOf("}");

  if (
    firstBrace >= 0 &&
    lastBrace > firstBrace
  ) {
    return text.slice(
      firstBrace,
      lastBrace + 1
    );
  }

  return text;
}

function validateGeneratedCode(
  value: unknown
): value is GeneratedCode {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const result =
    value as {
      explanation?: unknown;
      files?: unknown;
    };

  if (
    typeof result.explanation !==
    "string"
  ) {
    return false;
  }

  if (
    !Array.isArray(result.files)
  ) {
    return false;
  }

  return result.files.every(
    (file) => {
      if (
        !file ||
        typeof file !== "object"
      ) {
        return false;
      }

      const item =
        file as {
          path?: unknown;
          content?: unknown;
        };

      return (
        typeof item.path ===
          "string" &&
        item.path.trim().length > 0 &&
        typeof item.content ===
          "string"
      );
    }
  );
}

export async function generateCode(
  taskTitle: string,
  taskDescription: string,
  model: string,
  files: IndexedFile[] = []
): Promise<GeneratedCode> {
  if (!taskTitle?.trim()) {
    throw new Error(
      "Task title is required."
    );
  }

  if (!model?.trim()) {
    throw new Error(
      "Ollama model is required."
    );
  }

  const projectFiles =
    files.length > 0
      ? formatIndexedFiles(
          files,
          35_000
        )
      : "No project files were provided.";

  const prompt = `
You are DevSmith, a senior software engineer.

Your job is to implement a roadmap task inside an existing software project.

TASK:
${taskTitle.trim()}

TASK DESCRIPTION:
${
  taskDescription?.trim() ||
  "No description provided."
}

EXISTING PROJECT FILES:

${projectFiles}

Return ONLY valid JSON.

Required structure:

{
  "explanation": "Brief explanation of the implementation",
  "files": [
    {
      "path": "src/example.ts",
      "content": "complete file contents"
    }
  ]
}

Rules:

- Return valid JSON only.
- Do not use Markdown.
- Do not use code fences.
- Do not add explanations outside the JSON.
- Generate complete runnable code.
- Do not generate pseudocode.
- Respect the existing project architecture.
- Modify existing files when appropriate.
- Do not invent dependencies unnecessarily.
- Include required imports.
- Do not include .env files.
- Do not include secrets or credentials.
- Use sensible file paths.
`;

  const raw =
    await generateWithOllama(
      model.trim(),
      prompt,
      {
        format: "json",
        timeout: 180000,
      }
    );

  console.log(
    "Generated code response:",
    raw
  );

  let parsed: unknown;

  try {
    parsed = JSON.parse(
      extractJson(raw)
    );
  } catch {
    console.error(
      "Failed to parse generated code JSON:",
      raw
    );

    throw new Error(
      "Ollama returned invalid JSON for generated code."
    );
  }

  if (
    !validateGeneratedCode(parsed)
  ) {
    console.error(
      "Invalid generated code structure:",
      parsed
    );

    throw new Error(
      "Ollama returned an invalid generated code structure."
    );
  }

  return {
    explanation:
      parsed.explanation.trim(),

    files: parsed.files.map(
      (file) => ({
        path: file.path.trim(),
        content: file.content,
      })
    ),
  };
}