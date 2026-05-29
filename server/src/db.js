import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const DB_PATH = process.env.DB_PATH || join(DATA_DIR, 'beatbracket.db');

let db;

export function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}

export function initDb() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  db = new DatabaseSync(DB_PATH);

  db.exec(`PRAGMA journal_mode = WAL`);
  db.exec(`PRAGMA foreign_keys = ON`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      spotify_id TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      avatar TEXT,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      token_expires INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      genre TEXT,
      song_count INTEGER NOT NULL DEFAULT 16,
      round_duration INTEGER NOT NULL DEFAULT 24,
      organizer_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'lobby',
      current_round INTEGER NOT NULL DEFAULT 0,
      round_ends_at INTEGER,
      champion_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (organizer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (room_id, user_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      spotify_id TEXT NOT NULL,
      name TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT,
      album_art TEXT,
      preview_url TEXT,
      popularity INTEGER DEFAULT 50,
      seed INTEGER,
      added_by TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS matchups (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      round INTEGER NOT NULL,
      position INTEGER NOT NULL,
      song1_id TEXT NOT NULL,
      song2_id TEXT NOT NULL,
      winner_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      matchup_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      song_id TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(matchup_id, user_id),
      FOREIGN KEY (matchup_id) REFERENCES matchups(id)
    );
  `);

  console.log('Database initialized at', DB_PATH);
  return db;
}
