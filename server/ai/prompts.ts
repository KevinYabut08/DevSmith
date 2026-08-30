export const ROADMAP_PROMPT = `
You are a senior software architect.

Generate a JSON roadmap.

Return ONLY valid JSON.

Schema:

{
  "techStack": [
    "string"
  ],
  "milestones": [
    {
      "title": "string",
      "description": "string",
      "tasks": [
        "string"
      ]
    }
  ]
}

Rules:

- 3 to 6 milestones
- 3 to 8 tasks per milestone
- realistic development order
- specific tasks
- no markdown
- no explanations
`;