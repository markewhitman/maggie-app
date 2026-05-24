import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import { insertSongSchema, insertSetlistSchema, insertRequestSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(httpServer: Server, app: Express) {
  await seedDatabase();

  // ── SONGS ────────────────────────────────────────────────────────────────────
  app.get("/api/songs", (_req, res) => {
    res.json(storage.getAllSongs());
  });

  app.get("/api/songs/:id", (req, res) => {
    const song = storage.getSong(req.params.id);
    if (!song) return res.status(404).json({ error: "Song not found" });
    res.json(song);
  });

  app.post("/api/songs", (req, res) => {
    const result = insertSongSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(storage.upsertSong(result.data));
  });

  app.put("/api/songs/:id", (req, res) => {
    const result = insertSongSchema.partial().safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    const existing = storage.getSong(req.params.id);
    if (!existing) return res.status(404).json({ error: "Song not found" });
    res.json(storage.upsertSong({ ...existing, ...result.data, id: req.params.id }));
  });

  app.delete("/api/songs/:id", (req, res) => {
    storage.deleteSong(req.params.id);
    res.json({ ok: true });
  });

  // ── SETLISTS ─────────────────────────────────────────────────────────────────
  app.get("/api/setlists", (_req, res) => {
    res.json(storage.getAllSetlists());
  });

  app.get("/api/setlists/:id", (req, res) => {
    const sl = storage.getSetlist(Number(req.params.id));
    if (!sl) return res.status(404).json({ error: "Setlist not found" });
    res.json(sl);
  });

  app.post("/api/setlists", (req, res) => {
    const schema = insertSetlistSchema.extend({ createdAt: z.string().optional() });
    const result = schema.safeParse({ ...req.body, createdAt: new Date().toISOString() });
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(storage.createSetlist(result.data));
  });

  app.put("/api/setlists/:id", (req, res) => {
    const updated = storage.updateSetlist(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/setlists/:id", (req, res) => {
    storage.deleteSetlist(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── ACTIVE SESSION ────────────────────────────────────────────────────────────
  app.get("/api/session", (_req, res) => {
    res.json(storage.getActiveSession() ?? null);
  });

  app.post("/api/session", (req, res) => {
    storage.clearActiveSession();
    const session = storage.createActiveSession({
      setlistId: req.body.setlistId ?? null,
      currentSongIndex: 0,
      orderedSongIds: req.body.orderedSongIds ?? "[]",
      playedSongIds: "[]",
      skippedSongIds: "[]",
      updatedAt: new Date().toISOString(),
    });
    res.json(session);
  });

  app.put("/api/session/:id", (req, res) => {
    const updated = storage.updateActiveSession(Number(req.params.id), {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/session", (_req, res) => {
    storage.clearActiveSession();
    res.json({ ok: true });
  });

  // ── REQUESTS ──────────────────────────────────────────────────────────────────
  app.get("/api/requests", (_req, res) => {
    res.json(storage.getPendingRequests());
  });

  app.post("/api/requests", (req, res) => {
    const result = insertRequestSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(storage.createRequest(result.data));
  });

  app.post("/api/requests/:id/upvote", (req, res) => {
    const updated = storage.upvoteRequest(Number(req.params.id));
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.post("/api/requests/:id/handle", (req, res) => {
    storage.handleRequest(Number(req.params.id));
    res.json({ ok: true });
  });

  app.delete("/api/requests", (_req, res) => {
    storage.clearRequests();
    res.json({ ok: true });
  });
}
