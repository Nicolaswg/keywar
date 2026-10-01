import { CHORD_BONUS, DAMAGE, INK, judgeWindows, multiplierFor, type Difficulty, type Judgement } from "./constants.js";
import type { Note } from "./chart.js";

/** offset = press time − note time (ms). Negative = early. */
export function judge(offset: number, difficulty: Difficulty = "normal"): Judgement {
  const w = judgeWindows(difficulty);
  const a = Math.abs(offset);
  if (a <= w.perfect) return "perfect";
  if (a <= w.great) return "great";
  if (a <= w.good) return "good";
  return "miss";
}

export interface DamageInput {
  judgement: Judgement;
  note: Pick<Note, "key" | "kind">;
  /** Streak *after* this hit. */
  streak: number;
  phaseScale: number;
  /** Extra multiplier from skills (Overtime). */
  bonusMult?: number;
}

export function damageFor({ judgement, note, streak, phaseScale, bonusMult = 1 }: DamageInput): number {
  if (judgement === "miss") return 0;
  const chord = note.key.shift || note.key.ctrl ? CHORD_BONUS : 1;
  const hold = note.kind === "hold" ? 1.5 : 1;
  return Math.round(DAMAGE[judgement] * chord * hold * multiplierFor(streak) * phaseScale * bonusMult);
}

export function inkFor(judgement: Judgement, streakBefore: number, streakAfter: number): number {
  let ink = judgement === "perfect" ? INK.perfect : judgement === "great" ? INK.great : 0;
  if (Math.floor(streakAfter / INK.streakEvery) > Math.floor(streakBefore / INK.streakEvery)) ink += INK.streakBonus;
  return ink;
}
