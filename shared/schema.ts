import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── SONGS ────────────────────────────────────────────────────────────────────
export const songs = sqliteTable("songs", {
  id: text("id").primaryKey(), // slug e.g. "mr-brightside"
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  year: integer("year"),
  key: text("key"),
  capo: text("capo"),
  chords: text("chords"),
  strumming: text("strumming"),
  guitarType: text("guitar_type"), // "acoustic" | "electric" | "either"
  tempo: integer("tempo"),
  tempoFeel: text("tempo_feel"), // "Ballad" | "Mid-Tempo" | "Driving" | "Upbeat"
  mood: text("mood"),
  genre: text("genre"),
  difficulty: text("difficulty"), // "Beginner" | "Intermediate" | "Advanced"
  tags: text("tags"), // JSON array stored as text
  performanceNote: text("performance_note"),
  ultimateGuitarUrl: text("ultimate_guitar_url"),
  setPosition: integer("set_position"),
  pdfFilename: text("pdf_filename"),
});

export const insertSongSchema = createInsertSchema(songs).omit({});
export type InsertSong = z.infer<typeof insertSongSchema>;
export type Song = typeof songs.$inferSelect;

// ── SETLISTS ─────────────────────────────────────────────────────────────────
export const setlists = sqliteTable("setlists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  gigDate: text("gig_date"),
  venue: text("venue"),
  songIds: text("song_ids").notNull(), // JSON array of song IDs in order
  createdAt: text("created_at").notNull(),
});

export const insertSetlistSchema = createInsertSchema(setlists).omit({ id: true });
export type InsertSetlist = z.infer<typeof insertSetlistSchema>;
export type Setlist = typeof setlists.$inferSelect;

// ── ACTIVE SESSION ────────────────────────────────────────────────────────────
export const activeSessions = sqliteTable("active_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  setlistId: integer("setlist_id"),
  currentSongIndex: integer("current_song_index").notNull().default(0),
  orderedSongIds: text("ordered_song_ids").notNull(), // JSON array — live reorder
  playedSongIds: text("played_song_ids").notNull().default("[]"), // JSON array
  skippedSongIds: text("skipped_song_ids").notNull().default("[]"), // JSON array
  updatedAt: text("updated_at").notNull(),
});

export const insertActiveSessionSchema = createInsertSchema(activeSessions).omit({ id: true });
export type InsertActiveSession = z.infer<typeof insertActiveSessionSchema>;
export type ActiveSession = typeof activeSessions.$inferSelect;

// ── AUDIENCE REQUESTS ─────────────────────────────────────────────────────────
export const requests = sqliteTable("requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  songId: text("song_id").notNull(),
  requesterNote: text("requester_note"),
  votes: integer("votes").notNull().default(1),
  isHandled: integer("is_handled").notNull().default(0), // 0 = pending, 1 = handled
  createdAt: text("created_at").notNull(),
});

export const insertRequestSchema = createInsertSchema(requests).omit({ id: true, votes: true, isHandled: true });
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Request = typeof requests.$inferSelect;
