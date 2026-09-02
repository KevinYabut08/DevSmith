# DevSmith

> **Turn an idea into a development roadmap — then let AI help you build it.**

DevSmith is a **local-first AI development workspace** that helps developers turn project ideas into actionable development plans and then work through those plans with an in-context AI assistant.

Create a project, generate an AI-powered roadmap of milestones and tasks, and use the assistant to **ask questions, generate code, explain code, and fix bugs** — all while keeping your development workflow organized.

When running locally with **Ollama**, your code and prompts stay on your machine.

## Demo

**Live demo:** https://dev-smith-navy.vercel.app/

The live deployment includes a hosted LLM fallback so judges can try DevSmith without installing Ollama.

> **WebMCP:** For the full agent experience, use ChatGPT's in-app browser with WebMCP support, or a browser with WebMCP testing enabled.

---

## Why DevSmith?

Building software often means jumping between multiple tools:

* AI chat for planning
* A task manager for organization
* A code editor for implementation
* Documentation for understanding APIs
* Another AI tool for debugging

DevSmith brings the **planning and AI development workflow into one workspace**.

Instead of asking an AI to simply generate code, DevSmith gives the AI structured context about the project:

```text
Project
 ├── Roadmap
 │    ├── Milestone
 │    │    ├── Task
 │    │    └── Task
 │    └── Milestone
 │
 └── AI Assistant
       ├── Ask
       ├── Generate
       ├── Explain
       └── Fix
```

This gives an agent meaningful project context instead of forcing it to guess what is happening from the UI.

---

# Why WebMCP?

DevSmith was designed with structured project data and actions that an AI agent can use productively.

Without WebMCP, an agent interacting with DevSmith would need to navigate the UI like a human:

* Find the correct project
* Read status badges
* Locate buttons
* Open menus
* Determine which task belongs to which milestone
* Guess which UI element performs an action

This is fragile and inefficient.

With **WebMCP**, DevSmith exposes its actual capabilities directly as structured tools.

Instead of an agent clicking through the interface, it can interact with DevSmith's underlying functionality directly.

For example, a person could tell their agent:

> **"Create a project for a habit tracker API and plan it out."**

The agent can then:

```text
create_project
      ↓
generate_roadmap
      ↓
create_task
      ↓
update_task
```

No DOM guessing.
No screenshot interpretation.
No manually searching for buttons.

The agent works with **structured project data and actions**.

---

## Example WebMCP Tool

DevSmith exposes tools using WebMCP's `document.modelContext` API.

For example:

```js
document.modelContext.registerTool({
  name: "generate_roadmap",

  description:
    "Generate an AI roadmap (milestones and tasks) for a project.",

  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
      },
      model: {
        type: "string",
      },
    },
    required: ["projectId"],
  },

  execute: async (input) => {
    const res = await fetch(
      `/api/projects/${input.projectId}/roadmap/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model ?? "default",
        }),
      }
    );

    return res.json();
  },
});
```

The important part is that the agent isn't interacting with a button called `"Generate Roadmap"`.

It is calling the actual capability:

```text
generate_roadmap
```

with structured input.

---

# WebMCP Tools

DevSmith currently exposes the following tools:

| Tool                     | Purpose                                |
| ------------------------ | -------------------------------------- |
| `list_projects`          | Retrieve available projects            |
| `create_project`         | Create a new development project       |
| `get_project`            | Retrieve project information           |
| `generate_roadmap`       | Generate milestones and tasks using AI |
| `get_roadmap`            | Retrieve a project's roadmap           |
| `create_task`            | Create a development task              |
| `update_task`            | Update task information or status      |
| `ask_devsmith_assistant` | Ask the AI assistant about the project |

Full tool definitions are available in:

[`src/webmcpTools.ts`](./src/webmcpTools.ts)

---

# What WebMCP Enables

WebMCP turns DevSmith from a development workspace that an agent can **look at** into one that an agent can **operate**.

For example:

### Human

> Create a project for a habit tracker API and plan the implementation.

### Agent

```text
1. create_project
   ↓
2. generate_roadmap
   ↓
3. get_roadmap
   ↓
4. create_task
```

Another example:

### Human

> What should I work on next in my current project?

The agent can:

```text
list_projects
      ↓
get_project
      ↓
get_roadmap
      ↓
ask_devsmith_assistant
```

The agent can reason using actual project context rather than relying on screenshots or assumptions.

---

# Features

### 🤖 AI Development Assistant

Use an in-context AI assistant to:

* Ask development questions
* Generate code
* Explain existing code
* Fix bugs
* Get project-specific guidance

### 🗺️ AI-Generated Roadmaps

Turn a project idea into an actionable development plan with:

* Milestones
* Tasks
* Development steps
* Project-specific context

### 📋 Project Management

Keep development work organized through:

* Projects
* Milestones
* Tasks
* Task status
* Project context

### 🔌 WebMCP Integration

Expose DevSmith's core capabilities directly to AI agents through structured WebMCP tools.

### 🏠 Local-First AI

Use locally running Ollama models for development assistance.

Your prompts and code can remain on your machine when using the local configuration.

### ☁️ Cloud Demo

The deployed demo supports a hosted LLM fallback so users and judges can experience DevSmith without installing Ollama.

---

# Architecture

```text
                     ┌──────────────────────┐
                     │       AI Agent       │
                     └──────────┬───────────┘
                                │
                             WebMCP
                                │
                                ▼
┌────────────────────────────────────────────────────┐
│                     DevSmith                       │
│                                                    │
│  ┌──────────────┐      ┌────────────────────────┐ │
│  │   Projects   │      │    WebMCP Tools        │ │
│  └──────┬───────┘      │                        │ │
│         │              │ list_projects          │ │
│         ▼              │ create_project         │ │
│  ┌──────────────┐      │ get_project            │ │
│  │   Roadmaps   │      │ generate_roadmap        │ │
│  └──────┬───────┘      │ get_roadmap             │ │
│         │              │ create_task             │ │
│         ▼              │ update_task             │ │
│  ┌──────────────┐      │ ask_assistant           │ │
│  │    Tasks     │      └────────────────────────┘ │
│  └──────────────┘                                 │
│                                                    │
└───────────────────────┬────────────────────────────┘
                        │
                        ▼
                ┌───────────────┐
                │  LLM Provider │
                └───────┬───────┘
                        │
              ┌─────────┴─────────┐
              │                   │
              ▼                   ▼
        ┌───────────┐       ┌────────────┐
        │  Ollama   │       │ Cloud LLM  │
        │  Local    │       │  Fallback  │
        └───────────┘       └────────────┘
```

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS

### Backend

* Node.js
* Express
* TypeScript
* SQLite
* `better-sqlite3`

### AI

* Ollama
* Local LLM models
* Optional hosted LLM fallback for the live demo

### Agent Integration

* WebMCP
* `document.modelContext.registerTool`

---

# Running Locally

The recommended setup uses Ollama so the AI functionality can run locally.

## Requirements

* Node.js 18+
* Ollama
* At least one Ollama model

For example:

```bash
ollama pull llama3.2
```

## 1. Start Ollama

```bash
ollama serve
```

## 2. Start the backend

Open a terminal:

```bash
cd server
npm install
npm run dev
```

The backend runs on:

```text
http://localhost:3001
```

## 3. Start the frontend

Open another terminal:

```bash
cd client
npm install
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```

Open:

```text
http://localhost:5173
```

DevSmith will detect your available Ollama models through the application settings.

---

# Live Demo Configuration

The deployed version can use a hosted LLM instead of a local Ollama instance.

Configure the backend with:

```env
CLOUD_LLM_API_KEY=sk-...
CLOUD_LLM_BASE_URL=https://api.openai.com/v1
CLOUD_LLM_MODEL=gpt-4o-mini
```

`CLOUD_LLM_BASE_URL` and `CLOUD_LLM_MODEL` are optional if the defaults are appropriate.

For the frontend deployment, configure:

```env
VITE_API_URL=https://your-deployed-backend-url
```

The local configuration continues to use Ollama, while the deployed configuration can use the hosted provider.

---

# Local-First by Design

DevSmith is designed around a simple principle:

> **Your development environment should be useful without requiring your code and prompts to be sent to a third-party AI service.**

When running DevSmith locally with Ollama:

```text
Your Computer
│
├── DevSmith
│   ├── Frontend
│   ├── Backend
│   ├── SQLite database
│   └── AI Assistant
│
└── Ollama
    └── Local LLM
```

Your AI interaction can remain entirely local.

The cloud LLM configuration exists primarily to make the hosted demo accessible to users who don't have Ollama installed.

---

# Project Structure

```text
DevSmith/
│
├── client/
│   └── ...
│
├── server/
│   ├── ai/
│   │   └── llmProvider.ts
│   └── ...
│
├── src/
│   └── webmcpTools.ts
│
├── README.md
├── LICENSE
└── ...
```

---

# WebMCP + DevSmith

The goal of the WebMCP integration isn't simply to add another AI feature.

It's to make DevSmith's existing development workflow **machine-operable**.

A traditional application exposes:

```text
UI → Human → Application
```

DevSmith with WebMCP enables:

```text
Human
  ↓
AI Agent
  ↓
WebMCP
  ↓
DevSmith
  ↓
Projects / Roadmaps / Tasks / AI Assistant
```

This allows an agent to participate directly in the development workflow while still leaving the developer in control.

---

# Future Ideas

Some directions for DevSmith include:

* More WebMCP tools
* Agent-driven task execution
* GitHub repository integration
* Codebase-aware AI assistance
* Automated task completion
* Pull request generation
* Git integration
* Local code indexing
* More local AI models
* Multi-agent development workflows

---

# License

DevSmith is open-source software licensed under the MIT License.

See the [`LICENSE`](./LICENSE) file for the full license text.

---

# Built With

Built with **React, TypeScript, Express, SQLite, Ollama, and WebMCP**.

**DevSmith — from idea → roadmap → code.**
