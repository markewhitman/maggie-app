// Supabase Edge Function: analyze-song-pdf
// Secure AI/OCR song import for scanned PDFs.
// Required secret: OPENAI_API_KEY
// Optional secret: OPENAI_MODEL (defaults to gpt-4.1-mini)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Confidence = "high" | "medium" | "low";
type SuggestionSource = "ai/ocr" | "music metadata" | "duration estimate";

type Suggestion = {
  value: string;
  confidence: Confidence;
  source: SuggestionSource;
};

type AiJson = {
  title?: string | null;
  artist?: string | null;
  key?: string | null;
  capo?: string | null;
  chords?: string[] | string | null;
  strumming?: string | null;
  tempo?: string | number | null;
  duration?: string | null;
  durationKind?: "printed" | "estimated" | "unknown" | null;
  genre?: string | null;
  mood?: string | null;
  energy?: "low" | "medium" | "high" | string | null;
  vocalStyle?: "storytelling" | "singalong" | "emotional" | "powerful" | "conversational" | string | null;
  tags?: string[] | string | null;
  performanceNote?: string | null;
  ultimateGuitarUrl?: string | null;
  detectedChords?: string[];
  reviewReasons?: string[];
  warnings?: string[];
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanString(value: unknown): string | undefined {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  return s || undefined;
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:remaster(?:ed)?|radio edit|single version|album version|live|acoustic|explicit|clean)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function durationFromMs(ms: unknown): string | undefined {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const totalSeconds = Math.round(n / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0 || minutes > 20) return undefined;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function asSuggestion(value: unknown, confidence: Confidence, source: SuggestionSource): Suggestion | undefined {
  const clean = cleanString(Array.isArray(value) ? value.join(", ") : value);
  return clean ? { value: clean, confidence, source } : undefined;
}

function titleArtistConfidence(resultTitle: string, resultArtist: string, title: string, artist: string): Confidence | null {
  const t = normalizeForMatch(title);
  const a = normalizeForMatch(artist);
  const rt = normalizeForMatch(resultTitle);
  const ra = normalizeForMatch(resultArtist);
  if (!t || !a || !rt || !ra) return null;
  const titleStrong = rt === t || rt.includes(t) || t.includes(rt);
  const artistStrong = ra === a || ra.includes(a) || a.includes(ra);
  if (titleStrong && artistStrong) return "high";
  const titleLoose = rt.split(" ").some((word) => word.length > 3 && t.includes(word));
  const artistLoose = ra.split(" ").some((word) => word.length > 3 && a.includes(word));
  if (titleLoose && artistLoose) return "medium";
  return null;
}

async function lookupItunesDuration(title: string, artist: string): Promise<{ duration?: string; confidence?: Confidence; note?: string }> {
  const term = encodeURIComponent(`${title} ${artist}`);
  const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=8`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) return {};
  const data = await res.json();
  for (const item of data.results ?? []) {
    const confidence = titleArtistConfidence(item.trackName ?? "", item.artistName ?? "", title, artist);
    const duration = durationFromMs(item.trackTimeMillis);
    if (confidence && duration) {
      return {
        duration,
        confidence,
        note: `Matched Apple/iTunes metadata: ${item.trackName} — ${item.artistName}.`,
      };
    }
  }
  return {};
}

async function lookupMusicBrainzDuration(title: string, artist: string): Promise<{ duration?: string; confidence?: Confidence; note?: string }> {
  const query = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`);
  const url = `https://musicbrainz.org/ws/2/recording/?query=${query}&fmt=json&limit=8`;
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "MaggieSetlistApp/1.0 (personal smart import)",
    },
  });
  if (!res.ok) return {};
  const data = await res.json();
  for (const recording of data.recordings ?? []) {
    const artistCredit = Array.isArray(recording["artist-credit"])
      ? recording["artist-credit"].map((entry: any) => entry?.name ?? entry?.artist?.name ?? "").join(" ")
      : "";
    const confidence = titleArtistConfidence(recording.title ?? "", artistCredit, title, artist);
    const duration = durationFromMs(recording.length);
    if (confidence && duration) {
      return {
        duration,
        confidence,
        note: `Matched MusicBrainz metadata: ${recording.title} — ${artistCredit}.`,
      };
    }
  }
  return {};
}

async function resolveDuration(title?: string, artist?: string): Promise<{ duration?: string; confidence?: Confidence; source?: SuggestionSource; note?: string }> {
  if (!title || !artist) return {};
  try {
    const itunes = await lookupItunesDuration(title, artist);
    if (itunes.duration) return { duration: itunes.duration, confidence: itunes.confidence ?? "medium", source: "music metadata", note: itunes.note };
  } catch (_) {
    // Metadata lookup is best-effort only.
  }
  try {
    const mb = await lookupMusicBrainzDuration(title, artist);
    if (mb.duration) return { duration: mb.duration, confidence: mb.confidence ?? "medium", source: "music metadata", note: mb.note };
  } catch (_) {
    // Metadata lookup is best-effort only.
  }
  return {};
}

function extractOutputText(responseJson: any): string {
  if (typeof responseJson.output_text === "string") return responseJson.output_text;
  const pieces: string[] = [];
  for (const item of responseJson.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") pieces.push(content.text);
      if (typeof content.value === "string") pieces.push(content.value);
    }
  }
  return pieces.join("\n").trim();
}

function parseModelJson(text: string): AiJson {
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI response was not valid JSON.");
    return JSON.parse(match[0]);
  }
}

function buildPrompt(filename: string, localTextSample: string, localSuggestions: unknown, songContext?: unknown): string {
  return `You are helping a musician import a scanned or text-based song PDF into a setlist app.
Return ONLY valid JSON. Do not include markdown.
Extract practical song-card metadata for live performance. Do not quote or reproduce copyrighted lyrics; metadata, chord names, structure labels, and brief performance notes are okay.

Fields to return:
- title, artist, key, capo, chords, strumming, tempo, duration, durationKind, genre, mood, energy, vocalStyle, tags, performanceNote, ultimateGuitarUrl, detectedChords, reviewReasons, warnings.
- durationKind must be "printed" when a duration is visibly printed, "estimated" when estimated from tempo/structure/page content, or "unknown".
- If no printed duration is visible, estimate a likely live-performance duration from tempo, chart structure, repeated sections, page length, and lyrics/chord density. Use m:ss.
- For uncertainty, leave fields null and add a review reason. Never invent a precise-looking fact when uncertain.
- Chords should be chord symbols only, not lyric lines.
- Tags should be short lowercase tags useful for filtering, such as acoustic, capo, duet, female-vocal, male-vocal, worship, country, rock, singalong, needs-review.

Filename: ${filename}
Local browser text sample, if any: ${localTextSample || "(none)"}
Local browser suggestions: ${JSON.stringify(localSuggestions ?? {})}
Existing song card being updated, if any: ${songContext ? JSON.stringify(songContext) : "(new song import)"}

When an existing song card is provided, use it as context and only suggest changes that are supported by the PDF or reliable music metadata. If the PDF appears to be for a different song than the existing card, add a warning and review reason.

Return shape example:
{"title":"...","artist":"...","key":"G","capo":"Capo 2","chords":["G","D","Em","C"],"strumming":"D DU UDU","tempo":"104","duration":"3:48","durationKind":"estimated","genre":"Folk","mood":"warm","energy":"medium","vocalStyle":"singalong","tags":["acoustic","capo","needs-review"],"performanceNote":"Capo 2; watch the bridge change.","ultimateGuitarUrl":null,"detectedChords":["G","D","Em","C"],"reviewReasons":["Confirm duration estimate."],"warnings":[]}`;
}

async function callOpenAI(filename: string, mimeType: string, fileBase64: string, localTextSample: string, localSuggestions: unknown, songContext?: unknown): Promise<AiJson> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set for this Supabase project.");
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";

  const payload = {
    model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: buildPrompt(filename, localTextSample, localSuggestions, songContext) },
          { type: "input_file", filename, file_data: `data:${mimeType || "application/pdf"};base64,${fileBase64}` },
        ],
      },
    ],
    text: { format: { type: "json_object" } },
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI analysis failed: ${res.status} ${errorText.slice(0, 500)}`);
  }

  const responseJson = await res.json();
  return parseModelJson(extractOutputText(responseJson));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "POST required" }, 405);

  try {
    const body = await req.json();
    const filename = cleanString(body.filename) ?? "song.pdf";
    const mimeType = cleanString(body.mimeType) ?? "application/pdf";
    const fileBase64 = cleanString(body.fileBase64);
    const localTextSample = cleanString(body.localTextSample) ?? "";

    if (!fileBase64) return jsonResponse({ ok: false, error: "Missing fileBase64" }, 400);
    if (fileBase64.length > 18_000_000) {
      return jsonResponse({ ok: false, error: "PDF is too large for AI/OCR import. Compress the scan or enter details manually." }, 413);
    }

    const ai = await callOpenAI(filename, mimeType, fileBase64, localTextSample, body.localSuggestions, body.songContext);
    const title = cleanString(ai.title);
    const artist = cleanString(ai.artist);
    const enhancementNotes: string[] = [];

    let durationValue = cleanString(ai.duration);
    let durationSource: SuggestionSource = ai.durationKind === "printed" ? "ai/ocr" : "duration estimate";
    let durationConfidence: Confidence = ai.durationKind === "printed" ? "high" : ai.durationKind === "estimated" ? "medium" : "low";

    if (!durationValue || ai.durationKind !== "printed") {
      const resolved = await resolveDuration(title, artist);
      if (resolved.duration) {
        durationValue = resolved.duration;
        durationSource = resolved.source ?? "music metadata";
        durationConfidence = resolved.confidence ?? "medium";
        if (resolved.note) enhancementNotes.push(resolved.note);
      } else if (durationValue) {
        enhancementNotes.push("Duration is an AI estimate from the chart structure; confirm against Maggie's live arrangement.");
      }
    }

    const suggestions: Record<string, Suggestion | undefined> = {
      title: asSuggestion(title, title ? "high" : "low", "ai/ocr"),
      artist: asSuggestion(artist, artist ? "high" : "low", "ai/ocr"),
      key: asSuggestion(ai.key, ai.key ? "medium" : "low", "ai/ocr"),
      capo: asSuggestion(ai.capo, ai.capo ? "medium" : "low", "ai/ocr"),
      chords: asSuggestion(ai.chords, ai.chords ? "high" : "low", "ai/ocr"),
      strumming: asSuggestion(ai.strumming, "medium", "ai/ocr"),
      tempo: asSuggestion(ai.tempo, "medium", "ai/ocr"),
      duration: asSuggestion(durationValue, durationConfidence, durationSource),
      genre: asSuggestion(ai.genre, "low", "ai/ocr"),
      mood: asSuggestion(ai.mood, "low", "ai/ocr"),
      energy: asSuggestion(ai.energy, "low", "ai/ocr"),
      vocalStyle: asSuggestion(ai.vocalStyle, "low", "ai/ocr"),
      tags: asSuggestion(ai.tags, "medium", "ai/ocr"),
      performanceNote: asSuggestion(ai.performanceNote, "medium", "ai/ocr"),
      ultimateGuitarUrl: asSuggestion(ai.ultimateGuitarUrl, "low", "ai/ocr"),
    };

    const reviewReasons = Array.isArray(ai.reviewReasons) ? ai.reviewReasons.map(String) : [];
    if (durationSource === "duration estimate") reviewReasons.push("Confirm AI-estimated duration against the live arrangement.");
    if (!title) reviewReasons.push("Confirm song title.");
    if (!artist) reviewReasons.push("Confirm artist.");

    return jsonResponse({
      ok: true,
      suggestions,
      detectedChords: Array.isArray(ai.detectedChords) ? ai.detectedChords.map(String) : [],
      reviewReasons: Array.from(new Set(reviewReasons)),
      warnings: Array.isArray(ai.warnings) ? ai.warnings.map(String) : [],
      enhancementNotes,
      durationSource: durationSource === "music metadata" ? "music metadata lookup" : durationSource === "duration estimate" ? "AI chart estimate" : "PDF/AI reading",
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : "Unknown AI/OCR import error" }, 500);
  }
});
