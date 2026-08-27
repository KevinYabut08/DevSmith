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
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch projects",
    });
  }
});

/**
 * Create project
 */
app.post("/api/projects", (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        error: "Project title is required",
      });
    }

    const project = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description?.trim() ?? "",
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
    console.error(error);

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
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to delete project",
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 DevSmith API running on http://localhost:${PORT}`);
});