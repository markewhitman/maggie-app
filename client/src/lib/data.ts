// ============================================================
// Maggie App — Static Data Layer
// Built-in catalogue, shared types, and legacy local preference stores.
// Cloud-backed records live in client/src/lib/supabase.ts.
// ============================================================

// ─── Types ────────────────────────────────────────────────

export interface Song {
  id: string;
  title: string;
  artist: string;
  year: number;
  key: string;
  capo: string;
  chords: string;
  strumming: string;
  guitarType: "acoustic" | "electric" | "either";
  tempo: number;
  tempoFeel: string;
  mood: string;
  mood2?: string;
  genre: string;
  genre2?: string;
  decade?: string;        // e.g. "60s", "70s", "80s", "90s", "00s", "10s", "20s"
  energy?: "low" | "medium" | "high";
  vocalStyle?: "storytelling" | "singalong" | "emotional" | "powerful" | "conversational";
  similar?: string[];     // 2-3 similar song titles from the list
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  tags: string[]; // parsed array
  performanceNote: string;
  ultimateGuitarUrl: string;
  setPosition: number;
  duration?: number;      // song duration in seconds (editable, used for runtime calculations)
  pdfUrl?: string;        // Cloud PDF URL (currently Supabase Storage public URL)
  pdfAssetId?: number;    // Legacy asset ID, retained only for older localStorage records
  pdfFilename?: string;   // original filename
  userAdded?: boolean;    // true if user created this song
}

export interface Setlist {
  id: string;
  name: string;
  gigDate?: string;
  gigStartTime?: string;   // "HH:MM" 24h format, e.g. "20:00" for 8:00 PM
  venueId?: string;
  songIds: string[]; // ordered
  createdAt: string;
  audienceSlug?: string;
  requestsEnabled?: boolean;
}

export interface Venue {
  id: string;
  name: string;
  city?: string;
  notes?: string;
  gigCount: number;
  createdAt: string;
}

export interface PerformanceNote {
  id: string;
  setlistId: string;
  songId: string;
  gigDate?: string;
  crowdReaction: number; // 1-5 stars
  tempoFeel: "Dragged" | "Spot-on" | "Rushed" | "";
  lyricsConfidence: "Good" | "Blanked" | "Stumbled" | "";
  notes: string;
  createdAt: string;
}

export interface ShowRecapSongNote {
  songId: string;
  songTitle: string;
  status: "played" | "skipped" | "pending";
  note: string;
}

export interface ShowRecap {
  id: string;
  setlistId: string;
  setlistName: string;
  gigDate?: string;
  startedAt?: string;
  endedAt: string;
  songIds: string[];
  playedIds: string[];
  skippedIds: string[];
  pendingIds: string[];
  totalSongs: number;
  playedCount: number;
  skippedCount: number;
  pendingCount: number;
  timePlayedSeconds: number;
  timeRemainingSeconds: number;
  projectedSetSeconds: number;
  requestsPendingCount: number;
  whatWorked?: string;
  changeNextTime?: string;
  crowdFavorites?: string;
  songNotes: ShowRecapSongNote[];
  createdAt: string;
}

// ─── Duration Helpers ────────────────────────────────────

/** Format seconds as "m:ss" (e.g. 222 → "3:42") */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Format seconds as human-readable string (e.g. 3750 → "1h 2m") */
export function formatDurationLong(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s > 0 ? s + "s" : ""}`.trim();
  return `${s}s`;
}

// ─── Stage Timing Store ─────────────────────────────────────────

/** Persists per-setlist start times and column visibility prefs */
export interface StageTimingPrefs {
  showDuration: boolean;    // column 1: song length
  showCumulative: boolean;  // column 2: running total
  showClock: boolean;       // column 3: predicted wall-clock time
}

export const stageTimingStore = {
  /** Get overridden start time for a setlist ("HH:MM" or null) */
  getStartTime(setlistId: string): string | null {
    return load<string | null>(`maggie_start_${setlistId}`, null);
  },
  setStartTime(setlistId: string, time: string): void {
    save(`maggie_start_${setlistId}`, time);
  },
  clearStartTime(setlistId: string): void {
    try { localStorage.removeItem(`maggie_start_${setlistId}`); } catch {}
  },
  getPrefs(): StageTimingPrefs {
    return load<StageTimingPrefs>("maggie_stage_timing_prefs", {
      showDuration: true,
      showCumulative: true,
      showClock: true,
    });
  },
  savePrefs(prefs: StageTimingPrefs): void {
    save("maggie_stage_timing_prefs", prefs);
  },
};

// ─── Storage Keys ─────────────────────────────────────────

const KEYS = {
  songs: "maggie_songs_v2",
  setlists: "maggie_setlists_v2",
  venues: "maggie_venues_v2",
  perfNotes: "maggie_perf_notes_v2",
  showRecaps: "maggie_show_recaps_v1",
} as const;

// ─── Helpers ──────────────────────────────────────────────

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Seed Data ────────────────────────────────────────────

export const SEED_SONGS: Song[] = [
  { id: "mr-brightside", title: "Mr. Brightside", artist: "The Killers", year: 2003, key: "C# major (Eb major with Capo 2 on D shapes)", capo: "Capo 2", chords: "C, G, Am, F", strumming: "D DU UDU (driving 8th note strum, emphasize 2 and 4)", guitarType: "electric", tempo: 148, tempoFeel: "Up-Tempo", mood: "angsty, dramatic", mood2: "emotional", genre: "Indie Rock", genre2: "alternative", decade: "00s", energy: "high", vocalStyle: "emotional", similar: ["Read My Mind", "A Dustland Fairytale", "Float On"],  difficulty: "Intermediate", tags: ["crowd-pleaser","singalong","indie-rock","2000s"], performanceNote: "Capo 2 and shape chords as C-G-Am-F brings it to the right key; the relentless 8th-note strum is what makes it feel anthemic acoustically.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/the-killers/mr-brightside-chords-202646", setPosition: 1, duration: 222 },
  { id: "brown-eyed-girl", title: "Brown Eyed Girl", artist: "Van Morrison", year: 1967, key: "G major", capo: "No capo", chords: "G, C, D, Em", strumming: "D D U U D U", guitarType: "acoustic", tempo: 149, tempoFeel: "Up-Tempo", mood: "nostalgic, joyful", mood2: "nostalgic", genre: "Rock/Pop", genre2: "folk-rock", decade: "60s", energy: "medium", vocalStyle: "singalong", similar: ["Sweet Caroline", "American Girl", "Love Grows"],  difficulty: "Beginner", tags: ["crowd-pleaser","singalong","classic-rock","beginner-friendly"], performanceNote: "The four chords never change throughout the entire song, making this an ideal first performance piece where all energy can go into feel and singing.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/van-morrison/brown-eyed-girl-chords-819644", setPosition: 2, duration: 185 },
  { id: "uptown-girl", title: "Uptown Girl", artist: "Billy Joel", year: 1983, key: "Bb major (plays as E major shapes with Capo 1)", capo: "Capo 2", chords: "D, Em, F#m, G, A, Bb, Gm, Cm, F", strumming: "D D D D (fast driving downstrokes at 129 BPM)", guitarType: "acoustic", tempo: 129, tempoFeel: "Up-Tempo", mood: "playful, pop", mood2: "uplifting", genre: "Pop/Rock", genre2: "80s-pop", decade: "80s", energy: "high", vocalStyle: "singalong", similar: ["Karma Chameleon", "A Little Respect", "Overkill"],  difficulty: "Intermediate", tags: ["pop","80s","singalong","fun"], performanceNote: "The constant driving downstrokes at this quick tempo are the engine of the song — keep your strumming hand moving steadily and let the chord changes do the work.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/billy-joel/uptown-girl-chords-1", setPosition: 3, duration: 198 },
  { id: "have-you-ever-seen-the-rain", title: "Have You Ever Seen the Rain", artist: "Creedence Clearwater Revival", year: 1971, key: "C major", capo: "No capo", chords: "C, G, Am, F", strumming: "D DU UDU (with walk-down bass run on C)", guitarType: "acoustic", tempo: 118, tempoFeel: "Mid-Tempo", mood: "bittersweet, classic", mood2: "nostalgic", genre: "Country Rock", genre2: "folk-rock", decade: "70s", energy: "medium", vocalStyle: "storytelling", similar: ["Father and Son", "I Got a Name", "American Girl"],  difficulty: "Beginner", tags: ["classic-rock","beginner-friendly","crowd-pleaser","campfire"], performanceNote: "The descending bass walk from C down to Am in the chorus adds a lot of character — even played simply it immediately sounds like the record.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/creedence-clearwater-revival/have-you-ever-seen-the-rain-chords-1", setPosition: 4, duration: 160 },
  { id: "dont-look-back-in-anger", title: "Don't Look Back in Anger", artist: "Oasis", year: 1996, key: "C major", capo: "No capo", chords: "C, G, Am, E7, F, G#dim", strumming: "D D D D U (verse); D D U (on Am and G)", guitarType: "acoustic", tempo: 112, tempoFeel: "Mid-Tempo", mood: "anthemic, nostalgic", mood2: "nostalgic", genre: "Britpop", genre2: "alternative", decade: "90s", energy: "medium", vocalStyle: "singalong", similar: ["Mr. Brightside", "Viva la Vida", "Somewhere Only We Know"],  difficulty: "Intermediate", tags: ["britpop","singalong","90s","crowd-pleaser"], performanceNote: "The G#dim passing chord between Am and G is the song's secret weapon — it's easy to play and gives the progression that unmistakable Oasis tension-release feel.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/oasis/dont-look-back-in-anger-chords-1", setPosition: 5, duration: 254 },
  { id: "somewhere-only-we-know", title: "Somewhere Only We Know", artist: "Keane", year: 2004, key: "A major (with Capo 2 gives B major sound)", capo: "Capo 2", chords: "A, C#m, Bm, E, F#m, D", strumming: "Fingerpicked arpeggio or gentle D DU UDU", guitarType: "acoustic", tempo: 104, tempoFeel: "Mid-Tempo", mood: "wistful, emotional", mood2: "emotional", genre: "Indie Pop", genre2: "indie-rock", decade: "00s", energy: "medium", vocalStyle: "emotional", similar: ["Don't Look Back in Anger", "A Dustland Fairytale", "The Night We Met"],  difficulty: "Intermediate", tags: ["indie","emotional","2000s","singalong"], performanceNote: "Originally a piano song, it translates beautifully to fingerpicked guitar — the A/C# bass note chord is the key detail that keeps the descending feel of the original.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/keane/somewhere-only-we-know-chords-1", setPosition: 6 , duration: 228 },
  { id: "i-got-a-name", title: "I Got a Name", artist: "Jim Croce", year: 1973, key: "E major (Capo 2 on D shapes)", capo: "Capo 2", chords: "D, A, Bm, G, E, F#m, F#", strumming: "Fingerpicked arpeggio (verse); D DU DDU (chorus strum)", guitarType: "acoustic", tempo: 108, tempoFeel: "Mid-Tempo", mood: "warm, storytelling", mood2: "feel-good", genre: "Folk/Country", genre2: "singer-songwriter", decade: "70s", energy: "medium", vocalStyle: "storytelling", similar: ["Father and Son", "Have You Ever Seen the Rain", "The Promise"],  difficulty: "Intermediate", tags: ["folk","70s","storytelling","fingerpicking"], performanceNote: "Jim Croce's signature bass-note fingerpicking pattern gives the verses their rolling momentum — even a simple Travis-pick approximation captures the feel perfectly.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/jim-croce/i-got-a-name-chords-1", setPosition: 7 , duration: 213 },
  { id: "american-girl", title: "American Girl", artist: "Tom Petty", year: 1976, key: "D major", capo: "No capo", chords: "D, E, G, A, Em, Bm", strumming: "D UU DUU D DU (driving syncopated 8th-note strum)", guitarType: "either", tempo: 173, tempoFeel: "Up-Tempo", mood: "driving, euphoric", mood2: "feel-good", genre: "Rock", genre2: "heartland-rock", decade: "70s", energy: "high", vocalStyle: "singalong", similar: ["The Waiting", "Brown Eyed Girl", "Have You Ever Seen the Rain"],  difficulty: "Intermediate", tags: ["classic-rock","driving","70s","crowd-pleaser"], performanceNote: "The non-diatonic E major chord in the verse creates that distinctive tension that makes the return to D feel like a release — it's the harmonic hook of the whole song.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/tom-petty/american-girl-chords-1", setPosition: 8 , duration: 214 },
  { id: "father-and-son", title: "Father and Son", artist: "Cat Stevens", year: 1970, key: "G major", capo: "No capo", chords: "G, D/F#, C, Am, Em, D", strumming: "D D DU (verse); arpeggiated fingerpicking for full arrangement", guitarType: "acoustic", tempo: 99, tempoFeel: "Mid-Tempo", mood: "tender, reflective", mood2: "bittersweet", genre: "Folk/Pop", genre2: "singer-songwriter", decade: "70s", energy: "low", vocalStyle: "storytelling", similar: ["I Got a Name", "Have You Ever Seen the Rain", "She's Always a Woman"],  difficulty: "Intermediate", tags: ["folk","emotional","70s","storytelling"], performanceNote: "The D/F# chord (thumb-fretted low E at 2nd fret) creates a smooth bass-line descent that is central to the song's gentle forward motion — worth the effort to learn.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/cat-stevens/father-and-son-chords-84491", setPosition: 9 , duration: 268 },
  { id: "when-the-stars-go-blue", title: "When the Stars Go Blue", artist: "Ryan Adams", year: 2001, key: "D major (Capo 3 gives F major sound)", capo: "Capo 3", chords: "Am, C, G, D", strumming: "Fingerpicked arpeggio or gentle D DU strum", guitarType: "acoustic", tempo: 88, tempoFeel: "Slow", mood: "longing, cinematic", mood2: "romantic", genre: "Alt-Country", genre2: "country", decade: "00s", energy: "low", vocalStyle: "emotional", similar: ["Romeo and Juliet", "The Night We Met", "A Dustland Fairytale"],  difficulty: "Beginner", tags: ["alt-country","emotional","2000s","slow-burn"], performanceNote: "Four repeating chords with a slow tempo means all the expression comes from dynamics and vocal phrasing — let the chords breathe and resist over-playing.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/ryan-adams/when-the-stars-go-blue-chords-1", setPosition: 10 , duration: 215 },
  { id: "love-grows", title: "Love Grows (Where My Rosemary Goes)", artist: "Edison Lighthouse", year: 1970, key: "A major", capo: "No capo", chords: "A, D, C#m, F#m", strumming: "D D DU UDU (with boogie bass runs on A and D)", guitarType: "acoustic", tempo: 130, tempoFeel: "Mid-Tempo", mood: "joyful, nostalgic", mood2: "uplifting", genre: "Pop", genre2: "soft-rock", decade: "70s", energy: "medium", vocalStyle: "singalong", similar: ["Brown Eyed Girl", "Sweet Caroline", "Uptown Girl"],  difficulty: "Intermediate", tags: ["60s-70s-pop","fun","upbeat","lesser-known"], performanceNote: "The boogie-style bass run alternating between the 2nd and 4th frets of the A string under the chord gives this song its infectious propulsive feel.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/edison-lighthouse/love-grows-where-my-rosemary-goes-chords-1506360", setPosition: 11 , duration: 193 },
  { id: "the-waiting", title: "The Waiting", artist: "Tom Petty", year: 1981, key: "G major", capo: "No capo", chords: "G, G/F#, Asus4, A, D, Bm", strumming: "D DU UDU (or arpeggiated picking in verse)", guitarType: "either", tempo: 138, tempoFeel: "Mid-Tempo", mood: "hopeful, classic-rock", mood2: "feel-good", genre: "Rock", genre2: "heartland-rock", decade: "80s", energy: "high", vocalStyle: "singalong", similar: ["American Girl", "Mr. Brightside", "Don't Look Back in Anger"],  difficulty: "Intermediate", tags: ["classic-rock","80s","tom-petty","singalong"], performanceNote: "The G to G/F# walk-down bass line in the intro is immediately recognizable and gives the song its forward drive — use your thumb on the 2nd fret of the low E for the F#.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/tom-petty/the-waiting-chords-1", setPosition: 12 , duration: 222 },
  { id: "float-on", title: "Float On", artist: "Modest Mouse", year: 2004, key: "F# major (Capo 6 gives open-chord F# feel)", capo: "Capo 6", chords: "C, Em, Am (relative to capo)", strumming: "D D palm-mute D DU UDU", guitarType: "electric", tempo: 104, tempoFeel: "Mid-Tempo", mood: "optimistic, indie", mood2: "uplifting", genre: "Indie Rock", genre2: "alternative", decade: "00s", energy: "medium", vocalStyle: "conversational", similar: ["Mr. Brightside", "She Don't Use Jelly", "Read My Mind"],  difficulty: "Beginner", tags: ["indie","2000s","feel-good","crowd-pleaser"], performanceNote: "Three simple open chords with capo 6 make this deceptively easy — the staccato palm-muting between strums is the key texture that makes it recognizable.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/modest-mouse/float-on-chords-1", setPosition: 13 , duration: 203 },
  { id: "sweet-caroline", title: "Sweet Caroline", artist: "Neil Diamond", year: 1969, key: "B major (Capo 2 with A shapes is easier)", capo: "Capo 2", chords: "A, E, B7 (or B, E, F# without capo)", strumming: "D D D D (quarter-note downstrokes with swing feel)", guitarType: "acoustic", tempo: 124, tempoFeel: "Mid-Tempo", mood: "euphoric, communal", mood2: "anthemic", genre: "Pop", genre2: "classic-rock", decade: "60s", energy: "high", vocalStyle: "singalong", similar: ["Brown Eyed Girl", "Love Grows", "Uptown Girl"],  difficulty: "Beginner", tags: ["crowd-pleaser","singalong","classic","stadium"], performanceNote: "Leave space on the 'bah bah bah' response moments — the audience participation IS the song, so play it confidently and let them fill the room.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/neil-diamond/sweet-caroline-chords-66316", setPosition: 14 , duration: 207 },
  { id: "viva-la-vida", title: "Viva la Vida", artist: "Coldplay", year: 2008, key: "Ab major (Capo 1 with G shapes)", capo: "Capo 1", chords: "C, D, G, Em", strumming: "D D D D U UU D D (palm-muted 16th notes in verse, open strum in chorus)", guitarType: "acoustic", tempo: 138, tempoFeel: "Mid-Tempo", mood: "epic, anthemic", mood2: "bittersweet", genre: "Alternative", genre2: "indie-rock", decade: "00s", energy: "high", vocalStyle: "powerful", similar: ["Don't Look Back in Anger", "Mr. Brightside", "Runaways"],  difficulty: "Beginner", tags: ["2000s","singalong","epic","crowd-pleaser"], performanceNote: "Capo 1 on four simple open chords means all focus goes to dynamics — the contrast between a palm-muted verse and a wide-open strummed chorus is everything.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/coldplay/viva-la-vida-chords-675427", setPosition: 15 , duration: 242 },
  { id: "she-dont-use-jelly", title: "She Don't Use Jelly", artist: "The Flaming Lips", year: 1993, key: "D major", capo: "No capo", chords: "D, C, G, A", strumming: "D DU UDU (loose, slightly shuffled feel)", guitarType: "electric", tempo: 86, tempoFeel: "Slow-Mid", mood: "quirky, indie", mood2: "feel-good", genre: "Indie Rock", genre2: "indie-rock", decade: "90s", energy: "medium", vocalStyle: "conversational", similar: ["Float On", "Overkill", "The Zephyr Song"],  difficulty: "Beginner", tags: ["indie","90s","quirky","fun"], performanceNote: "The chord shapes themselves are completely standard — the song's personality lives entirely in the deadpan delivery and the whimsical lyrics, so play it straight.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/the-flaming-lips/she-dont-use-jelly-chords-1", setPosition: 16 , duration: 203 },
  { id: "karma-chameleon", title: "Karma Chameleon", artist: "Culture Club", year: 1983, key: "Bb major (Capo 3 with G shapes)", capo: "Capo 3", chords: "G, D, C, Am, Em, Bm", strumming: "D D DU D D DU (moderate swing feel)", guitarType: "acoustic", tempo: 96, tempoFeel: "Mid-Tempo", mood: "breezy, nostalgic", mood2: "uplifting", genre: "Pop/New Wave", genre2: "new-wave", decade: "80s", energy: "medium", vocalStyle: "singalong", similar: ["Uptown Girl", "A Little Respect", "Overkill"],  difficulty: "Beginner", tags: ["80s","pop","singalong","fun"], performanceNote: "Capo 3 makes the key comfortable with open chords — the song's charm is its reggae-lite bounce, so keep the strumming light and syncopated rather than heavy.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/culture-club/karma-chameleon-chords-1", setPosition: 17 , duration: 243 },
  { id: "pink-pony-club", title: "Pink Pony Club", artist: "Chappell Roan", year: 2023, key: "F# major (Capo 4 with D shapes)", capo: "Capo 4", chords: "D, Em, Bm, G, A", strumming: "8 downstrokes per chord (driving 8th-note pattern)", guitarType: "acoustic", tempo: 130, tempoFeel: "Mid-Tempo", mood: "celebratory, camp", mood2: "feel-good", genre: "Pop", genre2: "indie-pop", decade: "20s", energy: "high", vocalStyle: "powerful", similar: ["Northern Attitude", "We Hug Now", "Favorite Crime"],  difficulty: "Beginner", tags: ["2020s","pop","fun","modern"], performanceNote: "Capo 4 puts this in a singable key for most voices — the driving eighth-note strum keeps the momentum up and the energy infectious on acoustic.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/chappell-roan/pink-pony-club-chords-1", setPosition: 18 , duration: 228 },
  { id: "the-zephyr-song", title: "The Zephyr Song", artist: "Red Hot Chili Peppers", year: 2002, key: "Am / C major", capo: "No capo", chords: "Am, G, Em, F (verse fingerpicked; chorus uses barre chords D, G, A6)", strumming: "Fingerpicked arpeggio (verse); single strum per chord (chorus)", guitarType: "acoustic", tempo: 96, tempoFeel: "Mid-Tempo", mood: "dreamy, psychedelic", mood2: "feel-good", genre: "Alternative Rock", genre2: "funk-rock", decade: "00s", energy: "medium", vocalStyle: "emotional", similar: ["Scar Tissue", "Float On", "She Don't Use Jelly"],  difficulty: "Intermediate", tags: ["rhcp","2000s","mellow","fingerpicking"], performanceNote: "The fingerpicked triad shapes in the intro and verse are the song's signature — even simplified to open Am, G, Em, F, the melancholic mood transfers perfectly to acoustic.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/red-hot-chili-peppers/the-zephyr-song-chords-1", setPosition: 19 , duration: 249 },
  { id: "romeo-and-juliet", title: "Romeo and Juliet", artist: "Dire Straits", year: 1980, key: "Bb major (Open G tuning, Capo 3)", capo: "Capo 3 (in Open G tuning)", chords: "F, Bb, C, Dm", strumming: "Fingerpicked arpeggio throughout (Knopfler-style)", guitarType: "acoustic", tempo: 112, tempoFeel: "Mid-Tempo", mood: "romantic, bittersweet", mood2: "bittersweet", genre: "Rock/Folk", genre2: "singer-songwriter", decade: "80s", energy: "medium", vocalStyle: "storytelling", similar: ["When the Stars Go Blue", "She's Always a Woman", "The Promise"],  difficulty: "Advanced", tags: ["fingerpicking","80s","romantic","mark-knopfler"], performanceNote: "Originally played on a Dobro in Open G with Capo 3 — the open tuning gives the chord voicings their jangling resonance; simplified to standard tuning with a capo it still shines.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/dire-straits/romeo-and-juliet-chords-1166247", setPosition: 20 , duration: 364 },
  { id: "thinking-out-loud", title: "Thinking Out Loud", artist: "Ed Sheeran", year: 2014, key: "D major", capo: "No capo", chords: "D, D/F#, G, A (verse); Am, G, F, C, Dm (bridge)", strumming: "Slow 6/8 feel; D D U or fingerpicked; laid-back shuffle", guitarType: "acoustic", tempo: 79, tempoFeel: "Slow", mood: "romantic, soulful", mood2: "heartfelt", genre: "Pop/Soul", genre2: "soul", decade: "10s", energy: "medium", vocalStyle: "emotional", similar: ["Can't Help Falling in Love", "I Hope", "Favorite Crime"],  difficulty: "Intermediate", tags: ["romantic","ballad","2010s","slow"], performanceNote: "The D/F# (open D with thumb on 2nd fret low E) is essential to the song's voice-leading smoothness — without it, the chord changes feel abrupt rather than silky.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/ed-sheeran/thinking-out-loud-chords-1", setPosition: 21 , duration: 281 },
  { id: "cant-help-falling-in-love", title: "Can't Help Falling in Love", artist: "Elvis Presley", year: 1961, key: "D major (Capo 2 gives E major sound)", capo: "Capo 2", chords: "C, Em, Am, G, F, D, B7, A7, Dm", strumming: "6 downstrokes per chord (6/8 feel; one-two-three four-five-six)", guitarType: "acoustic", tempo: 65, tempoFeel: "Slow/Waltz", mood: "timeless, romantic", mood2: "heartfelt", genre: "Pop/Classic", genre2: "classic-pop", decade: "60s", energy: "low", vocalStyle: "emotional", similar: ["Thinking Out Loud", "Marie's the Name", "She's Always a Woman"],  difficulty: "Beginner", tags: ["classic","romantic","singalong","crowd-pleaser"], performanceNote: "The 6/8 waltz-like feel requires counting in three, not four — once that rhythmic foundation is in place, the melody and lyrics carry the performance effortlessly.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/elvis-presley/cant-help-falling-in-love-chords-1", setPosition: 22 , duration: 181 },
  { id: "all-too-well", title: "All Too Well", artist: "Taylor Swift", year: 2012, key: "C major", capo: "No capo (Capo 5 version uses G, D, Am, C shapes)", chords: "C, G, Am, F (Csus2, Gsus4 for the Taylor's Version fingering)", strumming: "D DU UDU or gentle fingerpicked arpeggio", guitarType: "acoustic", tempo: 102, tempoFeel: "Mid-Tempo", mood: "heartbroken, cinematic", mood2: "nostalgic", genre: "Country/Pop", genre2: "singer-songwriter", decade: "10s", energy: "medium", vocalStyle: "storytelling", similar: ["Never Grow Up", "The Night We Met", "The Promise"],  difficulty: "Beginner", tags: ["taylor-swift","emotional","singalong","storytelling"], performanceNote: "Taylor plays this live with an impassioned strum that builds through the song — start stripped back and let it swell so the emotional arc lands on the extended bridge.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/taylor-swift/all-too-well-chords-1189554", setPosition: 23 , duration: 327 },
  { id: "a-little-respect", title: "A Little Respect", artist: "Erasure", year: 1988, key: "C major", capo: "No capo", chords: "C, G, E, F, Am, Em", strumming: "D D DU UDU (upbeat 80s synth-pop feel adapted for guitar)", guitarType: "acoustic", tempo: 126, tempoFeel: "Up-Tempo", mood: "pleading, euphoric", mood2: "energetic", genre: "Synth-Pop/Pop", genre2: "synth-pop", decade: "80s", energy: "high", vocalStyle: "emotional", similar: ["Karma Chameleon", "Uptown Girl", "Overkill"],  difficulty: "Intermediate", tags: ["80s","pop","fun","singalong"], performanceNote: "Originally a synth-pop song, it adapts surprisingly well to acoustic guitar — the sus4 chord decorations and the E major chord give it the unexpected emotional lift the song needs.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/erasure/a-little-respect-chords-1", setPosition: 24 , duration: 237 },
  { id: "read-my-mind", title: "Read My Mind", artist: "The Killers", year: 2006, key: "G major (with Capo)", capo: "Capo 2", chords: "C, Am7, Gsus4, G, Fmaj7", strumming: "D DU UDU (bright, driving strum with open string ringing)", guitarType: "acoustic", tempo: 148, tempoFeel: "Up-Tempo", mood: "nostalgic, driving", mood2: "uplifting", genre: "Indie Rock", genre2: "alternative", decade: "00s", energy: "medium", vocalStyle: "storytelling", similar: ["Mr. Brightside", "A Dustland Fairytale", "Somewhere Only We Know"],  difficulty: "Intermediate", tags: ["indie-rock","2000s","killers","singalong"], performanceNote: "Letting the high E and G strings ring open across chord changes is key to capturing the spacious, jangly intro sound that makes this song so immediately recognizable.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/the-killers/read-my-mind-chords-805530", setPosition: 25 , duration: 225 },
  { id: "space-oddity", title: "Space Oddity", artist: "David Bowie", year: 1969, key: "C major", capo: "No capo", chords: "Fmaj7/E, Em, C, Am, D/F#, E7, F, G, Fm, Bb", strumming: "Picking intro (Fmaj7/E - Em pattern); D DU UDU strum in verse/chorus", guitarType: "acoustic", tempo: 136, tempoFeel: "Mid-Tempo", mood: "otherworldly, cinematic", mood2: "nostalgic", genre: "Art Rock", genre2: "classic-rock", decade: "60s", energy: "low", vocalStyle: "storytelling", similar: ["Starman", "Viva la Vida", "A Dustland Fairytale"],  difficulty: "Intermediate", tags: ["bowie","classic","cinematic","storytelling"], performanceNote: "The opening Fmaj7/E to Em fingerpicking figure is iconic and just two shapes — master those four bars and you've captured the song's atmospheric mood immediately.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/david-bowie/space-oddity-chords-105869", setPosition: 26 , duration: 315 },
  { id: "starman", title: "Starman", artist: "David Bowie", year: 1972, key: "F major", capo: "No capo", chords: "Bb, Bbmaj7, Fmaj7, Gm, F, C, C7, Dm, D7, Ab, Bbm", strumming: "D D D D U (verse); D DU UDU (chorus)", guitarType: "acoustic", tempo: 108, tempoFeel: "Mid-Tempo", mood: "dreamy, glam", mood2: "whimsical", genre: "Glam Rock", genre2: "art-rock", decade: "70s", energy: "medium", vocalStyle: "powerful", similar: ["Space Oddity", "Viva la Vida", "Read My Mind"],  difficulty: "Intermediate", tags: ["bowie","glam-rock","70s","singalong"], performanceNote: "The key of F means dealing with some bar chords, but the Bb to Bbmaj7 opener creates an immediately recognizable descending melody that rewards the effort.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/david-bowie/starman-chords-145205", setPosition: 27 , duration: 256 },
  { id: "youve-got-a-friend-in-me", title: "You've Got a Friend in Me", artist: "Randy Newman", year: 1995, key: "Eb major (Capo 3 with C shapes)", capo: "Capo 3", chords: "C, G7, A7, D7, F, E7, Am", strumming: "D DU DU (shuffle/swing feel; jazzy walking bass approach)", guitarType: "acoustic", tempo: 130, tempoFeel: "Mid-Tempo", mood: "warm, playful", mood2: "heartfelt", genre: "Folk/Pop", genre2: "pop", decade: "90s", energy: "low", vocalStyle: "conversational", similar: ["Father and Son", "I Got a Name", "Never Grow Up"],  difficulty: "Intermediate", tags: ["disney","fun","singalong","family-friendly"], performanceNote: "The swing and walking-bass feel of this tune matters more than chord perfection — lean into the shuffle rhythm and let it feel loose and warm like a favorite Disney memory.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/misc-cartoons/toy-story-youve-got-a-friend-in-me-chords-107274", setPosition: 28 , duration: 117 },
  { id: "heres-to-the-night", title: "Here's to the Night", artist: "Eve 6", year: 2000, key: "G major", capo: "No capo", chords: "G, Em, Cadd9, D, Am, Dm", strumming: "D DU UDU (driving, consistent 8th-note strum)", guitarType: "acoustic", tempo: 120, tempoFeel: "Mid-Tempo", mood: "nostalgic, bittersweet", mood2: "bittersweet", genre: "Pop Rock", genre2: "pop-punk", decade: "00s", energy: "medium", vocalStyle: "singalong", similar: ["Somewhere Only We Know", "Float On", "Read My Mind"],  difficulty: "Beginner", tags: ["2000s","pop-rock","nostalgia","singalong"], performanceNote: "The Cadd9 chord instead of a plain C keeps the high strings ringing throughout, giving the song its warm, open-air quality even when played simply.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/eve-6/heres-to-the-night-chords-1", setPosition: 29 , duration: 232 },
  { id: "dustland-fairytale", title: "A Dustland Fairytale", artist: "The Killers", year: 2008, key: "D major", capo: "No capo", chords: "D, A, G, Bm, G/F#, E, A/C#", strumming: "Gentle fingerpicked arpeggio (verse); D DU UDU building to chorus", guitarType: "acoustic", tempo: 72, tempoFeel: "Slow", mood: "epic, melancholic", mood2: "emotional", genre: "Indie Rock", genre2: "alternative", decade: "00s", energy: "medium", vocalStyle: "storytelling", similar: ["Read My Mind", "Mr. Brightside", "Runaways"],  difficulty: "Intermediate", tags: ["killers","emotional","storytelling","2000s"], performanceNote: "The acoustic version especially rewards a restrained start — let the verse breathe with fingerpicking and let the choruses open up to full strumming for maximum emotional impact.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/the-killers/a-dustland-fairytale-chords-1", setPosition: 30 , duration: 257 },
  { id: "the-night-we-met", title: "The Night We Met", artist: "Lord Huron", year: 2015, key: "D minor (Capo 2 gives Em feel with Am shapes)", capo: "Capo 2", chords: "Am, D, G, Em, C (relative to capo)", strumming: "Fingerpicked arpeggio (verse); D DU D strum (chorus)", guitarType: "acoustic", tempo: 78, tempoFeel: "Slow", mood: "haunting, romantic", mood2: "nostalgic", genre: "Indie Folk", genre2: "alternative", decade: "10s", energy: "low", vocalStyle: "emotional", similar: ["When the Stars Go Blue", "All Too Well", "Somewhere Only We Know"],  difficulty: "Beginner", tags: ["indie-folk","emotional","2010s","romantic"], performanceNote: "The beauty of this song is its simplicity — the minor key and slow tempo do all the heavy lifting, so keep picking or strumming restrained and let the vocal melody carry.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/lord-huron/the-night-we-met-chords-1", setPosition: 31 , duration: 192 },
  { id: "shes-always-a-woman", title: "She's Always a Woman", artist: "Billy Joel", year: 1977, key: "Eb major (Capo 3 with C shapes)", capo: "Capo 3", chords: "C, G, Am, F, E7, D7, G7, Dm", strumming: "Fingerpicked: T-1-2-3-2-1 arpeggio pattern throughout", guitarType: "acoustic", tempo: 88, tempoFeel: "Slow", mood: "tender, observational", mood2: "bittersweet", genre: "Pop/Ballad", genre2: "soft-rock", decade: "70s", energy: "low", vocalStyle: "storytelling", similar: ["Father and Son", "Romeo and Juliet", "Summer Highland Falls"],  difficulty: "Intermediate", tags: ["billy-joel","70s","fingerpicking","ballad"], performanceNote: "The song is built around a detailed fingerpicking pattern with the thumb on the bass and three fingers walking 1-2-3-2-1 — that pattern IS the arrangement, not a decoration.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/billy-joel/shes-always-a-woman-chords-583675", setPosition: 32 , duration: 213 },
  { id: "never-grow-up", title: "Never Grow Up", artist: "Taylor Swift", year: 2010, key: "G major", capo: "No capo", chords: "G, C/E, Am, Fmaj7", strumming: "Fingerpicked arpeggio (intro/verse); gentle D DU strum (chorus)", guitarType: "acoustic", tempo: 69, tempoFeel: "Slow", mood: "nostalgic, gentle", mood2: "emotional", genre: "Country/Pop", genre2: "singer-songwriter", decade: "10s", energy: "low", vocalStyle: "storytelling", similar: ["All Too Well", "Father and Son", "The Night We Met"],  difficulty: "Beginner", tags: ["taylor-swift","emotional","gentle","nostalgic"], performanceNote: "The Fmaj7 chord (keeping fingers off to let open strings ring) versus a hard F bar chord is a deliberate, soft-focus choice that suits the song's lullaby-like quality perfectly.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/taylor-swift/never-grow-up-chords-1", setPosition: 33 , duration: 244 },
  { id: "summer-highland-falls", title: "Summer, Highland Falls", artist: "Billy Joel", year: 1976, key: "F major (Capo 1 with E shapes)", capo: "Capo 1", chords: "E, G#m, F#m, A, B (bar chord shapes relative to capo)", strumming: "Arpeggiated fingerpicking throughout (piano vocal style on guitar)", guitarType: "acoustic", tempo: 82, tempoFeel: "Slow", mood: "introspective, melancholic", mood2: "bittersweet", genre: "Piano Rock", genre2: "soft-rock", decade: "70s", energy: "low", vocalStyle: "storytelling", similar: ["She's Always a Woman", "Father and Son", "Romeo and Juliet"],  difficulty: "Advanced", tags: ["billy-joel","deep-cut","emotional","fingerpicking"], performanceNote: "Originally a piano piece with complex chord voicings — the guitar version works best treating each chord as an arpeggio, letting individual notes ring to recreate the cascading piano texture.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/billy-joel/summer-highland-falls-chords-1", setPosition: 34 , duration: 252 },
  { id: "northern-attitude", title: "Northern Attitude", artist: "Noah Kahan (feat. Hozier)", year: 2022, key: "E major (Open D tuning, Capo 1)", capo: "Capo 1 (in Open D tuning: D-A-D-F#-A-D)", chords: "D-shape, G-shape, A-shape (all in Open D tuning relative to capo)", strumming: "Fingerpicked arpeggio (verse); D UDU DUDUx8 fast strum (chorus)", guitarType: "acoustic", tempo: 130, tempoFeel: "Mid-Tempo", mood: "wintry, intense", mood2: "bittersweet", genre: "Indie Folk", genre2: "singer-songwriter", decade: "20s", energy: "medium", vocalStyle: "storytelling", similar: ["Stick Season", "The Night We Met", "Somewhere Only We Know"],  difficulty: "Advanced", tags: ["noah-kahan","2020s","indie-folk","open-tuning"], performanceNote: "Open D tuning with capo 1 is the only way to get the song's specific ringing resonance — the verse fingerpicking pattern with hammer-ons is intricate but very rewarding once learned.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/noah-kahan/northern-attitude-chords-1", setPosition: 35 , duration: 218 },
  { id: "scar-tissue", title: "Scar Tissue", artist: "Red Hot Chili Peppers", year: 1999, key: "F major", capo: "No capo", chords: "F, Dm, C", strumming: "Fingerpicked lead/arpeggio throughout (signature Frusciante style)", guitarType: "acoustic", tempo: 92, tempoFeel: "Slow-Mid", mood: "melancholic, hazy", mood2: "chill", genre: "Alternative Rock", genre2: "funk-rock", decade: "90s", energy: "medium", vocalStyle: "emotional", similar: ["The Zephyr Song", "Float On", "When the Stars Go Blue"],  difficulty: "Intermediate", tags: ["rhcp","90s","fingerpicking","mellow"], performanceNote: "Only three chords, but the fingerpicked lead guitar lines woven around them are what makes the song — even approximating the sliding melodic phrases on the B string transforms it.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/red-hot-chili-peppers/scar-tissue-chords-1", setPosition: 36 , duration: 217 },
  { id: "overkill", title: "Overkill", artist: "Men at Work (Colin Hay acoustic version)", year: 1983, key: "D major (acoustic version; Capo 2 for original key)", capo: "Capo 2", chords: "D, C, G (in Colin Hay's own acoustic arrangement with open-D-influenced voicings)", strumming: "Fingerpicked with alternating bass and palm-muted rhythmic strum", guitarType: "acoustic", tempo: 95, tempoFeel: "Mid-Tempo", mood: "anxious, contemplative", mood2: "melancholic", genre: "Pop/Folk", genre2: "80s-pop", decade: "80s", energy: "medium", vocalStyle: "conversational", similar: ["Karma Chameleon", "A Little Respect", "Here's to the Night"],  difficulty: "Intermediate", tags: ["80s","acoustic","lesser-known-gem","storytelling"], performanceNote: "Colin Hay's solo acoustic version is actually more powerful than the original band arrangement — the stripped-back intimacy suits the song's anxious insomniac lyrics perfectly.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/men-at-work/overkill-chords-1", setPosition: 37 , duration: 228 },
  { id: "maries-the-name", title: "Marie's the Name (His Latest Flame)", artist: "Elvis Presley", year: 1961, key: "G major", capo: "No capo", chords: "G, Em, C, D", strumming: "D D (chuck) D D (chuck) — with rhythmic muted strum ('chuck')", guitarType: "acoustic", tempo: 140, tempoFeel: "Up-Tempo", mood: "rockabilly, breezy", mood2: "heartfelt", genre: "Rockabilly/Pop", genre2: "classic-pop", decade: "60s", energy: "low", vocalStyle: "emotional", similar: ["Can't Help Falling in Love", "Thinking Out Loud", "Love Grows"],  difficulty: "Beginner", tags: ["elvis","50s-60s","rockabilly","fun"], performanceNote: "The 'chuck' mute strum (barely lifting fingers to mute mid-strum) gives this song its rockabilly bounce — four simple chords elevated entirely by the rhythmic feel.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/elvis-presley/maries-the-name-his-latest-flame-chords-1", setPosition: 38 , duration: 146 },
  { id: "stick-season", title: "Stick Season", artist: "Noah Kahan", year: 2022, key: "G major (Capo 2 for original key)", capo: "Capo 2", chords: "G, D, Em, C", strumming: "DD DU DU DD DU DU (fast 16th note pattern at 235 BPM — challenging)", guitarType: "acoustic", tempo: 235, tempoFeel: "Very Fast", mood: "autumnal, nostalgic", mood2: "nostalgic", genre: "Indie Folk", genre2: "singer-songwriter", decade: "20s", energy: "low", vocalStyle: "storytelling", similar: ["Northern Attitude", "The Night We Met", "All Too Well"],  difficulty: "Intermediate", tags: ["noah-kahan","2020s","folk","crowd-pleaser"], performanceNote: "The tempo is genuinely fast at 235 BPM — the four open chords are simple but the 16th-note strumming speed is the challenge; start slow and build up.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/noah-kahan/stick-season-chords-4271572", setPosition: 39 , duration: 200 },
  { id: "i-hope", title: "I Hope", artist: "Gabby Barrett", year: 2019, key: "D major (Capo 4 with Bm shapes, or Capo 6 with Am shapes)", capo: "Capo 4", chords: "Bm, C#m, D, A (Capo 4 version); or Am, C, G, F with Capo 6", strumming: "D DDU DDU (with palm muting on intro)", guitarType: "acoustic", tempo: 90, tempoFeel: "Mid-Tempo", mood: "empowered, country", mood2: "feel-good", genre: "Country/Pop", genre2: "pop", decade: "10s", energy: "medium", vocalStyle: "emotional", similar: ["Thinking Out Loud", "Favorite Crime", "Never Grow Up"],  difficulty: "Beginner", tags: ["country","2010s","upbeat","singalong"], performanceNote: "The palm-muted intro strum that opens up to a full strum on the chorus is an easy arrangement trick that adds a lot of dynamic contrast without requiring advanced technique.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/gabby-barrett/i-hope-chords-1", setPosition: 40 , duration: 232 },
  { id: "favorite-crime", title: "Favorite Crime", artist: "Olivia Rodrigo", year: 2021, key: "A major (Drop D tuning, Capo 2)", capo: "Capo 2 (Drop D tuning — low E tuned down to D)", chords: "G, Em, D, C (in Drop D Capo 2; chord shapes look different due to tuning)", strumming: "Fingerpicked arpeggio throughout (bass note + high string pattern)", guitarType: "acoustic", tempo: 87, tempoFeel: "Slow-Mid", mood: "heartbroken, delicate", mood2: "bittersweet", genre: "Pop/Indie", genre2: "indie-pop", decade: "20s", energy: "low", vocalStyle: "emotional", similar: ["All Too Well", "The Night We Met", "I Hope"],  difficulty: "Intermediate", tags: ["olivia-rodrigo","2020s","emotional","fingerpicking"], performanceNote: "Drop D tuning with Capo 2 allows the low D string to ring open under the progression — that droning bass note is the sonic bed the whole song floats on.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/olivia-rodrigo/favorite-crime-chords-1", setPosition: 41 , duration: 193 },
  { id: "we-hug-now", title: "We Hug Now", artist: "Sydney Rose", year: 2025, key: "C major", capo: "No capo", chords: "C, Am, Am/B, F, Gadd11, C/E", strumming: "Base-top-top picking (3-note pattern) or gentle D D DU strum", guitarType: "acoustic", tempo: 80, tempoFeel: "Slow", mood: "bittersweet, introspective", mood2: "heartfelt", genre: "Indie Pop", genre2: "folk-pop", decade: "20s", energy: "medium", vocalStyle: "conversational", similar: ["Pink Pony Club", "Stick Season", "Northern Attitude"],  difficulty: "Beginner", tags: ["2020s","indie-pop","emotional","modern"], performanceNote: "The Am/B transition chord (keeping B string fingered from Am shape) creates a smooth walking bass line that gives this simple song its unexpected harmonic warmth.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/sydney-rose/we-hug-now-chords-1", setPosition: 42 , duration: 183 },
  { id: "runaways", title: "Runaways", artist: "The Killers", year: 2012, key: "Eb major (Capo 1, easy version with C shapes)", capo: "Capo 1", chords: "C, G, F, Am, Dm, Em", strumming: "D DU UDU (driving synth-pop adapted for guitar)", guitarType: "acoustic", tempo: 128, tempoFeel: "Mid-Tempo", mood: "hopeful, anthemic", mood2: "nostalgic", genre: "Indie Rock", genre2: "alternative", decade: "10s", energy: "high", vocalStyle: "emotional", similar: ["Mr. Brightside", "A Dustland Fairytale", "Viva la Vida"],  difficulty: "Beginner", tags: ["killers","2010s","anthemic","singalong"], performanceNote: "Originally a keyboard-driven track, the chord progression translates cleanly to guitar with Capo 1 — let the open ringing chords fill out the sound where synths originally lived.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/the-killers/runaways-chords-1", setPosition: 43 , duration: 221 },
  { id: "the-promise", title: "The Promise", artist: "Tracy Chapman", year: 1995, key: "C# major (arranged in C major for guitar simplicity)", capo: "No capo (Tracy's recording is in C#; play in C and transpose voice)", chords: "C, C/B, Am, F, G", strumming: "Fingerpicked arpeggio (bass note + melody note style)", guitarType: "acoustic", tempo: 72, tempoFeel: "Slow", mood: "hopeful, intimate", mood2: "heartfelt", genre: "Folk/Pop", genre2: "singer-songwriter", decade: "90s", energy: "low", vocalStyle: "storytelling", similar: ["Father and Son", "Romeo and Juliet", "All Too Well"],  difficulty: "Beginner", tags: ["tracy-chapman","90s","folk","emotional"], performanceNote: "The C/B walking bass (keeping the 3rd fret B as bass while chord changes) is Tracy's signature touch — it makes the progression feel like it's gently pulling you forward.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/tracy-chapman/the-promise-chords-1", setPosition: 44 , duration: 217 },
  { id: "blush", title: "Blush", artist: "Wolf Alice", year: 2013, key: "B minor (electric; simplified acoustic in open position)", capo: "No capo", chords: "Bm, G, A, D (simplified acoustic arrangement from original electric)", strumming: "Gentle fingerpicked intro; building to full D DU UDU strum in heavier sections", guitarType: "acoustic", tempo: 84, tempoFeel: "Slow-Mid", mood: "wistful, indie", mood2: "melancholic", genre: "Indie/Shoegaze", genre2: "shoegaze", decade: "10s", energy: "medium", vocalStyle: "emotional", similar: ["The Night We Met", "Scar Tissue", "Somewhere Only We Know"],  difficulty: "Intermediate", tags: ["indie","2010s","emotional","wolf-alice"], performanceNote: "The quiet guitar twinkles of the intro vs. the shoegaze fuzz of the louder sections translate on acoustic as a soft fingerpick building to a full strum — a natural dynamic arc.", ultimateGuitarUrl: "https://tabs.ultimate-guitar.com/tab/wolf-alice/blush-chords-1", setPosition: 45 , duration: 226 },
];

// ─── Songs Store ──────────────────────────────────────────

export const songsStore = {
  getAll(): Song[] {
    const stored = load<Song[] | null>(KEYS.songs, null);
    if (!stored) {
      // First run — seed with default songs
      save(KEYS.songs, SEED_SONGS);
      return SEED_SONGS;
    }
    return stored;
  },

  upsert(song: Song): void {
    const songs = this.getAll();
    const idx = songs.findIndex((s) => s.id === song.id);
    if (idx >= 0) songs[idx] = song;
    else songs.push(song);
    save(KEYS.songs, songs);
  },

  delete(id: string): void {
    const songs = this.getAll().filter((s) => s.id !== id);
    save(KEYS.songs, songs);
  },

  updatePdf(id: string, pdfUrl: string, pdfAssetId: number, pdfFilename: string): void {
    const songs = this.getAll();
    const song = songs.find((s) => s.id === id);
    if (song) {
      song.pdfUrl = pdfUrl;
      song.pdfAssetId = pdfAssetId;
      song.pdfFilename = pdfFilename;
      save(KEYS.songs, songs);
    }
  },

  removePdf(id: string): void {
    const songs = this.getAll();
    const song = songs.find((s) => s.id === id);
    if (song) {
      delete song.pdfUrl;
      delete song.pdfAssetId;
      delete song.pdfFilename;
      save(KEYS.songs, songs);
    }
  },
};

// ─── Setlists Store ───────────────────────────────────────

export const setlistsStore = {
  getAll(): Setlist[] {
    return load<Setlist[]>(KEYS.setlists, []);
  },

  save(setlist: Setlist): void {
    const setlists = this.getAll();
    const idx = setlists.findIndex((s) => s.id === setlist.id);
    if (idx >= 0) setlists[idx] = setlist;
    else setlists.push(setlist);
    save(KEYS.setlists, setlists);
  },

  create(data: Omit<Setlist, "id" | "createdAt">): Setlist {
    const setlist: Setlist = { ...data, id: uid(), createdAt: new Date().toISOString() };
    const setlists = this.getAll();
    setlists.push(setlist);
    save(KEYS.setlists, setlists);
    return setlist;
  },

  update(id: string, data: Partial<Omit<Setlist, "id" | "createdAt">>): void {
    const setlists = this.getAll();
    const idx = setlists.findIndex((s) => s.id === id);
    if (idx >= 0) setlists[idx] = { ...setlists[idx], ...data };
    save(KEYS.setlists, setlists);
  },

  delete(id: string): void {
    save(KEYS.setlists, this.getAll().filter((s) => s.id !== id));
  },
};

// ─── Venues Store ─────────────────────────────────────────

export const venuesStore = {
  getAll(): Venue[] {
    return load<Venue[]>(KEYS.venues, []);
  },

  create(data: Omit<Venue, "id" | "gigCount" | "createdAt">): Venue {
    const venue: Venue = { ...data, id: uid(), gigCount: 0, createdAt: new Date().toISOString() };
    const venues = this.getAll();
    venues.push(venue);
    save(KEYS.venues, venues);
    return venue;
  },

  update(venue: Venue): void {
    const venues = this.getAll();
    const idx = venues.findIndex((v) => v.id === venue.id);
    if (idx >= 0) venues[idx] = venue;
    save(KEYS.venues, venues);
  },

  incrementGigCount(id: string): void {
    const venues = this.getAll();
    const v = venues.find((v) => v.id === id);
    if (v) { v.gigCount += 1; save(KEYS.venues, venues); }
  },

  delete(id: string): void {
    save(KEYS.venues, this.getAll().filter((v) => v.id !== id));
  },
};

// ─── Performance Notes Store ──────────────────────────────

export const perfNotesStore = {
  getAll(): PerformanceNote[] {
    return load<PerformanceNote[]>(KEYS.perfNotes, []);
  },

  getForSetlist(setlistId: string): PerformanceNote[] {
    return this.getAll().filter((n) => n.setlistId === setlistId);
  },

  getForSong(songId: string): PerformanceNote[] {
    return this.getAll().filter((n) => n.songId === songId);
  },

  upsert(note: PerformanceNote): void {
    const notes = this.getAll();
    const idx = notes.findIndex((n) => n.id === note.id);
    if (idx >= 0) notes[idx] = note;
    else notes.push(note);
    save(KEYS.perfNotes, notes);
  },

  create(data: Omit<PerformanceNote, "id" | "createdAt">): PerformanceNote {
    const note: PerformanceNote = { ...data, id: uid(), createdAt: new Date().toISOString() };
    const notes = this.getAll();
    notes.push(note);
    save(KEYS.perfNotes, notes);
    return note;
  },

  delete(id: string): void {
    save(KEYS.perfNotes, this.getAll().filter((n) => n.id !== id));
  },
};


// ─── Show Recap Store ─────────────────────────────────────

export const showRecapsStore = {
  getAll(): ShowRecap[] {
    return load<ShowRecap[]>(KEYS.showRecaps, []);
  },

  getForSetlist(setlistId: string): ShowRecap[] {
    return this.getAll().filter((recap) => recap.setlistId === setlistId);
  },

  save(recap: ShowRecap): void {
    const recaps = this.getAll();
    const idx = recaps.findIndex((r) => r.id === recap.id);
    if (idx >= 0) recaps[idx] = recap;
    else recaps.unshift(recap);
    save(KEYS.showRecaps, recaps);
  },

  create(data: Omit<ShowRecap, "id" | "createdAt">): ShowRecap {
    const recap: ShowRecap = { ...data, id: uid(), createdAt: new Date().toISOString() };
    const recaps = this.getAll();
    recaps.unshift(recap);
    save(KEYS.showRecaps, recaps);
    return recap;
  },

  delete(id: string): void {
    save(KEYS.showRecaps, this.getAll().filter((recap) => recap.id !== id));
  },
};
