import Database from "better-sqlite3";

const db = new Database("devsmith.db");

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Planning',
    created_at TEXT NOT NULL
  )
`);

export default db;