// import { generateWithOllama } from "./ollama";
import { generateWithOllama } from "./llmProvider";

import { ROADMAP_PROMPT } from "./prompts";

interface RoadmapMilestone {
  title: string;
  description: string;
  tasks: string[];
}

export interface GeneratedRoadmap {
  techStack: string[];
  milestones: RoadmapMilestone[];
}

function extractJson(raw: string): string {
  const text = raw.trim();

  const fencedMatch = text.match(
    /```(?:json)?\s*([\s\S]*?)\s*```/i
  );

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

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

function isValidRoadmap(
  value: unknown
): value is GeneratedRoadmap {
  if (!value || typeof value !== "object") {
    return false;
  }

  const roadmap = value as {
    techStack?: unknown;
    milestones?: unknown;
  };

  if (
    !Array.isArray(roadmap.techStack) ||
    !roadmap.techStack.every(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0
    )
  ) {
    return false;
  }

  if (
    !Array.isArray(roadmap.milestones) ||
    roadmap.milestones.length === 0
  ) {
    return false;
  }

  return roadmap.milestones.every(
    (milestone) => {
      if (
        !milestone ||
        typeof milestone !== "object"
      ) {
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
            typeof task === "string" &&
            task.trim().length > 0
        )
      );
    }
  );
}

export async function generateRoadmap(
  title: string,
  description: string,
  model: string
): Promise<GeneratedRoadmap> {
  if (!title?.trim()) {
    throw new Error(
      "Project title is required."
    );
  }

  if (!model?.trim()) {
    throw new Error(
      "Ollama model is required."
    );
  }

  const prompt = `
${ROADMAP_PROMPT}

PROJECT TITLE:
${title.trim()}

PROJECT DESCRIPTION:
${description?.trim() || "No description provided."}
`;

  console.log(
    `🗺️ Generating roadmap with Ollama model: ${model}`
  );

  const raw = await generateWithOllama(
    model.trim(),
    prompt,
    {
      format: "json",
      timeout: 180000,
    }
  );

  let parsed: unknown;

  try {
    parsed = JSON.parse(
      extractJson(raw)
    );
  } catch (error) {
    console.error(
      "❌ Invalid roadmap JSON:",
      raw
    );

    throw new Error(
      "Ollama returned invalid roadmap JSON."
    );
  }

  if (!isValidRoadmap(parsed)) {
    console.error(
      "❌ Invalid roadmap structure:",
      parsed
    );

    throw new Error(
      "Ollama returned an invalid roadmap structure."
    );
  }

  return {
    techStack: parsed.techStack.map(
      (item) => item.trim()
    ),

    milestones:
      parsed.milestones.map(
        (milestone) => ({
          title: milestone.title.trim(),
          description:
            milestone.description.trim(),
          tasks: milestone.tasks.map(
            (task) => task.trim()
          ),
        })
      ),
  };
}