// import { generateWithOllama } from "./ollama";
import { generateWithOllama } from "./llmProvider";

export async function askTaskAssistant(
  projectTitle: string,
  projectDescription: string,
  taskTitle: string,
  taskDescription: string,
  model: string
): Promise<string> {
  if (!model?.trim()) {
    throw new Error("Ollama model is required.");
  }

  if (!taskTitle?.trim()) {
    throw new Error("Task title is required.");
  }

  const prompt = `
You are DevSmith, an AI software development assistant.

Help the developer implement the following roadmap task.

PROJECT:
${projectTitle}

PROJECT DESCRIPTION:
${projectDescription || "No description provided."}

TASK:
${taskTitle}

TASK DESCRIPTION:
${taskDescription || "No description provided."}

Provide:

1. What needs to be built
2. Recommended approach
3. Suggested architecture
4. Implementation steps
5. Example code when useful
6. Potential mistakes to avoid
7. Testing recommendations

Be practical and technical.

Assume this is a real production application.

Do not give vague advice.
`;

  return generateWithOllama(
    model.trim(),
    prompt,
    {
      timeout: 180000,
    }
  );
}