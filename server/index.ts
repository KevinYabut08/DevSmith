import "dotenv/config";

import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";

import db from "./db";

import { generateRoadmap } from "./ai/roadmapGenerator";
import { askTaskAssistant } from "./ai/taskAssistant";

import {
  runProjectAssistant,
  type AssistantMode,
  type ChatTurn,
  type TaskContext,
} from "./ai/projectAssistant";

import {
  getOllamaModels,
  isOllamaRunning,
} from "./ai/ollama";

import { generateCode } from "./ai/codingAgent";

import {
  indexProjectFiles,
  type IndexedFile,
} from "./ai/fileIndexer";

const app = express();

const PORT = Number(process.env.PORT) || 3001;

const OLLAMA_URL =
  process.env.OLLAMA_URL ||
  "http://127.0.0.1:11434";

const ASSISTANT_MODES: AssistantMode[] = [
  "ask",
  "generate",
  "explain",
  "fix",
];

/*
|--------------------------------------------------------------------------
| Upload Configuration
|--------------------------------------------------------------------------
*/

const UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_DIR || "./uploads"
);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".cs",
  ".go",
  ".rs",
  ".php",
  ".rb",
  ".swift",
  ".kt",
  ".kts",
  ".html",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".md",
  ".txt",
  ".sql",
  ".sh",
  ".bash",
  ".env",
  ".gitignore",
  ".dockerfile",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: async (
      req,
      _file,
      callback
    ) => {
      try {
        const projectId =
          req.params.projectId;

        const projectDirectory =
          path.join(
            UPLOAD_ROOT,
            "projects",
            projectId
          );

        await fs.mkdir(
          projectDirectory,
          {
            recursive: true,
          }
        );

        callback(null, projectDirectory);
      } catch (error) {
        callback(
          error instanceof Error
            ? error
            : new Error(
                "Failed to create upload directory"
              ),
          ""
        );
      }
    },

    filename: (
      _req,
      file,
      callback
    ) => {
      const originalName =
        path.basename(file.originalname);

      const extension =
        path.extname(originalName);

      const baseName =
        path.basename(
          originalName,
          extension
        );

      const safeBaseName =
        baseName
          .replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          )
          .slice(0, 100);

      callback(
        null,
        `${safeBaseName}-${randomUUID()}${extension}`
      );
    },
  }),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 100,
  },

  fileFilter: (
    _req,
    file,
    callback
  ) => {
    const extension =
      path.extname(
        file.originalname
      ).toLowerCase();

    if (
      ALLOWED_EXTENSIONS.has(
        extension
      )
    ) {
      callback(null, true);
      return;
    }

    callback(
      new Error(
        `Unsupported file type: ${extension || "unknown"}`
      )
    );
  },
});

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "5mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "5mb",
  })
);

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

interface ProjectRow {
  id: string;
  title: string;
  description: string;
  status?: string;
  createdAt?: string;
}

interface ProjectParams {
  projectId: string;
}

interface IdParams {
  id: string;
}

interface TaskParams {
  projectId: string;
  taskId: string;
}

interface MilestoneParams {
  projectId: string;
  milestoneId: string;
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getProjectOrNull(
  projectId: string
): ProjectRow | undefined {
  return db
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
    .get(projectId) as
    | ProjectRow
    | undefined;
}

function isValidString(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function sendError(
  res: Response,
  status: number,
  error: unknown,
  fallback: string
) {
  return res.status(status).json({
    error:
      error instanceof Error
        ? error.message
        : fallback,
  });
}

function getProjectUploadDirectory(
  projectId: string
) {
  return path.join(
    UPLOAD_ROOT,
    "projects",
    projectId
  );
}

async function getUploadedProjectFiles(
  projectId: string
) {
  const directory =
    getProjectUploadDirectory(
      projectId
    );

  try {
    const entries =
      await fs.readdir(
        directory,
        {
          withFileTypes: true,
        }
      );

    return entries
      .filter(
        (entry) =>
          entry.isFile()
      )
      .map((entry) => ({
        name: entry.name,
        path: path.join(
          directory,
          entry.name
        ),
        extension:
          path
            .extname(entry.name)
            .toLowerCase(),
      }));
  } catch {
    return [];
  }
}

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

app.get(
  "/api/health",
  async (
    _req: Request,
    res: Response
  ) => {
    let ollamaConnected = false;

    try {
      ollamaConnected =
        await isOllamaRunning();
    } catch {
      ollamaConnected = false;
    }

    return res.json({
      success: true,
      message:
        "DevSmith API is running",

      server: {
        port: PORT,
      },

      ollama: {
        connected:
          ollamaConnected,
        url: OLLAMA_URL,
      },

      features: {
        assistant: true,
        roadmapGeneration: true,
        roadmapEditing: true,
        persistedChat: true,
        taskCodeGeneration: true,
        projectIndexing: true,
        fileUpload: true,
      },
    });
  }
);

/*
|--------------------------------------------------------------------------
| Projects
|--------------------------------------------------------------------------
*/

app.get(
  "/api/projects",
  (
    _req: Request,
    res: Response
  ) => {
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

      return res.json(projects);
    } catch (error) {
      console.error(
        "Failed to fetch projects:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to fetch projects"
      );
    }
  }
);

app.get(
  "/api/projects/:id",
  (
    req: Request<IdParams>,
    res: Response
  ) => {
    try {
      const project =
        getProjectOrNull(
          req.params.id
        );

      if (!project) {
        return res.status(404).json({
          error:
            "Project not found",
        });
      }

      return res.json(project);
    } catch (error) {
      console.error(
        "Failed to fetch project:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to fetch project"
      );
    }
  }
);

app.post(
  "/api/projects",
  (
    req: Request,
    res: Response
  ) => {
    try {
      const {
        title,
        description,
      } = req.body;

      if (!isValidString(title)) {
        return res.status(400).json({
          error:
            "Project title is required",
        });
      }

      const project = {
        id: randomUUID(),
        title: title.trim(),
        description:
          typeof description ===
          "string"
            ? description.trim()
            : "",
        status: "Planning",
        createdAt:
          new Date().toISOString(),
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

      return res
        .status(201)
        .json(project);
    } catch (error) {
      console.error(
        "Failed to create project:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to create project"
      );
    }
  }
);

app.delete(
  "/api/projects/:id",
  (
    req: Request<IdParams>,
    res: Response
  ) => {
    try {
      const projectId =
        req.params.id;

      const result = db
        .prepare(
          `
          DELETE FROM projects
          WHERE id = ?
          `
        )
        .run(projectId);

      if (result.changes === 0) {
        return res.status(404).json({
          error:
            "Project not found",
        });
      }

      /*
       * Remove uploaded files
       * belonging to this project.
       */
      fs.rm(
        getProjectUploadDirectory(
          projectId
        ),
        {
          recursive: true,
          force: true,
        }
      ).catch((error) => {
        console.warn(
          "Failed to remove project uploads:",
          error
        );
      });

      return res.json({
        success: true,
        message:
          "Project deleted",
      });
    } catch (error) {
      console.error(
        "Failed to delete project:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to delete project"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| File Upload
|--------------------------------------------------------------------------
*/

/*
 * Upload one or multiple files.
 *
 * Frontend:
 *
 * const formData = new FormData();
 *
 * files.forEach((file) => {
 *   formData.append("files", file);
 * });
 *
 * axios.post(
 *   `/api/projects/${projectId}/files`,
 *   formData
 * );
 */

app.post(
  "/api/projects/:projectId/files",
  (
    req: Request<ProjectParams>,
    res: Response,
    next: NextFunction
  ) => {
    upload.array("files", 100)(
      req,
      res,
      async (error) => {
        if (error) {
          console.error(
            "File upload failed:",
            error
          );

          if (
            error instanceof multer.MulterError
          ) {
            if (
              error.code ===
              "LIMIT_FILE_SIZE"
            ) {
              return res
                .status(413)
                .json({
                  error:
                    "File is too large. Maximum size is 10 MB.",
                });
            }

            if (
              error.code ===
              "LIMIT_FILE_COUNT"
            ) {
              return res
                .status(413)
                .json({
                  error:
                    "Too many files. Maximum is 100 files.",
                });
            }
          }

          return sendError(
            res,
            400,
            error,
            "File upload failed"
          );
        }

        try {
          const {
            projectId,
          } = req.params;

          if (
            !getProjectOrNull(
              projectId
            )
          ) {
            return res
              .status(404)
              .json({
                error:
                  "Project not found",
              });
          }

          const files =
            (req.files as Express.Multer.File[]) ||
            [];

          if (
            files.length === 0
          ) {
            return res
              .status(400)
              .json({
                error:
                  "No files uploaded",
              });
          }

          const uploadDirectory =
            getProjectUploadDirectory(
              projectId
            );

          let indexedFiles:
            IndexedFile[] = [];

          try {
            indexedFiles =
              await indexProjectFiles(
                uploadDirectory
              );
          } catch (indexError) {
            console.warn(
              "Files uploaded but indexing failed:",
              indexError
            );
          }

          return res.status(201).json({
            success: true,
            projectId,

            files: files.map(
              (file) => ({
                name:
                  file.originalname,
                storedName:
                  file.filename,
                size:
                  file.size,
                type:
                  file.mimetype,
                extension:
                  path
                    .extname(
                      file.originalname
                    )
                    .toLowerCase(),
              })
            ),

            fileCount:
              files.length,

            indexedFileCount:
              indexedFiles.length,

            message:
              "Files uploaded successfully",
          });
        } catch (error) {
          console.error(
            "Failed to process uploaded files:",
            error
          );

          return sendError(
            res,
            500,
            error,
            "Failed to process uploaded files"
          );
        }
      }
    );
  }
);

/*
|--------------------------------------------------------------------------
| List Uploaded Files
|--------------------------------------------------------------------------
*/

app.get(
  "/api/projects/:projectId/files",
  async (
    req: Request<ProjectParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
      } = req.params;

      if (
        !getProjectOrNull(
          projectId
        )
      ) {
        return res
          .status(404)
          .json({
            error:
              "Project not found",
          });
      }

      const files =
        await getUploadedProjectFiles(
          projectId
        );

      return res.json({
        success: true,
        projectId,
        fileCount:
          files.length,

        files: files.map(
          (file) => ({
            name: file.name,
            extension:
              file.extension,
          })
        ),
      });
    } catch (error) {
      console.error(
        "Failed to list uploaded files:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to list uploaded files"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Delete Uploaded Files
|--------------------------------------------------------------------------
*/

app.delete(
  "/api/projects/:projectId/files",
  async (
    req: Request<ProjectParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
      } = req.params;

      if (
        !getProjectOrNull(
          projectId
        )
      ) {
        return res
          .status(404)
          .json({
            error:
              "Project not found",
          });
      }

      await fs.rm(
        getProjectUploadDirectory(
          projectId
        ),
        {
          recursive: true,
          force: true,
        }
      );

      return res.json({
        success: true,
        message:
          "Uploaded project files deleted",
      });
    } catch (error) {
      console.error(
        "Failed to delete uploaded files:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to delete uploaded files"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Roadmap
|--------------------------------------------------------------------------
*/

app.get(
  "/api/projects/:projectId/roadmap",
  (
    req: Request<ProjectParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
      } = req.params;

      if (
        !getProjectOrNull(
          projectId
        )
      ) {
        return res
          .status(404)
          .json({
            error:
              "Project not found",
          });
      }

      const milestones =
        db
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

      const tasks =
        db
          .prepare(
            `
            SELECT
              tasks.id,
              tasks.milestone_id AS milestoneId,
              tasks.title,
              tasks.description,
              tasks.completed
            FROM tasks
            JOIN milestones
              ON milestones.id =
                 tasks.milestone_id
            WHERE milestones.project_id = ?
            ORDER BY tasks.rowid ASC
            `
          )
          .all(projectId) as {
          id: string;
          milestoneId: string;
          title: string;
          description: string;
          completed: number;
        }[];

      const roadmap =
        milestones.map(
          (milestone) => ({
            id: milestone.id,
            title: milestone.title,
            description:
              milestone.description,
            order:
              milestone.milestoneOrder,

            tasks: tasks
              .filter(
                (task) =>
                  task.milestoneId ===
                  milestone.id
              )
              .map((task) => ({
                id: task.id,
                title: task.title,
                description:
                  task.description,
                completed:
                  Boolean(
                    task.completed
                  ),
              })),
          })
        );

      return res.json({
        id: projectId,
        projectId,
        milestones: roadmap,
      });
    } catch (error) {
      console.error(
        "Failed to fetch roadmap:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to fetch roadmap"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Generate Roadmap
|--------------------------------------------------------------------------
*/

app.post(
  "/api/projects/:projectId/roadmap/generate",
  async (
    req: Request<ProjectParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
      } = req.params;

      const { model } =
        req.body;

      if (!isValidString(model)) {
        return res
          .status(400)
          .json({
            error:
              "Ollama model is required",
          });
      }

      const project =
        getProjectOrNull(
          projectId
        );

      if (!project) {
        return res
          .status(404)
          .json({
            error:
              "Project not found",
          });
      }

      const existing =
        db
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
        return res
          .status(409)
          .json({
            error:
              "Roadmap already exists",
          });
      }

      const aiRoadmap =
        await generateRoadmap(
          project.title,
          project.description,
          model.trim()
        );

      if (
        !aiRoadmap ||
        !Array.isArray(
          aiRoadmap.milestones
        )
      ) {
        throw new Error(
          "AI returned an invalid roadmap."
        );
      }

      const insertMilestone =
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
        );

      const insertTask =
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
        );

      const transaction =
        db.transaction(() => {
          aiRoadmap.milestones.forEach(
            (
              milestone,
              milestoneIndex
            ) => {
              const milestoneId =
                randomUUID();

              insertMilestone.run({
                id: milestoneId,
                projectId,
                title:
                  milestone.title.trim(),
                description:
                  milestone.description?.trim() ||
                  "",
                order:
                  milestoneIndex + 1,
              });

              if (
                Array.isArray(
                  milestone.tasks
                )
              ) {
                milestone.tasks.forEach(
                  (taskTitle) => {
                    if (
                      !isValidString(
                        taskTitle
                      )
                    ) {
                      return;
                    }

                    insertTask.run({
                      id: randomUUID(),
                      milestoneId,
                      title:
                        taskTitle.trim(),
                      description:
                        "",
                    });
                  }
                );
              }
            }
          );
        });

      transaction();

      return res
        .status(201)
        .json({
          success: true,
          message:
            "Roadmap generated",
          projectId,
        });
    } catch (error) {
      console.error(
        "Failed to generate roadmap:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to generate roadmap"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Update Task
|--------------------------------------------------------------------------
*/

app.patch(
  "/api/projects/:projectId/roadmap/tasks/:taskId",
  (
    req: Request<TaskParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
        taskId,
      } = req.params;

      const {
        completed,
        title,
        description,
      } = req.body;

      const task =
        db
          .prepare(
            `
            SELECT tasks.id
            FROM tasks
            JOIN milestones
              ON milestones.id =
                 tasks.milestone_id
            WHERE
              tasks.id = ?
              AND milestones.project_id = ?
            `
          )
          .get(
            taskId,
            projectId
          );

      if (!task) {
        return res
          .status(404)
          .json({
            error:
              "Task not found",
          });
      }

      const updates: string[] =
        [];

      const values: unknown[] =
        [];

      if (
        typeof completed ===
        "boolean"
      ) {
        updates.push(
          "completed = ?"
        );

        values.push(
          completed ? 1 : 0
        );
      }

      if (
        typeof title === "string" &&
        title.trim()
      ) {
        updates.push(
          "title = ?"
        );

        values.push(
          title.trim()
        );
      }

      if (
        typeof description ===
        "string"
      ) {
        updates.push(
          "description = ?"
        );

        values.push(
          description.trim()
        );
      }

      if (!updates.length) {
        return res
          .status(400)
          .json({
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

      const updated =
        db
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

      return res.json({
        id: updated.id,
        milestoneId:
          updated.milestoneId,
        title: updated.title,
        description:
          updated.description,
        completed:
          Boolean(
            updated.completed
          ),
      });
    } catch (error) {
      console.error(
        "Failed to update task:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to update task"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Create Task
|--------------------------------------------------------------------------
*/

app.post(
  "/api/projects/:projectId/roadmap/milestones/:milestoneId/tasks",
  (
    req: Request<MilestoneParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
        milestoneId,
      } = req.params;

      const {
        title,
        description,
      } = req.body;

      if (!isValidString(title)) {
        return res
          .status(400)
          .json({
            error:
              "Task title is required",
          });
      }

      const milestone =
        db
          .prepare(
            `
            SELECT id
            FROM milestones
            WHERE
              id = ?
              AND project_id = ?
            `
          )
          .get(
            milestoneId,
            projectId
          );

      if (!milestone) {
        return res
          .status(404)
          .json({
            error:
              "Milestone not found",
          });
      }

      const task = {
        id: randomUUID(),
        milestoneId,
        title: title.trim(),
        description:
          typeof description ===
          "string"
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

      return res
        .status(201)
        .json(task);
    } catch (error) {
      console.error(
        "Failed to create task:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to create task"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Delete Task
|--------------------------------------------------------------------------
*/

app.delete(
  "/api/projects/:projectId/roadmap/tasks/:taskId",
  (
    req: Request<TaskParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
        taskId,
      } = req.params;

      const task =
        db
          .prepare(
            `
            SELECT tasks.id
            FROM tasks
            JOIN milestones
              ON milestones.id =
                 tasks.milestone_id
            WHERE
              tasks.id = ?
              AND milestones.project_id = ?
            `
          )
          .get(
            taskId,
            projectId
          );

      if (!task) {
        return res
          .status(404)
          .json({
            error:
              "Task not found",
          });
      }

      db.prepare(
        `
        DELETE FROM tasks
        WHERE id = ?
        `
      ).run(taskId);

      return res.json({
        success: true,
        message:
          "Task deleted",
      });
    } catch (error) {
      console.error(
        "Failed to delete task:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to delete task"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Update Milestone
|--------------------------------------------------------------------------
*/

app.patch(
  "/api/projects/:projectId/roadmap/milestones/:milestoneId",
  (
    req: Request<MilestoneParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
        milestoneId,
      } = req.params;

      const {
        title,
        description,
      } = req.body;

      const milestone =
        db
          .prepare(
            `
            SELECT id
            FROM milestones
            WHERE
              id = ?
              AND project_id = ?
            `
          )
          .get(
            milestoneId,
            projectId
          );

      if (!milestone) {
        return res
          .status(404)
          .json({
            error:
              "Milestone not found",
          });
      }

      const updates: string[] =
        [];

      const values: unknown[] =
        [];

      if (
        typeof title === "string" &&
        title.trim()
      ) {
        updates.push(
          "title = ?"
        );

        values.push(
          title.trim()
        );
      }

      if (
        typeof description ===
        "string"
      ) {
        updates.push(
          "description = ?"
        );

        values.push(
          description.trim()
        );
      }

      if (!updates.length) {
        return res
          .status(400)
          .json({
            error:
              "Provide title or description to update",
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

      const updated =
        db
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
          .get(
            milestoneId
          ) as {
          id: string;
          title: string;
          description: string;
          milestoneOrder: number;
        };

      return res.json({
        id: updated.id,
        title: updated.title,
        description:
          updated.description,
        order:
          updated.milestoneOrder,
      });
    } catch (error) {
      console.error(
        "Failed to update milestone:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to update milestone"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Create Milestone
|--------------------------------------------------------------------------
*/

app.post(
  "/api/projects/:projectId/roadmap/milestones",
  (
    req: Request<ProjectParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
      } = req.params;

      const {
        title,
        description,
      } = req.body;

      if (
        !getProjectOrNull(
          projectId
        )
      ) {
        return res
          .status(404)
          .json({
            error:
              "Project not found",
          });
      }

      if (!isValidString(title)) {
        return res
          .status(400)
          .json({
            error:
              "Milestone title is required",
          });
      }

      const maxOrder =
        db
          .prepare(
            `
            SELECT
              COALESCE(
                MAX(milestone_order),
                0
              ) AS maxOrder
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
          typeof description ===
          "string"
            ? description.trim()
            : "",
        order:
          maxOrder.maxOrder + 1,
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

      return res
        .status(201)
        .json({
          ...milestone,
          tasks: [],
        });
    } catch (error) {
      console.error(
        "Failed to create milestone:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to create milestone"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Delete Milestone
|--------------------------------------------------------------------------
*/

app.delete(
  "/api/projects/:projectId/roadmap/milestones/:milestoneId",
  (
    req: Request<MilestoneParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
        milestoneId,
      } = req.params;

      const milestone =
        db
          .prepare(
            `
            SELECT id
            FROM milestones
            WHERE
              id = ?
              AND project_id = ?
            `
          )
          .get(
            milestoneId,
            projectId
          );

      if (!milestone) {
        return res
          .status(404)
          .json({
            error:
              "Milestone not found",
          });
      }

      db.prepare(
        `
        DELETE FROM milestones
        WHERE id = ?
        `
      ).run(milestoneId);

      return res.json({
        success: true,
        message:
          "Milestone deleted",
      });
    } catch (error) {
      console.error(
        "Failed to delete milestone:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to delete milestone"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Assistant Messages
|--------------------------------------------------------------------------
*/

app.get(
  "/api/projects/:projectId/assistant/messages",
  (
    req: Request<ProjectParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
      } = req.params;

      if (
        !getProjectOrNull(
          projectId
        )
      ) {
        return res
          .status(404)
          .json({
            error:
              "Project not found",
          });
      }

      const messages =
        db
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

      return res.json(messages);
    } catch (error) {
      console.error(
        "Failed to fetch assistant messages:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to fetch assistant messages"
      );
    }
  }
);

app.delete(
  "/api/projects/:projectId/assistant/messages",
  (
    req: Request<ProjectParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
      } = req.params;

      if (
        !getProjectOrNull(
          projectId
        )
      ) {
        return res
          .status(404)
          .json({
            error:
              "Project not found",
          });
      }

      db.prepare(
        `
        DELETE FROM assistant_messages
        WHERE project_id = ?
        `
      ).run(projectId);

      return res.json({
        success: true,
        message:
          "Conversation cleared",
      });
    } catch (error) {
      console.error(
        "Failed to clear assistant messages:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to clear conversation"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Index Project Files
|--------------------------------------------------------------------------
*/

app.post(
  "/api/projects/:projectId/index",
  async (
    req: Request<ProjectParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
      } = req.params;

      const {
        projectDirectory,
      } = req.body;

      if (
        !getProjectOrNull(
          projectId
        )
      ) {
        return res
          .status(404)
          .json({
            error:
              "Project not found",
          });
      }

      /*
       * If the frontend doesn't provide a
       * directory, use uploaded files.
       */
      const directory =
        isValidString(
          projectDirectory
        )
          ? projectDirectory.trim()
          : getProjectUploadDirectory(
              projectId
            );

      const files =
        await indexProjectFiles(
          directory
        );

      return res.json({
        success: true,
        projectId,
        directory,
        fileCount:
          files.length,

        files: files.map(
          (file) => ({
            path: file.path,
            extension:
              file.extension,
          })
        ),
      });
    } catch (error) {
      console.error(
        "Failed to index project:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to index project"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Project AI Assistant
|--------------------------------------------------------------------------
*/

app.post(
  "/api/projects/:projectId/assistant",
  async (
    req: Request<ProjectParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
      } = req.params;

      const {
        model,
        mode,
        message,
        code,
        taskId,
        projectDirectory,
      } = req.body;

      if (!isValidString(model)) {
        return res
          .status(400)
          .json({
            error:
              "Ollama model is required",
          });
      }

      if (
        !isValidString(mode) ||
        !ASSISTANT_MODES.includes(
          mode as AssistantMode
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Mode must be one of: ask, generate, explain, fix",
          });
      }

      if (
        typeof message !==
        "string"
      ) {
        return res
          .status(400)
          .json({
            error:
              "Message must be a string",
          });
      }

      const project =
        getProjectOrNull(
          projectId
        );

      if (!project) {
        return res
          .status(404)
          .json({
            error:
              "Project not found",
          });
      }

      /*
       * Task context
       */

      let taskContext:
        | TaskContext
        | undefined;

      if (
        typeof taskId ===
          "string" &&
        taskId.trim()
      ) {
        const task =
          db
            .prepare(
              `
              SELECT
                tasks.id,
                tasks.title,
                tasks.description,
                milestones.title
                  AS milestoneTitle
              FROM tasks
              JOIN milestones
                ON milestones.id =
                   tasks.milestone_id
              WHERE
                tasks.id = ?
                AND milestones.project_id = ?
              `
            )
            .get(
              taskId,
              projectId
            ) as
            | TaskContext
            | undefined;

        if (!task) {
          return res
            .status(404)
            .json({
              error:
                "Task not found",
            });
        }

        taskContext = task;
      }

      /*
       * Index project source code
       *
       * If a projectDirectory is supplied,
       * index that directory.
       *
       * Otherwise automatically use
       * uploaded project files.
       */

      let indexedFiles:
        IndexedFile[] = [];

      let directoryToIndex =
        "";

      if (
        typeof projectDirectory ===
          "string" &&
        projectDirectory.trim()
      ) {
        directoryToIndex =
          projectDirectory.trim();
      } else {
        const uploadedFiles =
          await getUploadedProjectFiles(
            projectId
          );

        if (
          uploadedFiles.length > 0
        ) {
          directoryToIndex =
            getProjectUploadDirectory(
              projectId
            );
        }
      }

      if (directoryToIndex) {
        console.log(
          `📂 Indexing project: ${directoryToIndex}`
        );

        try {
          indexedFiles =
            await indexProjectFiles(
              directoryToIndex
            );

          console.log(
            `📄 Indexed ${indexedFiles.length} files`
          );
        } catch (error) {
          console.warn(
            "⚠️ Project indexing failed:",
            error
          );

          indexedFiles = [];
        }
      }

      /*
       * Previous conversation
       */

      const storedMessages =
        db
          .prepare(
            `
            SELECT
              role,
              content
            FROM assistant_messages
            WHERE project_id = ?
            ORDER BY created_at ASC
            `
          )
          .all(projectId) as
          ChatTurn[];

      /*
       * Run AI assistant
       */

      const answer =
        await runProjectAssistant(
          mode as AssistantMode,
          {
            title:
              project.title,

            description:
              project.description,

            techStack: [],

            files:
              indexedFiles,
          },
          message,
          model,
          typeof code ===
            "string"
            ? code
            : undefined,
          storedMessages,
          taskContext
        );

      /*
       * Persist conversation
       */

      const userMessageId =
        randomUUID();

      const assistantMessageId =
        randomUUID();

      const userCreatedAt =
        new Date().toISOString();

      const assistantCreatedAt =
        new Date().toISOString();

      const insertMessage =
        db.prepare(
          `
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
          `
        );

      const transaction =
        db.transaction(() => {
          insertMessage.run({
            id:
              userMessageId,

            projectId,

            role: "user",

            mode,

            content:
              message.trim(),

            code:
              typeof code ===
              "string"
                ? code
                : "",

            taskId:
              taskContext?.id ??
              null,

            createdAt:
              userCreatedAt,
          });

          insertMessage.run({
            id:
              assistantMessageId,

            projectId,

            role:
              "assistant",

            mode,

            content: answer,

            code: "",

            taskId:
              taskContext?.id ??
              null,

            createdAt:
              assistantCreatedAt,
          });
        });

      transaction();

      return res.json({
        success: true,

        projectId,

        mode,

        answer,

        projectContext: {
          indexed:
            indexedFiles.length >
            0,

          fileCount:
            indexedFiles.length,

          source:
            directoryToIndex
              ? "project"
              : "none",
        },

        messages: [
          {
            id:
              userMessageId,

            role: "user",

            mode,

            content:
              message.trim(),

            code:
              typeof code ===
              "string"
                ? code
                : undefined,

            taskId:
              taskContext?.id,

            createdAt:
              userCreatedAt,
          },

          {
            id:
              assistantMessageId,

            role:
              "assistant",

            mode,

            content: answer,

            taskId:
              taskContext?.id,

            createdAt:
              assistantCreatedAt,
          },
        ],
      });
    } catch (error) {
      console.error(
        "Failed to run project assistant:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to get AI response"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Task Assistant
|--------------------------------------------------------------------------
*/

app.post(
  "/api/projects/:projectId/roadmap/tasks/:taskId/ask",
  async (
    req: Request<TaskParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
        taskId,
      } = req.params;

      const { model } =
        req.body;

      if (!isValidString(model)) {
        return res
          .status(400)
          .json({
            error:
              "Ollama model is required",
          });
      }

      const task =
        db
          .prepare(
            `
            SELECT
              tasks.id,
              tasks.title,
              tasks.description,
              milestones.title
                AS milestone_title
            FROM tasks
            JOIN milestones
              ON milestones.id =
                 tasks.milestone_id
            WHERE
              tasks.id = ?
              AND milestones.project_id = ?
            `
          )
          .get(
            taskId,
            projectId
          ) as
          | {
              id: string;
              title: string;
              description: string;
              milestone_title: string;
            }
          | undefined;

      if (!task) {
        return res
          .status(404)
          .json({
            error:
              "Task not found",
          });
      }

      const project =
        getProjectOrNull(
          projectId
        );

      if (!project) {
        return res
          .status(404)
          .json({
            error:
              "Project not found",
          });
      }

      const answer =
        await askTaskAssistant(
          project.title,
          project.description,
          task.title,
          task.description,
          model
        );

      return res.json({
        success: true,
        taskId,
        projectId,
        answer,
      });
    } catch (error) {
      console.error(
        "Failed to ask DevSmith AI:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to get AI response"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Ollama Models
|--------------------------------------------------------------------------
*/

app.get(
  "/api/ai/models",
  async (
    _req: Request,
    res: Response
  ) => {
    try {
      const connected =
        await isOllamaRunning();

      if (!connected) {
        return res.json({
          connected: false,
          url: OLLAMA_URL,
          models: [],
        });
      }

      const models =
        await getOllamaModels();

      return res.json({
        connected: true,
        url: OLLAMA_URL,
        models,
      });
    } catch (error) {
      console.error(
        "Failed to fetch Ollama models:",
        error
      );

      return res
        .status(503)
        .json({
          connected: false,
          url: OLLAMA_URL,
          models: [],
          error:
            error instanceof Error
              ? error.message
              : "Failed to connect to Ollama",
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Task Code Generation
|--------------------------------------------------------------------------
*/

app.post(
  "/api/projects/:projectId/tasks/:taskId/generate-code",
  async (
    req: Request<TaskParams>,
    res: Response
  ) => {
    try {
      const {
        projectId,
        taskId,
      } = req.params;

      const { model } =
        req.body;

      if (!isValidString(model)) {
        return res
          .status(400)
          .json({
            error:
              "Ollama model is required",
          });
      }

      const task =
        db
          .prepare(
            `
            SELECT
              tasks.id,
              tasks.title,
              tasks.description
            FROM tasks
            JOIN milestones
              ON milestones.id =
                 tasks.milestone_id
            WHERE
              tasks.id = ?
              AND milestones.project_id = ?
            `
          )
          .get(
            taskId,
            projectId
          ) as
          | {
              id: string;
              title: string;
              description: string;
            }
          | undefined;

      if (!task) {
        return res
          .status(404)
          .json({
            error:
              "Task not found",
          });
      }

      const result =
        await generateCode(
          task.title,
          task.description,
          model
        );

      return res.json({
        success: true,
        projectId,
        taskId,
        ...result,
      });
    } catch (error) {
      console.error(
        "Failed to generate code:",
        error
      );

      return sendError(
        res,
        500,
        error,
        "Failed to generate code"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use(
  (
    req: Request,
    res: Response
  ) => {
    return res
      .status(404)
      .json({
        error:
          "Route not found",
        path:
          req.originalUrl,
      });
  }
);

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error(
      "Unhandled server error:",
      error
    );

    if (res.headersSent) {
      return;
    }

    return res
      .status(500)
      .json({
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      });
  }
);

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

app.listen(
  PORT,
  () => {
    console.log(
      `🚀 DevSmith API running on http://localhost:${PORT}`
    );

    console.log(
      `🤖 Ollama: ${OLLAMA_URL}`
    );

    console.log(
      `📁 Upload directory: ${UPLOAD_ROOT}`
    );
  }
);