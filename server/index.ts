import express from "express";
import cors from "cors";
import db from "./db";

const app = express();

const PORT = 3001;

app.use(cors());
app.use(express.json());

/**
 * Health check
 */
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "DevSmith API is running",
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
      id: crypto.randomUUID(),
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

    res.json({
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
  (req, res) => {
    try {
      const { projectId } = req.params;

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
      const milestones = [
        {
          title: "Foundation",
          description:
            "Set up the project and establish the core architecture.",
          tasks: [
            "Initialize the project",
            "Define application architecture",
            "Set up the development environment",
          ],
        },
        {
          title: "Core Features",
          description:
            "Build the primary functionality of the application.",
          tasks: [
            "Implement core data models",
            "Build the main user workflow",
            "Add validation and error handling",
          ],
        },
        {
          title: "Polish & Launch",
          description:
            "Prepare the application for testing and production.",
          tasks: [
            "Improve UI and accessibility",
            "Add loading and error states",
            "Test and prepare the production build",
          ],
        },
      ];

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
          const milestoneId = crypto.randomUUID();

          insertMilestone.run({
            id: milestoneId,
            projectId,
            title: milestone.title,
            description: milestone.description,
            order: index + 1,
          });

          milestone.tasks.forEach((taskTitle) => {
            insertTask.run({
              id: crypto.randomUUID(),
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
        error: "Failed to generate roadmap",
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(
    `🚀 DevSmith API running on http://localhost:${PORT}`
  );
});