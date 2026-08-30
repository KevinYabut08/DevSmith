import { generateWithOllama } from "./ollama";

export async function askTaskAssistant(
  projectTitle: string,
  projectDescription: string,
  taskTitle: string,
  taskDescription: string,
  model: string
): Promise<string> {
  const prompt = `
You are DevSmith, an AI software development assistant.

Your job is to help developers implement tasks from their development roadmap.

PROJECT:
${projectTitle}

PROJECT DESCRIPTION:
${projectDescription || "No description provided."}

TASK:
${taskTitle}

TASK DESCRIPTION:
${taskDescription || "No description provided."}

Explain how the developer should implement this task.

Your response should contain:

1. What needs to be built
2. Recommended approach
3. Suggested architecture
4. Implementation steps
5. Example code when useful
6. Potential mistakes to avoid

Be practical and technical.
Do not give vague advice.
Assume the developer is building a real production application.
`;

  return generateWithOllama(model, prompt);
}
