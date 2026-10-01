import { MATCH, phaseAt, type Difficulty, type Lang } from "./constants.js";
import { LAYOUT_FOR_LANG, SAFE_CTRL_CODES, TIER_KEYS, isUsable, specForChar, type KeySpec } from "./keys.js";
import { createRng, type Rng } from "./rng.js";
import { WORDS } from "./words.js";

export type NoteKind = "tap" | "hold";

export interface Note {
  id: number;
  /** Time the note crosses the hit line, ms from match start. */
  t: number;
  key: KeySpec;
  kind: NoteKind;
  /** Hold notes: how long the key must stay down. */
  holdMs?: number;
  /** Word bursts: the notes of one word share an id and know their word. */
  wordId?: number;
  word?: string;
  tier: number;
}

/** Silence before the first note so players can find the home row. */
export const LEAD_IN_MS = 2_000;

/**
 * Builds the whole match chart from a seed. The server picks the seed and
 * shares it; every client regenerates the identical chart locally, so the
 * chart itself never travels over the network.
 */
export function generateChart(seed: number, lang: Lang, difficulty: Difficulty = "normal", durationMs: number = MATCH.durationMs): Note[] {
  const rng = createRng(seed);
  const layout = LAYOUT_FOR_LANG[lang];
  const notes: Note[] = [];
  let id = 0;
  let wordId = 0;

  const pool = (codes: readonly string[]) => codes.filter((c) => isUsable(c, layout));
  const tier1 = pool(TIER_KEYS[1]);
  const tier2 = pool(TIER_KEYS[2]);
  const tier3 = pool(TIER_KEYS[3]);
  const tier4 = pool(TIER_KEYS[4]);
  const words = WORDS[lang].filter((w) => [...w].every((ch) => specForChar(ch, layout)));

  // Notes only ever land on the same grid the music plays, so they never drift from the beat.
  const slots = beatGrid(difficulty, durationMs - 1_000).filter((g) => g.beat || phaseAt(g.t, difficulty).subdivision === 2);
  const push = (n: Omit<Note, "id">) => notes.push({ id: id++, ...n });

  let i = 0;
  while (i < slots.length) {
    const t = slots[i]!.t;
    const phase = phaseAt(t, difficulty);
    if (!rng.chance(phase.density)) {
      i++;
      continue;
    }

    const tier = 1 + rng.int(phase.maxTier);

    if (tier === 3 && words.length && rng.chance(0.45)) {
      const word = rng.pick(words);
      if (i + word.length > slots.length) break;
      const wid = wordId++;
      [...word].forEach((ch, k) => push({ t: slots[i + k]!.t, key: specForChar(ch, layout)!, kind: "tap", wordId: wid, word, tier }));
      i += word.length + 1; // breathing room after a word
      continue;
    }

    if (tier === 4 && rng.chance(0.25) && i + 3 < slots.length) {
      const span = 1 + rng.int(2);
      push({ t, key: plain(rng.pick(tier2)), kind: "hold", holdMs: slots[i + span]!.t - t, tier });
      i += span + 2;
      continue;
    }

    push({ t, key: keyForTier(tier, rng, { tier1, tier2, tier3, tier4 }), kind: "tap", tier });
    i++;
  }

  return notes;
}

const plain = (code: string): KeySpec => ({ code, shift: false, ctrl: false });

function keyForTier(
  tier: number,
  rng: Rng,
  pools: { tier1: string[]; tier2: string[]; tier3: string[]; tier4: string[] },
): KeySpec {
  switch (tier) {
    case 1:
      return plain(rng.pick(pools.tier1));
    case 2:
      return plain(rng.pick(pools.tier2));
    case 3:
      return plain(rng.pick(pools.tier3));
    case 4:
      return { code: rng.pick(pools.tier4), shift: rng.chance(0.4), ctrl: false };
    default:
      return rng.chance(0.5)
        ? { code: rng.pick(SAFE_CTRL_CODES), shift: false, ctrl: true }
        : { code: rng.pick(pools.tier2), shift: true, ctrl: false };
  }
}

/**
 * The eighth-note grid the chart is laid on, as [time, isBeat] pairs.
 * The client's placeholder beat plays on it until real tracks exist.
 */
export function beatGrid(difficulty: Difficulty = "normal", durationMs: number = MATCH.durationMs): { t: number; beat: boolean; bar: boolean }[] {
  const out: { t: number; beat: boolean; bar: boolean }[] = [];
  let t = LEAD_IN_MS;
  let i = 0;
  while (t < durationMs) {
    out.push({ t: Math.round(t), beat: i % 2 === 0, bar: i % 8 === 0 });
    t += 60_000 / phaseAt(t, difficulty).bpm / 2;
    i++;
  }
  return out;
}
