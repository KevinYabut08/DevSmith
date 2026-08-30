import { generateWithOllama } from "./ollama";

interface RoadmapMilestone {
  title: string;
  description: string;
  tasks: string[];
}

export interface GeneratedRoadmap {
  milestones: RoadmapMilestone[];
}

function extractJson(raw: string): string {
  const text = raw.trim();

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

function isValidRoadmap(value: unknown): value is GeneratedRoadmap {
  if (!value || typeof value !== "object") {
    return false;
  }

  const roadmap = value as { milestones?: unknown };

  if (!Array.isArray(roadmap.milestones) || roadmap.milestones.length === 0) {
    return false;
  }

  return roadmap.milestones.every((milestone) => {
    if (!milestone || typeof milestone !== "object") {
      return false;
    }

    const item = milestone as {
      title?: unknown;
      description?: unknown;
      tasks?: unknown;
    };

    return (
      typeof item.title === "string" &&
      item.title.trim().length > 0 &&
      typeof item.description === "string" &&
      Array.isArray(item.tasks) &&
      item.tasks.length > 0 &&
      item.tasks.every(
        (task) =>
          typeof task === "string" && task.trim().length > 0
      )
    );
  });
}

export async function generateRoadmap(
  title: string,
  description: string,
  model: string
): Promise<GeneratedRoadmap> {
  const selectedModel = model?.trim();

  if (!selectedModel) {
    throw new Error("Ollama model is required.");
  }

  if (!title?.trim()) {
    throw new Error("Project title is required.");
  }

  const prompt = `
You are a senior software architect.

Create a practical development roadmap for this project.

Project title:
${title.trim()}

Project description:
${description?.trim() || "No description provided."}

Return ONLY valid JSON. Do not use Markdown, code fences, or explanations.

Use exactly this structure:
{
  "milestones": [
    {
      "title": "string",
      "description": "string",
      "tasks": ["string", "string", "string"]
    }
  ]
}

Requirements:
- Create 4 to 6 milestones.
- Each milestone must contain 3 to 6 actionable tasks.
- Order milestones logically.
- Include setup, architecture, core features, testing, and deployment where appropriate.
`;

  console.log(`Generating roadmap with Ollama model: ${selectedModel}`);

  const raw = await generateWithOllama(selectedModel, prompt, {
    format: "json",
  });

  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Ollama returned an empty response.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (error) {
    console.error("Failed to parse Ollama JSON:", raw, error);
    throw new Error("Ollama returned invalid JSON.");
  }

  if (!isValidRoadmap(parsed)) {
    console.error("Invalid roadmap structure from Ollama:", parsed);
    throw new Error("Ollama returned an invalid roadmap structure.");
  }

  return {
    milestones: parsed.milestones.map((milestone) => ({
      title: milestone.title.trim(),
      description: milestone.description.trim(),
      tasks: milestone.tasks.map((task) => task.trim()),
    })),
  };
}
