import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, asc } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { Song, InsertSong, Setlist, InsertSetlist, ActiveSession, InsertActiveSession, Request, InsertRequest } from "@shared/schema";

const sqlite = new Database("data.db");
const db = drizzle(sqlite, { schema });

// Run migrations
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    year INTEGER,
    key TEXT,
    capo TEXT,
    chords TEXT,
    strumming TEXT,
    guitar_type TEXT,
    tempo INTEGER,
    tempo_feel TEXT,
    mood TEXT,
    genre TEXT,
    difficulty TEXT,
    tags TEXT,
    performance_note TEXT,
    ultimate_guitar_url TEXT,
    set_position INTEGER,
    pdf_filename TEXT
  );
  CREATE TABLE IF NOT EXISTS setlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gig_date TEXT,
    venue TEXT,
    song_ids TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS active_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setlist_id INTEGER,
    current_song_index INTEGER NOT NULL DEFAULT 0,
    ordered_song_ids TEXT NOT NULL,
    played_song_ids TEXT NOT NULL DEFAULT '[]',
    skipped_song_ids TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id TEXT NOT NULL,
    requester_note TEXT,
    votes INTEGER NOT NULL DEFAULT 1,
    is_handled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`);

export interface IStorage {
  // Songs
  getAllSongs(): Song[];
  getSong(id: string): Song | undefined;
  upsertSong(song: InsertSong): Song;
  deleteSong(id: string): void;

  // Setlists
  getAllSetlists(): Setlist[];
  getSetlist(id: number): Setlist | undefined;
  createSetlist(setlist: InsertSetlist): Setlist;
  updateSetlist(id: number, data: Partial<InsertSetlist>): Setlist | undefined;
  deleteSetlist(id: number): void;

  // Active session
  getActiveSession(): ActiveSession | undefined;
  createActiveSession(session: InsertActiveSession): ActiveSession;
  updateActiveSession(id: number, data: Partial<InsertActiveSession>): ActiveSession | undefined;
  clearActiveSession(): void;

  // Requests
  getAllRequests(): Request[];
  getPendingRequests(): Request[];
  createRequest(req: InsertRequest): Request;
  upvoteRequest(id: number): Request | undefined;
  handleRequest(id: number): void;
  clearRequests(): void;
}

export class Storage implements IStorage {
  getAllSongs(): Song[] {
    return db.select().from(schema.songs).orderBy(asc(schema.songs.setPosition)).all();
  }

  getSong(id: string): Song | undefined {
    return db.select().from(schema.songs).where(eq(schema.songs.id, id)).get();
  }

  upsertSong(song: InsertSong): Song {
    const existing = this.getSong(song.id);
    if (existing) {
      db.update(schema.songs).set(song).where(eq(schema.songs.id, song.id)).run();
    } else {
      db.insert(schema.songs).values(song).run();
    }
    return this.getSong(song.id)!;
  }

  deleteSong(id: string): void {
    db.delete(schema.songs).where(eq(schema.songs.id, id)).run();
  }

  getAllSetlists(): Setlist[] {
    return db.select().from(schema.setlists).orderBy(desc(schema.setlists.id)).all();
  }

  getSetlist(id: number): Setlist | undefined {
    return db.select().from(schema.setlists).where(eq(schema.setlists.id, id)).get();
  }

  createSetlist(setlist: InsertSetlist): Setlist {
    return db.insert(schema.setlists).values(setlist).returning().get();
  }

  updateSetlist(id: number, data: Partial<InsertSetlist>): Setlist | undefined {
    db.update(schema.setlists).set(data).where(eq(schema.setlists.id, id)).run();
    return this.getSetlist(id);
  }

  deleteSetlist(id: number): void {
    db.delete(schema.setlists).where(eq(schema.setlists.id, id)).run();
  }

  getActiveSession(): ActiveSession | undefined {
    return db.select().from(schema.activeSessions).orderBy(desc(schema.activeSessions.id)).get();
  }

  createActiveSession(session: InsertActiveSession): ActiveSession {
    return db.insert(schema.activeSessions).values(session).returning().get();
  }

  updateActiveSession(id: number, data: Partial<InsertActiveSession>): ActiveSession | undefined {
    db.update(schema.activeSessions).set(data).where(eq(schema.activeSessions.id, id)).run();
    return db.select().from(schema.activeSessions).where(eq(schema.activeSessions.id, id)).get();
  }

  clearActiveSession(): void {
    db.delete(schema.activeSessions).run();
  }

  getAllRequests(): Request[] {
    return db.select().from(schema.requests).orderBy(desc(schema.requests.votes)).all();
  }

  getPendingRequests(): Request[] {
    return db.select().from(schema.requests)
      .where(eq(schema.requests.isHandled, 0))
      .orderBy(desc(schema.requests.votes))
      .all();
  }

  createRequest(req: InsertRequest): Request {
    const now = new Date().toISOString();
    return db.insert(schema.requests).values({ ...req, createdAt: now }).returning().get();
  }

  upvoteRequest(id: number): Request | undefined {
    const req = db.select().from(schema.requests).where(eq(schema.requests.id, id)).get();
    if (!req) return undefined;
    db.update(schema.requests).set({ votes: req.votes + 1 }).where(eq(schema.requests.id, id)).run();
    return db.select().from(schema.requests).where(eq(schema.requests.id, id)).get();
  }

  handleRequest(id: number): void {
    db.update(schema.requests).set({ isHandled: 1 }).where(eq(schema.requests.id, id)).run();
  }

  clearRequests(): void {
    db.delete(schema.requests).run();
  }
}

export const storage = new Storage();
