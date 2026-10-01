/** Game rules shared by client and server. Change a number here and both sides follow. */

export type Lang = "es" | "en";
export const LANGS: readonly Lang[] = ["es", "en"];

export type ModeId = "duel" | "ffa3" | "team6" | "royale";

export interface ModeDef {
  id: ModeId;
  /** Seats in the room. Matchmade modes start when they are all taken. */
  players: number;
  /** Number of teams. In free-for-all modes every player is their own team. */
  teams: number;
  /**
   * How targets are chosen.
   * - healthiest: hit the healthiest enemy; Tab switches. Fine for 3–6 players.
   * - ring: a shuffled chain where everyone attacks the next player and is
   *   attacked by exactly one; a knocked-out player's target passes to their
   *   attacker. Keeps 100 players from piling onto one.
   */
  targeting: "healthiest" | "ring";
}

export const MODES: Record<ModeId, ModeDef> = {
  duel: { id: "duel", players: 2, teams: 2, targeting: "healthiest" },
  ffa3: { id: "ffa3", players: 3, teams: 3, targeting: "healthiest" },
  team6: { id: "team6", players: 6, teams: 2, targeting: "healthiest" },
  royale: { id: "royale", players: 100, teams: 100, targeting: "ring" },
};

/** Twitch chat battles: the streamer starts whenever at least minPlayers are in. */
export const ROYALE = {
  maxPlayers: 100,
  minPlayers: 2,
} as const;

export const MATCH = {
  /** Total match length. When it runs out, the most HP standing wins. */
  durationMs: 180_000,
  /** Countdown shown once the room is full, before the first note. */
  countdownMs: 5_000,
  /** Seconds a full room waits on the results screen before closing. */
  resultsMs: 15_000,
  maxHp: 1000,
  /** Reconnection grace if a player drops mid-match. */
  reconnectSeconds: 20,
} as const;

/**
 * Difficulty picks the whole rhythm of a room: tempo, how dense the notes
 * are, how long a crate takes to fall, how forgiving the timing is and how
 * hard each hit lands. Players only ever meet others on the same difficulty.
 */
export type Difficulty = "easy" | "normal" | "expert";
export const DIFFICULTY_IDS: readonly Difficulty[] = ["easy", "normal", "expert"];

/**
 * Tempo phases. Every phase raises BPM, unlocks harder notes and shortens
 * the time a crate takes to fall (approachMs). The last one is sudden death.
 */
export interface TempoPhase {
  id: number;
  name: { es: string; en: string };
  startMs: number;
  bpm: number;
  approachMs: number;
  damageScale: number;
  /** Highest note tier that can spawn in this phase (see keys.ts tiers). */
  maxTier: number;
  /** Chance per slot that a note spawns. */
  density: number;
  /** 1 = notes only on beats (quarter notes), 2 = also between beats (eighths). */
  subdivision: 1 | 2;
}

/** Timing windows, in ms either side of the note time. */
export interface JudgeWindows {
  perfect: number;
  great: number;
  good: number;
  /** A note nobody hit becomes a miss this long after its time. */
  missAfter: number;
}

export interface DifficultyDef {
  id: Difficulty;
  name: { es: string; en: string };
  blurb: { es: string; en: string };
  phases: readonly TempoPhase[];
  judge: JudgeWindows;
  /** Scales every hit so matches last ~2:30 whatever the note density. */
  damageMult: number;
  /** HP you lose for every note you let pass. */
  missDamage: number;
}

const PHASE_NAMES = [
  { es: "Calentamiento", en: "Warm-up" },
  { es: "Hora punta", en: "Rush hour" },
  { es: "Obras", en: "Roadworks" },
  { es: "Muerte súbita", en: "Sudden death" },
] as const;
const PHASE_STARTS = [0, 45_000, 90_000, 150_000] as const;
const PHASE_DAMAGE = [1, 1, 1.25, 2] as const;

type PhaseRow = [bpm: number, approachMs: number, maxTier: number, density: number, subdivision: 1 | 2];
const phases = (rows: [PhaseRow, PhaseRow, PhaseRow, PhaseRow]): TempoPhase[] =>
  rows.map(([bpm, approachMs, maxTier, density, subdivision], id) => ({
    id,
    name: PHASE_NAMES[id]!,
    startMs: PHASE_STARTS[id]!,
    damageScale: PHASE_DAMAGE[id]!,
    bpm,
    approachMs,
    maxTier,
    density,
    subdivision,
  }));

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  // ~0.5 → 1 note per second, never two notes in one beat, no Ctrl chords.
  easy: {
    id: "easy",
    name: { es: "Tranquilo", en: "Chill" },
    blurb: { es: "Para empezar: lento y con mucho margen", en: "To start: slow, with lots of margin" },
    phases: phases([
      [70, 2800, 1, 0.45, 1],
      [75, 2600, 2, 0.5, 1],
      [85, 2400, 3, 0.55, 1],
      [95, 2200, 4, 0.6, 1],
    ]),
    judge: { perfect: 60, great: 120, good: 180, missAfter: 210 },
    damageMult: 1.5,
    missDamage: 4,
  },
  // ~0.6 → 1.7 notes per second; eighth notes only in sudden death.
  normal: {
    id: "normal",
    name: { es: "Normal", en: "Normal" },
    blurb: { es: "Una tecla por tiempo, se acelera al final", en: "One key per beat, speeds up at the end" },
    phases: phases([
      [80, 2400, 1, 0.45, 1],
      [90, 2200, 3, 0.5, 1],
      [100, 2000, 4, 0.55, 1],
      [110, 1700, 5, 0.45, 2],
    ]),
    judge: { perfect: 50, great: 100, good: 150, missAfter: 180 },
    damageMult: 0.85,
    missDamage: 5,
  },
  // ~1.1 → 2.6 notes per second, eighth notes throughout, tight timing.
  expert: {
    id: "expert",
    name: { es: "Experto", en: "Expert" },
    blurb: { es: "Rápido, todo el teclado y timing estricto", en: "Fast, the whole keyboard, strict timing" },
    phases: phases([
      [100, 1700, 2, 0.55, 2],
      [120, 1500, 3, 0.62, 2],
      [140, 1300, 4, 0.66, 2],
      [160, 1100, 5, 0.7, 2],
    ]),
    judge: { perfect: 40, great: 80, good: 120, missAfter: 140 },
    damageMult: 0.17,
    missDamage: 3,
  },
};

export function isDifficulty(v: unknown): v is Difficulty {
  return typeof v === "string" && (DIFFICULTY_IDS as readonly string[]).includes(v);
}

export function phaseAt(matchMs: number, difficulty: Difficulty = "normal"): TempoPhase {
  const list = DIFFICULTIES[difficulty].phases;
  let current = list[0]!;
  for (const p of list) if (matchMs >= p.startMs) current = p;
  return current;
}

export function judgeWindows(difficulty: Difficulty = "normal"): JudgeWindows {
  return DIFFICULTIES[difficulty].judge;
}

export type Judgement = "perfect" | "great" | "good" | "miss";

/**
 * Base damage per hit, before streak multiplier and phase scaling.
 * Tuned so a strong typist alone needs ~1 minute to knock down an idle
 * building: a 3-minute match stays a fight, not a race.
 */
export const DAMAGE: Record<Exclude<Judgement, "miss">, number> = {
  perfect: 6,
  great: 4,
  good: 2,
};

/** Extra damage for notes that need a modifier (Shift / Ctrl). */
export const CHORD_BONUS = 1.5;
/** Bonus damage when every letter of a word burst lands. */
export const WORD_BONUS = 12;

/**
 * Finishing a whole falling word (every letter hit) may also heal you.
 * Cleaner words heal more often: all letters "perfect" beats a sloppy finish.
 */
export const WORD_HEAL = {
  /** Chance to heal when the word is completed with any mix of hits. */
  chance: 0.4,
  /** Chance when every letter was "perfect". */
  perfectChance: 0.75,
  /** HP restored per letter of the word ("casa" → 40). */
  perLetter: 10,
} as const;
/** Pressing a key with no note under it hurts you and breaks the streak. */
export const WRONG_KEY_SELF_DAMAGE = 2;

/** Streak → multiplier, Guitar Hero style. */
export const MULTIPLIER_STEPS = [
  { streak: 0, mult: 1 },
  { streak: 5, mult: 2 },
  { streak: 15, mult: 3 },
  { streak: 30, mult: 4 },
] as const;

export function multiplierFor(streak: number): number {
  let m = 1;
  for (const s of MULTIPLIER_STEPS) if (streak >= s.streak) m = s.mult;
  return m;
}

/** Ink fuels skills. It is earned by clean typing. */
export const INK = {
  max: 100,
  perfect: 5,
  great: 2,
  /** Bonus every time the streak crosses a multiple of this. */
  streakEvery: 25,
  streakBonus: 15,
} as const;

/**
 * Keys the chart never uses, because they drive the game itself.
 * Matching is by KeyboardEvent.code (physical key).
 */
export const CONTROL_KEYS = {
  skill1: "Space",
  skill2: "Enter",
  cycleTarget: "Tab",
  menu: "Escape",
} as const;
