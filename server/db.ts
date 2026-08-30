import Database from "better-sqlite3";

const db = new Database("devsmith.db");

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Planning',
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    milestone_order INTEGER NOT NULL,

    FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    milestone_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    completed INTEGER NOT NULL DEFAULT 0,

    FOREIGN KEY (milestone_id)
      REFERENCES milestones(id)
      ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS assistant_messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    role TEXT NOT NULL,
    mode TEXT NOT NULL,
    content TEXT NOT NULL,
    code TEXT DEFAULT '',
    task_id TEXT,
    created_at TEXT NOT NULL,

    FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE CASCADE
  );
`);

export default db;