import type { Song } from "./data";

export type SmartImportConfidence = "high" | "medium" | "low";

export interface SmartImportSuggestion {
  value: string;
  confidence: SmartImportConfidence;
  source: "filename" | "pdf text" | "inference";
}

export interface SmartPdfImportResult {
  fileName: string;
  readableTextFound: boolean;
  pageCount?: number;
  textSample?: string;
  warnings: string[];
  suggestions: {
    title?: SmartImportSuggestion;
    artist?: SmartImportSuggestion;
    key?: SmartImportSuggestion;
    capo?: SmartImportSuggestion;
    chords?: SmartImportSuggestion;
    strumming?: SmartImportSuggestion;
    tempo?: SmartImportSuggestion;
    duration?: SmartImportSuggestion;
    genre?: SmartImportSuggestion;
    mood?: SmartImportSuggestion;
    energy?: SmartImportSuggestion;
    vocalStyle?: SmartImportSuggestion;
    tags?: SmartImportSuggestion;
    performanceNote?: SmartImportSuggestion;
    ultimateGuitarUrl?: SmartImportSuggestion;
  };
}

const CHORD_TOKEN = /\b[A-G](?:#|b)?(?:(?:maj|min|m|dim|aug|sus|add)\d*|\d{0,2})?(?:\/[A-G](?:#|b)?)?\b/g;
const COMMON_NON_ARTIST_LINES = /^(chords?|tabs?|lyrics?|sheet music|ultimate guitar|transpose|autoscroll|print|report bad tab|author|tuning|difficulty|capo|key|tempo|strumming|verse|chorus|bridge|intro|outro|solo|instrumental)$/i;

function suggestion(value: string | undefined | null, confidence: SmartImportConfidence, source: SmartImportSuggestion["source"]): SmartImportSuggestion | undefined {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  return { value: clean, confidence, source };
}

function titleCase(value: string): string {
  const smallWords = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (/^[A-Z0-9#]+$/.test(word) && word.length <= 4) return word;
      const lower = word.toLowerCase();
      if (index > 0 && smallWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function normalizeName(value: string): string {
  return titleCase(
    value
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[_.]+/g, " ")
      .replace(/[()\[\]{}]/g, " ")
      .replace(/\b(?:chords?|tabs?|lyrics?|sheet\s*music|lead\s*sheet|guitar|piano|ukulele|ultimate\s*guitar|official|version|pdf|print)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function parseFilename(fileName: string): Partial<SmartPdfImportResult["suggestions"]> {
  const raw = fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_.]+/g, " ").replace(/\s+/g, " ").trim();
  const cleaned = normalizeName(fileName);
  const suggestions: Partial<SmartPdfImportResult["suggestions"]> = {};

  const byMatch = raw.match(/^(.+?)\s+by\s+(.+?)$/i);
  if (byMatch) {
    suggestions.title = suggestion(normalizeName(byMatch[1]), "medium", "filename");
    suggestions.artist = suggestion(normalizeName(byMatch[2]), "medium", "filename");
    return suggestions;
  }

  const dashParts = raw.split(/\s+-\s+|\s+–\s+|\s+—\s+/).map(normalizeName).filter(Boolean);
  if (dashParts.length >= 2) {
    // Most music-library filenames are "Artist - Title". The review panel lets the performer correct it quickly.
    suggestions.artist = suggestion(dashParts[0], "medium", "filename");
    suggestions.title = suggestion(dashParts.slice(1).join(" - "), "medium", "filename");
    return suggestions;
  }

  if (cleaned) suggestions.title = suggestion(cleaned, "low", "filename");
  return suggestions;
}

async function extractPdfText(file: File): Promise<{ text: string; pageCount?: number; warnings: string[] }> {
  const warnings: string[] = [];
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

    const data = new Uint8Array(await file.arrayBuffer());
    const document = await pdfjs.getDocument({ data }).promise;
    const maxPages = Math.min(document.numPages, 5);
    const chunks: string[] = [];

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) chunks.push(pageText);
    }

    if (document.numPages > maxPages) {
      warnings.push(`Read the first ${maxPages} pages of ${document.numPages}.`);
    }

    return { text: chunks.join("\n"), pageCount: document.numPages, warnings };
  } catch (error: any) {
    warnings.push(error?.message ? `Could not read PDF text: ${error.message}` : "Could not read PDF text.");
    return { text: "", warnings };
  }
}

function splitLines(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split(/\n| {3,}/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 120);
}

function firstLikelyTitleLine(lines: string[]): string | undefined {
  return lines.find((line) => {
    const clean = line.trim();
    if (clean.length < 2 || clean.length > 80) return false;
    if (COMMON_NON_ARTIST_LINES.test(clean)) return false;
    if (/^(verse|chorus|bridge|intro|outro|solo)\b/i.test(clean)) return false;
    if ((clean.match(CHORD_TOKEN) ?? []).length >= 3) return false;
    return true;
  });
}

function parseTitleArtistFromText(lines: string[]): Partial<SmartPdfImportResult["suggestions"]> {
  const suggestions: Partial<SmartPdfImportResult["suggestions"]> = {};

  for (const line of lines.slice(0, 35)) {
    const ugMatch = line.match(/^(.{2,80}?)\s+(?:chords?|tabs?|lyrics?|sheet music)\s+by\s+(.{2,80})$/i);
    if (ugMatch) {
      suggestions.title = suggestion(normalizeName(ugMatch[1]), "high", "pdf text");
      suggestions.artist = suggestion(normalizeName(ugMatch[2]), "high", "pdf text");
      return suggestions;
    }
  }

  for (const line of lines.slice(0, 35)) {
    const byMatch = line.match(/^(.{2,80}?)\s+by\s+(.{2,80})$/i);
    if (byMatch && !/written|performed|arranged/i.test(line)) {
      suggestions.title = suggestion(normalizeName(byMatch[1]), "medium", "pdf text");
      suggestions.artist = suggestion(normalizeName(byMatch[2]), "medium", "pdf text");
      return suggestions;
    }
  }

  const titleLine = firstLikelyTitleLine(lines.slice(0, 20));
  if (titleLine) suggestions.title = suggestion(normalizeName(titleLine), "low", "pdf text");

  const artistLine = lines.slice(0, 35).find((line) => /^artist\s*[:\-]/i.test(line) || /^by\s+\S/i.test(line));
  if (artistLine) {
    suggestions.artist = suggestion(normalizeName(artistLine.replace(/^artist\s*[:\-]\s*/i, "").replace(/^by\s+/i, "")), "medium", "pdf text");
  }

  return suggestions;
}

function parseKey(text: string): SmartImportSuggestion | undefined {
  const patterns = [
    /(?:^|\b)(?:key|original key|song key)\s*[:\-]\s*([A-G](?:#|b)?\s*(?:major|minor|maj|min|m)?)/im,
    /(?:^|\b)([A-G](?:#|b)?\s*(?:major|minor))\b/im,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return suggestion(match[1].replace(/\s+/g, " "), "high", "pdf text");
  }
  return undefined;
}

function parseCapo(text: string): SmartImportSuggestion | undefined {
  const noCapo = text.match(/\b(?:no\s+capo|capo\s*[:\-]\s*(?:none|no|0))\b/i);
  if (noCapo) return suggestion("No capo", "high", "pdf text");
  const capoMatch = text.match(/\bcapo\s*(?:[:\-]|on|at|fret)?\s*(\d{1,2})(?:st|nd|rd|th)?\s*(?:fret)?\b/i);
  if (capoMatch) return suggestion(`Capo ${Number(capoMatch[1])}`, "high", "pdf text");
  return undefined;
}

function parseStrumming(text: string): SmartImportSuggestion | undefined {
  const match = text.match(/\b(?:strumming|strum(?:ming)? pattern|pattern)\s*[:\-]\s*([^\n]{2,60})/i);
  if (match) return suggestion(match[1].replace(/\s+/g, " "), "medium", "pdf text");
  const downUpLine = splitLines(text).find((line) => /^[DUX\s\-]+$/i.test(line) && /D/i.test(line) && /U/i.test(line));
  return suggestion(downUpLine, "low", "pdf text");
}

function parseTempo(text: string): SmartImportSuggestion | undefined {
  const match = text.match(/\b(?:tempo|bpm)\s*[:\-]?\s*(\d{2,3})\s*(?:bpm)?\b/i) || text.match(/\b(\d{2,3})\s*bpm\b/i);
  if (!match) return undefined;
  const bpm = Number(match[1]);
  if (bpm < 40 || bpm > 240) return undefined;
  return suggestion(String(bpm), "medium", "pdf text");
}

function parseDuration(text: string): SmartImportSuggestion | undefined {
  const labeled = text.match(/\b(?:duration|length|time)\s*[:\-]\s*(\d{1,2}:\d{2})\b/i);
  if (labeled) return suggestion(labeled[1], "medium", "pdf text");
  return undefined;
}

function parseUrl(text: string): SmartImportSuggestion | undefined {
  const match = text.match(/https?:\/\/[^\s)]+/i);
  if (!match) return undefined;
  return suggestion(match[0], match[0].includes("ultimate-guitar") ? "high" : "low", "pdf text");
}

function looksLikeChordLine(line: string): boolean {
  const chordMatches = line.match(CHORD_TOKEN) ?? [];
  if (chordMatches.length >= 2) {
    const nonChord = line.replace(CHORD_TOKEN, "").replace(/[\s|,./\\\-_[\]()]+/g, "");
    return nonChord.length <= Math.max(6, line.length * 0.35);
  }
  if (chordMatches.length === 1 && line.trim().length <= 14) return true;
  return false;
}

function parseChords(text: string): SmartImportSuggestion | undefined {
  const lines = splitLines(text);
  const counts = new Map<string, number>();
  const ordered: string[] = [];

  for (const line of lines) {
    const bracketMatches = Array.from(line.matchAll(/\[([A-G](?:#|b)?(?:(?:maj|min|m|dim|aug|sus|add)\d*|\d{0,2})?(?:\/[A-G](?:#|b)?)?)\]/g)).map((m) => m[1]);
    const directMatches = looksLikeChordLine(line) ? Array.from(line.matchAll(CHORD_TOKEN)).map((m) => m[0]) : [];
    for (const raw of [...bracketMatches, ...directMatches]) {
      const chord = raw.trim();
      if (!chord || chord.length > 12) continue;
      if (!ordered.includes(chord)) ordered.push(chord);
      counts.set(chord, (counts.get(chord) ?? 0) + 1);
    }
  }

  const selected = ordered
    .filter((chord) => (counts.get(chord) ?? 0) >= 1)
    .slice(0, 12);

  if (selected.length >= 3) return suggestion(selected.join(", "), "high", "pdf text");
  if (selected.length > 0) return suggestion(selected.join(", "), "low", "pdf text");
  return undefined;
}

function inferTags(text: string, suggestions: Partial<SmartPdfImportResult["suggestions"]>): SmartImportSuggestion | undefined {
  const tags = new Set<string>(["imported-from-pdf"]);
  const lower = text.toLowerCase();
  if (suggestions.capo?.value && suggestions.capo.value !== "No capo") tags.add("capo");
  if (suggestions.chords?.value) tags.add("chords");
  if (/\b(verse|chorus|bridge)\b/i.test(text)) tags.add("full-chart");
  if (/\bsingalong\b|crowd/i.test(lower)) tags.add("singalong");
  if (/\bacoustic\b/i.test(lower)) tags.add("acoustic");
  if (/\btab\b|tabs/i.test(lower)) tags.add("tab");
  return suggestion(Array.from(tags).join(", "), "medium", "inference");
}

function inferStageNote(fileName: string, result: Partial<SmartPdfImportResult["suggestions"]>, readableTextFound: boolean): SmartImportSuggestion {
  const cues = [
    result.key?.value ? `Key: ${result.key.value}` : undefined,
    result.capo?.value ? result.capo.value : undefined,
    result.chords?.value ? `Chords detected: ${result.chords.value}` : undefined,
  ].filter(Boolean);
  const prefix = readableTextFound ? "Smart PDF import:" : "Smart import from filename only:";
  return {
    value: `${prefix} ${cues.length ? cues.join(" · ") : `review details from ${fileName}`}.`,
    confidence: readableTextFound ? "medium" : "low",
    source: "inference",
  };
}

function inferGenreMood(text: string): Partial<SmartPdfImportResult["suggestions"]> {
  const lower = text.toLowerCase();
  const out: Partial<SmartPdfImportResult["suggestions"]> = {};
  if (/\bworship\b|hymn|praise/.test(lower)) out.genre = suggestion("Worship", "low", "inference");
  else if (/\bcountry\b/.test(lower)) out.genre = suggestion("Country", "low", "inference");
  else if (/\bfolk\b/.test(lower)) out.genre = suggestion("Folk", "low", "inference");
  else if (/\brock\b/.test(lower)) out.genre = suggestion("Rock", "low", "inference");

  if (/\bballad\b/.test(lower)) {
    out.mood = suggestion("emotional", "low", "inference");
    out.energy = suggestion("low", "low", "inference");
  } else if (/\bupbeat\b|driving|fast/.test(lower)) {
    out.mood = suggestion("upbeat", "low", "inference");
    out.energy = suggestion("high", "low", "inference");
  }
  return out;
}

export async function analyzeSongPdf(file: File, _existingSongs: Song[] = []): Promise<SmartPdfImportResult> {
  const filenameSuggestions = parseFilename(file.name);
  const pdfText = await extractPdfText(file);
  const readableTextFound = pdfText.text.trim().length > 40;
  const lines = splitLines(pdfText.text);
  const textSuggestions = readableTextFound ? parseTitleArtistFromText(lines) : {};

  const suggestions: SmartPdfImportResult["suggestions"] = {
    ...filenameSuggestions,
    ...textSuggestions,
  };

  if (readableTextFound) {
    suggestions.key = parseKey(pdfText.text);
    suggestions.capo = parseCapo(pdfText.text);
    suggestions.chords = parseChords(pdfText.text);
    suggestions.strumming = parseStrumming(pdfText.text);
    suggestions.tempo = parseTempo(pdfText.text);
    suggestions.duration = parseDuration(pdfText.text);
    suggestions.ultimateGuitarUrl = parseUrl(pdfText.text);
    Object.assign(suggestions, inferGenreMood(pdfText.text));
  }

  suggestions.tags = inferTags(pdfText.text, suggestions);
  suggestions.performanceNote = inferStageNote(file.name, suggestions, readableTextFound);

  return {
    fileName: file.name,
    readableTextFound,
    pageCount: pdfText.pageCount,
    textSample: pdfText.text.slice(0, 600),
    warnings: pdfText.warnings,
    suggestions,
  };
}

export function confidenceLabel(confidence: SmartImportConfidence): string {
  if (confidence === "high") return "High";
  if (confidence === "medium") return "Medium";
  return "Low";
}
