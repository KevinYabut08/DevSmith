# DevSmith

DevSmith is a local-first AI development workspace: plan a project, get an
AI-generated roadmap of milestones and tasks, and use an in-context AI
assistant to ask, generate, explain, or fix code — all backed by your own
local [Ollama](https://ollama.com) models, so your code and prompts never
leave your machine.

**Live demo:** https://dev-smith-navy.vercel.app/
*(Best experienced in [ChatGPT's in-app browser](https://learn.chatgpt.com/docs/webmcp), which supports WebMCP natively, or Chrome with `chrome://flags/#enable-webmcp-testing` enabled.)*

## Why WebMCP

DevSmith already has a lot of structure an agent can use productively: named
projects, roadmaps with milestones and tasks, and an AI assistant scoped to
project context. Before WebMCP, an agent could only drive DevSmith by
clicking through the UI blind — guessing at selectors, unable to tell a
"Planning" project from an "In Progress" one without a screenshot.

With WebMCP, DevSmith exposes its real actions directly:

```js
document.modelContext.registerTool({
  name: "generate_roadmap",
  description:
    "Generate an AI roadmap (milestones and tasks) for a project.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      model: { type: "string" },
    },
    required: ["projectId"],
  },
  execute: async (input) => {
    const res = await fetch(`/api/projects/${input.projectId}/roadmap/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: input.model ?? "default" }),
    });
    return res.json();
  },
});
```

This means a person can say *"create a project for a habit tracker API and
plan it out"* to their agent, and the agent calls `create_project` then
`generate_roadmap` directly — no clicking, no guessing at the DOM, no risk
of the agent misreading a status badge.

Tools registered: `list_projects`, `create_project`, `get_project`,
`generate_roadmap`, `get_roadmap`, `create_task`, `update_task`,
`ask_devsmith_assistant`. See [`src/webmcpTools.ts`](./src/webmcpTools.ts)
for the full definitions.

## Architecture

- **Frontend:** React + TypeScript + Vite, Tailwind for styling
- **Backend:** Express + TypeScript, SQLite (`better-sqlite3`) for storage
- **AI:** [Ollama](https://ollama.com) locally by default; falls back to a
  hosted model for the live demo deployment (see `server/ai/llmProvider.ts`)
  so judges can try it without installing anything

## Running locally (recommended — fully local, no API keys)

**Requirements:** Node 18+, [Ollama](https://ollama.com) installed with at
least one model pulled (e.g. `ollama pull llama3.2`).

```bash
# 1. Start Ollama
ollama serve

# 2. Backend
cd server
npm install
npm run dev          # runs on http://localhost:3001

# 3. Frontend (new terminal)
cd client
npm install
npm run dev           # runs on http://localhost:5173
```

Open `http://localhost:5173`. The app will detect your installed Ollama
models automatically under Settings.

## Running the live-demo configuration (cloud fallback)

Set these environment variables on your backend deployment instead of
running Ollama:

```
CLOUD_LLM_API_KEY=sk-...
CLOUD_LLM_BASE_URL=https://api.openai.com/v1   # optional, this is the default
CLOUD_LLM_MODEL=gpt-4o-mini                     # optional
```

Set `VITE_API_URL` on the frontend deployment to point at the deployed
backend URL.

## License

MIT — see [LICENSE](./LICENSE).
