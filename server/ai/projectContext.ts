export interface ProjectContextInput {
  title: string;
  description?: string;
  techStack?: string[];
}

export interface ProjectContext {
  title: string;
  description: string;
  techStack: string[];
}

export function buildProjectContext(
  project: ProjectContextInput
): ProjectContext {
  return {
    title: project.title?.trim() || "Untitled Project",

    description:
      project.description?.trim() ||
      "No project description provided.",

    techStack:
      Array.isArray(project.techStack)
        ? project.techStack
            .filter(
              (item): item is string =>
                typeof item === "string"
            )
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
  };
}

export function formatProjectContext(
  context: ProjectContext
): string {
  const techStack =
    context.techStack.length > 0
      ? context.techStack.join(", ")
      : "Not specified";

  return `
PROJECT:
${context.title}

DESCRIPTION:
${context.description}

TECH STACK:
${techStack}
`.trim();
}