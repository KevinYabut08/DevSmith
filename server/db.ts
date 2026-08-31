import Database from "better-sqlite3";

const db = new Database("devsmith.db");

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

/*
|--------------------------------------------------------------------------
| Projects
|--------------------------------------------------------------------------
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Planning',
    created_at TEXT NOT NULL
  )
`);

/*
|--------------------------------------------------------------------------
| Milestones
|--------------------------------------------------------------------------
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    milestone_order INTEGER NOT NULL,

    FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE CASCADE
  )
`);

/*
|--------------------------------------------------------------------------
| Tasks
|--------------------------------------------------------------------------
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    milestone_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    completed INTEGER NOT NULL DEFAULT 0,

    FOREIGN KEY (milestone_id)
      REFERENCES milestones(id)
      ON DELETE CASCADE
  )
`);

/*
|--------------------------------------------------------------------------
| Assistant Messages
|--------------------------------------------------------------------------
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS assistant_messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    role TEXT NOT NULL,
    mode TEXT NOT NULL,
    content TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    task_id TEXT,
    created_at TEXT NOT NULL,

    FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE CASCADE
  )
`);

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
|
| These become important as your project grows.
|
*/

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_milestones_project_id
  ON milestones(project_id)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id
  ON tasks(milestone_id)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_assistant_messages_project_id
  ON assistant_messages(project_id)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_assistant_messages_created_at
  ON assistant_messages(created_at)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_assistant_messages_task_id
  ON assistant_messages(task_id)
`);

export default db;