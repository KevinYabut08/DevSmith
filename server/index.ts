import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import db from "./db";
import {
  generateRoadmap,
} from "./ai/roadmapGenerator";
import {
  askTaskAssistant,
} from "./ai/taskAssistant";
import {
  runProjectAssistant,
  type AssistantMode,
} from "./ai/projectAssistant";
import {
  getOllamaModels,
  isOllamaRunning,
} from "./ai/ollama";

const app = express();

// Reads from env so you can override without touching code, same as the
// frontend's VITE_API_URL.
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());

const ASSISTANT_MODES: AssistantMode[] = [
  "ask",
  "generate",
  "explain",
  "fix",
];

interface AssistantChatTurn {
  role: "user" | "assistant";
  content: string;
}

function getProjectOrNull(projectId: string) {
  return db
    .prepare(
      `
      SELECT
        id,
        title,
        description
      FROM projects
      WHERE id = ?
      `
    )
    .get(projectId) as
    | {
        id: string;
        title: string;
        description: string;
      }
    | undefined;
}

/**
 * Health check
 */
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "DevSmith API is running",
    features: {
      assistant: true,
      roadmapEditing: true,
      persistedChat: true,
    },
  });
});

/**
 * Get all projects
 */
app.get("/api/projects", (_req, res) => {
  try {
    const projects = db
      .prepare(
        `
        SELECT
          id,
          title,
          description,
          status,
          created_at AS createdAt
        FROM projects
        ORDER BY created_at DESC
        `
      )
      .all();

    res.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);

    res.status(500).json({
      error: "Failed to fetch projects",
    });
  }
});

/**
 * Get single project
 */
app.get("/api/projects/:id", (req, res) => {
  try {
    const project = db
      .prepare(
        `
        SELECT
          id,
          title,
          description,
          status,
          created_at AS createdAt
        FROM projects
        WHERE id = ?
        `
      )
      .get(req.params.id);

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    res.json(project);
  } catch (error) {
    console.error("Failed to fetch project:", error);

    res.status(500).json({
      error: "Failed to fetch project",
    });
  }
});

/**
 * Create project
 */
app.post("/api/projects", (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: "Project title is required",
      });
    }

    const project = {
      id: randomUUID(),
      title: title.trim(),
      description:
        typeof description === "string"
          ? description.trim()
          : "",
      status: "Planning",
      createdAt: new Date().toISOString(),
    };

    db.prepare(
      `
      INSERT INTO projects (
        id,
        title,
        description,
        status,
        created_at
      )
      VALUES (
        @id,
        @title,
        @description,
        @status,
        @createdAt
      )
      `
    ).run(project);

    res.status(201).json(project);
  } catch (error) {
    console.error("Failed to create project:", error);

    res.status(500).json({
      error: "Failed to create project",
    });
  }
});

/**
 * Delete project
 */
app.delete("/api/projects/:id", (req, res) => {
  try {
    const result = db
      .prepare(
        `
        DELETE FROM projects
        WHERE id = ?
        `
      )
      .run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    res.json({
      success: true,
      message: "Project deleted",
    });
  } catch (error) {
    console.error("Failed to delete project:", error);

    res.status(500).json({
      error: "Failed to delete project",
    });
  }
});

/**
 * Get project roadmap
 */
app.get("/api/projects/:projectId/roadmap", (req, res) => {
  try {
    const { projectId } = req.params;

    // Make sure project exists
    const project = db
      .prepare(
        `
        SELECT id
        FROM projects
        WHERE id = ?
        `
      )
      .get(projectId);

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const milestones = db
      .prepare(
        `
        SELECT
          id,
          title,
          description,
          milestone_order AS milestoneOrder
        FROM milestones
        WHERE project_id = ?
        ORDER BY milestone_order ASC
        `
      )
      .all(projectId) as {
        id: string;
        title: string;
        description: string;
        milestoneOrder: number;
      }[];

    const tasks = db
      .prepare(
        `
        SELECT
          id,
          milestone_id AS milestoneId,
          title,
          description,
          completed
        FROM tasks
        WHERE milestone_id IN (
          SELECT id
          FROM milestones
          WHERE project_id = ?
        )
        ORDER BY rowid ASC
        `
      )
      .all(projectId) as {
        id: string;
        milestoneId: string;
        title: string;
        description: string;
        completed: number;
      }[];

    const roadmap = milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      description: milestone.description,
      order: milestone.milestoneOrder,
      tasks: tasks
        .filter(
          (task) =>
            task.milestoneId === milestone.id
        )
        .map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          completed: Boolean(task.completed),
        })),
    }));

    // Included as top-level `id` so this matches the frontend's Roadmap type
    // (id, projectId, milestones). There's no separate roadmaps table, so
    // projectId doubles as the roadmap id — one roadmap per project.
    res.json({
      id: projectId,
      projectId,
      milestones: roadmap,
    });
  } catch (error) {
    console.error("Failed to fetch roadmap:", error);

    res.status(500).json({
      error: "Failed to fetch roadmap",
    });
  }
});

/**
 * Generate project roadmap
 *
 * For now this creates a starter roadmap.
 * Later we will replace this with AI generation.
 */
app.post(
  "/api/projects/:projectId/roadmap/generate",
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { model } = req.body;

        if (!model || typeof model !== "string") {
        return res.status(400).json({
            error: "Ollama model is required",
        });
        }

      // Check project
      const project = db
        .prepare(
          `
          SELECT
            id,
            title,
            description
          FROM projects
          WHERE id = ?
          `
        )
        .get(projectId) as
        | {
            id: string;
            title: string;
            description: string;
          }
        | undefined;

      if (!project) {
        return res.status(404).json({
          error: "Project not found",
        });
      }

      // Prevent duplicate roadmap generation
      const existing = db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM milestones
          WHERE project_id = ?
          `
        )
        .get(projectId) as {
        count: number;
      };

      if (existing.count > 0) {
        return res.status(409).json({
          error: "Roadmap already exists",
        });
      }

      /**
       * Temporary roadmap.
       *
       * Later:
       *
       * User idea
       *      ↓
       * AI
       *      ↓
       * Structured roadmap
       */
      const aiRoadmap = await generateRoadmap(
        project.title,
        project.description,
        model
        );

        const milestones = aiRoadmap.milestones;

      const insertMilestone = db.prepare(`
        INSERT INTO milestones (
          id,
          project_id,
          title,
          description,
          milestone_order
        )
        VALUES (
          @id,
          @projectId,
          @title,
          @description,
          @order
        )
      `);

      const insertTask = db.prepare(`
        INSERT INTO tasks (
          id,
          milestone_id,
          title,
          description,
          completed
        )
        VALUES (
          @id,
          @milestoneId,
          @title,
          @description,
          0
        )
      `);

      const transaction = db.transaction(() => {
        milestones.forEach((milestone, index) => {
          const milestoneId = randomUUID();

          insertMilestone.run({
            id: milestoneId,
            projectId,
            title: milestone.title,
            description: milestone.description,
            order: index + 1,
          });

          milestone.tasks.forEach((taskTitle) => {
            insertTask.run({
              id: randomUUID(),
              milestoneId,
              title: taskTitle,
              description: "",
            });
          });
        });
      });

      transaction();

      res.status(201).json({
        success: true,
        message: "Roadmap generated",
        projectId,
      });
    } catch (error) {
      console.error(
        "Failed to generate roadmap:",
        error
      );

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate roadmap",
      });
    }
  }
);

/**
 * Toggle task completion.
 *
 * This is the route the frontend actually calls:
 * PATCH /api/projects/:projectId/roadmap/tasks/:taskId
 *
 * (Previously this only existed as `PUT /api/tasks/:id` — a different
 * method AND a different path — so every checkbox click from
 * ProjectWorkspace was silently 404ing.)
 */
app.patch(
  "/api/projects/:projectId/roadmap/tasks/:taskId",
  (req: Request, res: Response) => {
    try {
      const { projectId, taskId } = req.params;
      const { completed, title, description } = req.body;

      const task = db
        .prepare(
          `
          SELECT tasks.id
          FROM tasks
          JOIN milestones ON milestones.id = tasks.milestone_id
          WHERE tasks.id = ? AND milestones.project_id = ?
          `
        )
        .get(taskId, projectId);

      if (!task) {
        return res.status(404).json({
          error: "Task not found",
        });
      }

      const updates: string[] = [];
      const values: unknown[] = [];

      if (typeof completed === "boolean") {
        updates.push("completed = ?");
        values.push(completed ? 1 : 0);
      }

      if (typeof title === "string" && title.trim()) {
        updates.push("title = ?");
        values.push(title.trim());
      }

      if (typeof description === "string") {
        updates.push("description = ?");
        values.push(description.trim());
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error:
            "Provide completed, title, or description to update",
        });
      }

      values.push(taskId);

      db.prepare(
        `
        UPDATE tasks
        SET ${updates.join(", ")}
        WHERE id = ?
        `
      ).run(...values);

      const updated = db
        .prepare(
          `
          SELECT
            id,
            milestone_id AS milestoneId,
            title,
            description,
            completed
          FROM tasks
          WHERE id = ?
          `
        )
        .get(taskId) as {
          id: string;
          milestoneId: string;
          title: string;
          description: string;
          completed: number;
        };

      res.json({
        id: updated.id,
        milestoneId: updated.milestoneId,
        title: updated.title,
        description: updated.description,
        completed: Boolean(updated.completed),
      });
    } catch (error) {
      console.error("Failed to update task:", error);

      res.status(500).json({
        error: "Failed to update task",
      });
    }
  }
);

/**
 * Add a task to a milestone
 */
app.post(
  "/api/projects/:projectId/roadmap/milestones/:milestoneId/tasks",
  (req, res) => {
    try {
      const { projectId, milestoneId } = req.params;
      const { title, description } = req.body;

      if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          error: "Task title is required",
        });
      }

      const milestone = db
        .prepare(
          `
          SELECT id
          FROM milestones
          WHERE id = ? AND project_id = ?
          `
        )
        .get(milestoneId, projectId);

      if (!milestone) {
        return res.status(404).json({
          error: "Milestone not found",
        });
      }

      const task = {
        id: randomUUID(),
        milestoneId,
        title: title.trim(),
        description:
          typeof description === "string"
            ? description.trim()
            : "",
        completed: false,
      };

      db.prepare(
        `
        INSERT INTO tasks (
          id,
          milestone_id,
          title,
          description,
          completed
        )
        VALUES (
          @id,
          @milestoneId,
          @title,
          @description,
          0
        )
        `
      ).run(task);

      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create task:", error);

      res.status(500).json({
        error: "Failed to create task",
      });
    }
  }
);

/**
 * Delete a task
 */
app.delete(
  "/api/projects/:projectId/roadmap/tasks/:taskId",
  (req, res) => {
    try {
      const { projectId, taskId } = req.params;

      const task = db
        .prepare(
          `
          SELECT tasks.id
          FROM tasks
          JOIN milestones ON milestones.id = tasks.milestone_id
          WHERE tasks.id = ? AND milestones.project_id = ?
          `
        )
        .get(taskId, projectId);

      if (!task) {
        return res.status(404).json({
          error: "Task not found",
        });
      }

      db.prepare(
        `
        DELETE FROM tasks
        WHERE id = ?
        `
      ).run(taskId);

      res.json({
        success: true,
        message: "Task deleted",
      });
    } catch (error) {
      console.error("Failed to delete task:", error);

      res.status(500).json({
        error: "Failed to delete task",
      });
    }
  }
);

/**
 * Update a milestone
 */
app.patch(
  "/api/projects/:projectId/roadmap/milestones/:milestoneId",
  (req, res) => {
    try {
      const { projectId, milestoneId } = req.params;
      const { title, description } = req.body;

      const milestone = db
        .prepare(
          `
          SELECT id
          FROM milestones
          WHERE id = ? AND project_id = ?
          `
        )
        .get(milestoneId, projectId);

      if (!milestone) {
        return res.status(404).json({
          error: "Milestone not found",
        });
      }

      const updates: string[] = [];
      const values: unknown[] = [];

      if (typeof title === "string" && title.trim()) {
        updates.push("title = ?");
        values.push(title.trim());
      }

      if (typeof description === "string") {
        updates.push("description = ?");
        values.push(description.trim());
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: "Provide title or description to update",
        });
      }

      values.push(milestoneId);

      db.prepare(
        `
        UPDATE milestones
        SET ${updates.join(", ")}
        WHERE id = ?
        `
      ).run(...values);

      const updated = db
        .prepare(
          `
          SELECT
            id,
            title,
            description,
            milestone_order AS milestoneOrder
          FROM milestones
          WHERE id = ?
          `
        )
        .get(milestoneId) as {
          id: string;
          title: string;
          description: string;
          milestoneOrder: number;
        };

      res.json({
        id: updated.id,
        title: updated.title,
        description: updated.description,
        order: updated.milestoneOrder,
      });
    } catch (error) {
      console.error("Failed to update milestone:", error);

      res.status(500).json({
        error: "Failed to update milestone",
      });
    }
  }
);

/**
 * Add a milestone
 */
app.post(
  "/api/projects/:projectId/roadmap/milestones",
  (req, res) => {
    try {
      const { projectId } = req.params;
      const { title, description } = req.body;

      if (!getProjectOrNull(projectId)) {
        return res.status(404).json({
          error: "Project not found",
        });
      }

      if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          error: "Milestone title is required",
        });
      }

      const maxOrder = db
        .prepare(
          `
          SELECT COALESCE(MAX(milestone_order), 0) AS maxOrder
          FROM milestones
          WHERE project_id = ?
          `
        )
        .get(projectId) as {
        maxOrder: number;
      };

      const milestone = {
        id: randomUUID(),
        projectId,
        title: title.trim(),
        description:
          typeof description === "string"
            ? description.trim()
            : "",
        order: maxOrder.maxOrder + 1,
      };

      db.prepare(
        `
        INSERT INTO milestones (
          id,
          project_id,
          title,
          description,
          milestone_order
        )
        VALUES (
          @id,
          @projectId,
          @title,
          @description,
          @order
        )
        `
      ).run(milestone);

      res.status(201).json({
        ...milestone,
        tasks: [],
      });
    } catch (error) {
      console.error("Failed to create milestone:", error);

      res.status(500).json({
        error: "Failed to create milestone",
      });
    }
  }
);

/**
 * Delete a milestone
 */
app.delete(
  "/api/projects/:projectId/roadmap/milestones/:milestoneId",
  (req, res) => {
    try {
      const { projectId, milestoneId } = req.params;

      const milestone = db
        .prepare(
          `
          SELECT id
          FROM milestones
          WHERE id = ? AND project_id = ?
          `
        )
        .get(milestoneId, projectId);

      if (!milestone) {
        return res.status(404).json({
          error: "Milestone not found",
        });
      }

      db.prepare(
        `
        DELETE FROM milestones
        WHERE id = ?
        `
      ).run(milestoneId);

      res.json({
        success: true,
        message: "Milestone deleted",
      });
    } catch (error) {
      console.error("Failed to delete milestone:", error);

      res.status(500).json({
        error: "Failed to delete milestone",
      });
    }
  }
);

/**
 * Get persisted assistant messages for a project
 */
app.get(
  "/api/projects/:projectId/assistant/messages",
  (req, res) => {
    try {
      const { projectId } = req.params;

      if (!getProjectOrNull(projectId)) {
        return res.status(404).json({
          error: "Project not found",
        });
      }

      const messages = db
        .prepare(
          `
          SELECT
            id,
            role,
            mode,
            content,
            code,
            task_id AS taskId,
            created_at AS createdAt
          FROM assistant_messages
          WHERE project_id = ?
          ORDER BY created_at ASC
          `
        )
        .all(projectId);

      res.json(messages);
    } catch (error) {
      console.error(
        "Failed to fetch assistant messages:",
        error
      );

      res.status(500).json({
        error: "Failed to fetch assistant messages",
      });
    }
  }
);

/**
 * Clear assistant conversation for a project
 */
app.delete(
  "/api/projects/:projectId/assistant/messages",
  (req, res) => {
    try {
      const { projectId } = req.params;

      if (!getProjectOrNull(projectId)) {
        return res.status(404).json({
          error: "Project not found",
        });
      }

      db.prepare(
        `
        DELETE FROM assistant_messages
        WHERE project_id = ?
        `
      ).run(projectId);

      res.json({
        success: true,
        message: "Conversation cleared",
      });
    } catch (error) {
      console.error(
        "Failed to clear assistant messages:",
        error
      );

      res.status(500).json({
        error: "Failed to clear conversation",
      });
    }
  }
);

/**
 * Project AI Assistant — ask, generate, explain, fix (persisted)
 */
app.post(
  "/api/projects/:projectId/assistant",
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { model, mode, message, code, taskId } =
        req.body;

      if (!model || typeof model !== "string") {
        return res.status(400).json({
          error: "Ollama model is required",
        });
      }

      if (
        !mode ||
        typeof mode !== "string" ||
        !ASSISTANT_MODES.includes(mode as AssistantMode)
      ) {
        return res.status(400).json({
          error:
            "Mode must be one of: ask, generate, explain, fix",
        });
      }

      if (typeof message !== "string") {
        return res.status(400).json({
          error: "Message must be a string",
        });
      }

      const project = getProjectOrNull(projectId);

      if (!project) {
        return res.status(404).json({
          error: "Project not found",
        });
      }

      let taskContext:
        | {
            id: string;
            title: string;
            description: string;
            milestoneTitle: string;
          }
        | undefined;

      if (taskId && typeof taskId === "string") {
        const task = db
          .prepare(
            `
            SELECT
              tasks.id,
              tasks.title,
              tasks.description,
              milestones.title AS milestoneTitle
            FROM tasks
            JOIN milestones
              ON milestones.id = tasks.milestone_id
            WHERE
              tasks.id = ?
              AND milestones.project_id = ?
            `
          )
          .get(taskId, projectId) as
          | {
              id: string;
              title: string;
              description: string;
              milestoneTitle: string;
            }
          | undefined;

        if (!task) {
          return res.status(404).json({
            error: "Task not found",
          });
        }

        taskContext = task;
      }

      const storedMessages = db
        .prepare(
          `
          SELECT role, content
          FROM assistant_messages
          WHERE project_id = ?
          ORDER BY created_at ASC
          `
        )
        .all(projectId) as AssistantChatTurn[];

      const answer = await runProjectAssistant(
        mode as AssistantMode,
        project,
        message,
        model,
        typeof code === "string" ? code : undefined,
        storedMessages,
        taskContext
      );

      const now = new Date().toISOString();
      const userMessageId = randomUUID();
      const assistantMessageId = randomUUID();

      const insertMessage = db.prepare(`
        INSERT INTO assistant_messages (
          id,
          project_id,
          role,
          mode,
          content,
          code,
          task_id,
          created_at
        )
        VALUES (
          @id,
          @projectId,
          @role,
          @mode,
          @content,
          @code,
          @taskId,
          @createdAt
        )
      `);

      const transaction = db.transaction(() => {
        insertMessage.run({
          id: userMessageId,
          projectId,
          role: "user",
          mode,
          content: message,
          code: typeof code === "string" ? code : "",
          taskId: taskContext?.id ?? null,
          createdAt: now,
        });

        insertMessage.run({
          id: assistantMessageId,
          projectId,
          role: "assistant",
          mode,
          content: answer,
          code: "",
          taskId: taskContext?.id ?? null,
          createdAt: new Date().toISOString(),
        });
      });

      transaction();

      res.json({
        projectId,
        mode,
        answer,
        messages: [
          {
            id: userMessageId,
            role: "user",
            mode,
            content: message,
            code: typeof code === "string" ? code : undefined,
            taskId: taskContext?.id,
            createdAt: now,
          },
          {
            id: assistantMessageId,
            role: "assistant",
            mode,
            content: answer,
            createdAt: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      console.error(
        "Failed to run project assistant:",
        error
      );

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to get AI response",
      });
    }
  }
);

/**
 * Ask DevSmith AI for help with a task
 */
app.post(
  "/api/projects/:projectId/roadmap/tasks/:taskId/ask",
  async (req, res) => {
    try {
      const { projectId, taskId } = req.params;
      const { model } = req.body;

      if (!model || typeof model !== "string") {
        return res.status(400).json({
          error: "Ollama model is required",
        });
      }

      // Find task and make sure it belongs to this project
      const task = db
        .prepare(
          `
          SELECT
            tasks.id,
            tasks.title,
            tasks.description,
            milestones.title AS milestone_title
          FROM tasks
          JOIN milestones
            ON milestones.id = tasks.milestone_id
          WHERE
            tasks.id = ?
            AND milestones.project_id = ?
          `
        )
        .get(taskId, projectId) as
        | {
            id: string;
            title: string;
            description: string;
            milestone_title: string;
          }
        | undefined;

      if (!task) {
        return res.status(404).json({
          error: "Task not found",
        });
      }

      // Find project
      const project = db
        .prepare(
          `
          SELECT
            title,
            description
          FROM projects
          WHERE id = ?
          `
        )
        .get(projectId) as
        | {
            title: string;
            description: string;
          }
        | undefined;

      if (!project) {
        return res.status(404).json({
          error: "Project not found",
        });
      }

      const answer = await askTaskAssistant(
        project.title,
        project.description,
        task.title,
        task.description,
        model
      );

      res.json({
        taskId,
        projectId,
        answer,
      });
    } catch (error) {
      console.error(
        "Failed to ask DevSmith AI:",
        error
      );

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to get AI response",
      });
    }
  }
);

/**
 * Get Ollama status and installed models
 */
app.get("/api/ai/models", async (_req, res) => {
  try {
    const connected = await isOllamaRunning();

    if (!connected) {
      return res.json({
        connected: false,
        models: [],
      });
    }

    const models = await getOllamaModels();

    res.json({
      connected: true,
      models,
    });
  } catch (error) {
    console.error("Failed to fetch Ollama models:", error);

    res.status(500).json({
      connected: false,
      models: [],
      error: "Failed to connect to Ollama",
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `🚀 DevSmith API running on http://localhost:${PORT}`
  );
});