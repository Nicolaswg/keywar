/**
 * Skills ("herramientas de obra"). Bought with ink, fired with Space (slot 1)
 * or Enter (slot 2). Sabotage hits your current target; support hits you or a
 * teammate. Every sabotage must keep the lane readable for a strong typist:
 * it slows you down, it never makes a note impossible.
 */

export type SkillId =
  | "mixer"
  | "crane"
  | "mirror"
  | "blackout"
  | "caps"
  | "quake"
  | "helmet"
  | "eraser"
  | "overtime"
  | "ambulance";

export type SkillKind = "sabotage" | "self" | "team";

export interface SkillDef {
  id: SkillId;
  kind: SkillKind;
  name: { es: string; en: string };
  /** Short label the HUD prints on the sign. */
  blurb: { es: string; en: string };
  cost: number;
  durationMs: number;
  cooldownMs: number;
  /** Team skills only exist in team modes. */
  teamOnly?: boolean;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  mixer: {
    id: "mixer", kind: "sabotage", cost: 40, durationMs: 4_000, cooldownMs: 8_000,
    name: { es: "Hormigonera", en: "Cement mixer" },
    blurb: { es: "Vierte cemento sobre una franja de su carril", en: "Pours cement over a band of their lane" },
  },
  crane: {
    id: "crane", kind: "sabotage", cost: 45, durationMs: 5_000, cooldownMs: 10_000,
    name: { es: "Grúa turbo", en: "Turbo crane" },
    blurb: { es: "Sus cajas caen un 40 % más rápido", en: "Their crates fall 40% faster" },
  },
  mirror: {
    id: "mirror", kind: "sabotage", cost: 35, durationMs: 5_000, cooldownMs: 9_000,
    name: { es: "Escaparate", en: "Shop window" },
    blurb: { es: "Las letras se ven en espejo", en: "Legends render mirrored" },
  },
  blackout: {
    id: "blackout", kind: "sabotage", cost: 50, durationMs: 4_000, cooldownMs: 12_000,
    name: { es: "Apagón", en: "Blackout" },
    blurb: { es: "Las cajas desaparecen antes de llegar", en: "Crates vanish before they land" },
  },
  caps: {
    id: "caps", kind: "sabotage", cost: 60, durationMs: 6_000, cooldownMs: 14_000,
    name: { es: "Letrero en mayúsculas", en: "All-caps sign" },
    blurb: { es: "Sus letras piden Shift", en: "Their letters need Shift" },
  },
  quake: {
    id: "quake", kind: "sabotage", cost: 30, durationMs: 4_000, cooldownMs: 8_000,
    name: { es: "Martillo neumático", en: "Jackhammer" },
    blurb: { es: "Su edificio tiembla", en: "Their building shakes" },
  },
  helmet: {
    id: "helmet", kind: "self", cost: 30, durationMs: 15_000, cooldownMs: 15_000,
    name: { es: "Casco", en: "Hard hat" },
    blurb: { es: "Bloquea el próximo sabotaje", en: "Blocks the next sabotage" },
  },
  eraser: {
    id: "eraser", kind: "self", cost: 35, durationMs: 10_000, cooldownMs: 15_000,
    name: { es: "Goma", en: "Eraser" },
    blurb: { es: "3 fallos sin perder la racha", en: "3 misses without losing the streak" },
  },
  overtime: {
    id: "overtime", kind: "self", cost: 70, durationMs: 8_000, cooldownMs: 20_000,
    name: { es: "Turno doble", en: "Overtime" },
    blurb: { es: "Daño x2 durante 8 s", en: "Double damage for 8 s" },
  },
  ambulance: {
    id: "ambulance", kind: "team", cost: 60, durationMs: 0, cooldownMs: 20_000, teamOnly: true,
    name: { es: "Ambulancia", en: "Ambulance" },
    blurb: { es: "Cura 120 al compañero más herido", en: "Heals the most hurt teammate 120" },
  },
};

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];
export const DEFAULT_LOADOUT: [SkillId, SkillId] = ["quake", "helmet"];

/* ---------------- random tools that grow with your streak ---------------- */

/**
 * Nobody picks tools: everyone starts with one random attack (slot 0, Space)
 * and one random support tool (slot 1, Enter) from tier 1. Every
 * TOOL_ROTATE_EVERY hits (a streak is not required) one slot, alternating,
 * rotates to another random tool; the current streak decides its tier.
 */
export const SKILL_TIERS: { attack: SkillId[][]; support: SkillId[][]; teamSupport: SkillId[][] } = {
  attack: [["quake", "mirror"], ["mixer", "crane", "blackout"], ["caps"]],
  support: [["helmet", "eraser"], ["overtime"], ["overtime"]],
  teamSupport: [["helmet", "eraser"], ["overtime"], ["ambulance"]],
};

/** Hits (not necessarily in a row) between tool rotations. */
export const TOOL_ROTATE_EVERY = 10;

/** Streak needed for each tool tier when rotating: tier 2 from 10, tier 3 from 20. */
export function tierForStreak(streak: number) {
  return streak >= 20 ? 2 : streak >= 10 ? 1 : 0;
}

/** Tool level from the current streak: 1 → 2 at 10 → 3 at 20. Breaking the streak drops it back. */
export const SKILL_LEVEL_STREAKS = [0, 10, 20] as const;
/** Per level: effect duration multiplier and ink cost multiplier. */
export const SKILL_LEVELS = [
  { duration: 1, cost: 1 },
  { duration: 1.5, cost: 0.8 },
  { duration: 2, cost: 0.6 },
] as const;

export function skillLevel(streak: number): 1 | 2 | 3 {
  return streak >= SKILL_LEVEL_STREAKS[2] ? 3 : streak >= SKILL_LEVEL_STREAKS[1] ? 2 : 1;
}

export function skillCost(id: SkillId, streak: number) {
  return Math.round(SKILLS[id].cost * SKILL_LEVELS[skillLevel(streak) - 1]!.cost);
}

export function skillDuration(id: SkillId, streak: number) {
  return Math.round(SKILLS[id].durationMs * SKILL_LEVELS[skillLevel(streak) - 1]!.duration);
}

const pick = <T>(items: readonly T[], random: () => number) => items[Math.floor(random() * items.length)]!;

export function randomLoadout(random: () => number, teamMode: boolean): [SkillId, SkillId] {
  const support = teamMode ? SKILL_TIERS.teamSupport : SKILL_TIERS.support;
  return [pick(SKILL_TIERS.attack[0]!, random), pick(support[0]!, random)];
}

/**
 * The tool that replaces `current` in `slot`: a random one from tier `tier`
 * (0-based, see tierForStreak), never the same tool, never a duplicate of
 * the other slot; falls back to lower tiers when that one has nothing new.
 */
export function rerollSkill(slot: 0 | 1, current: SkillId, other: SkillId, tier: number, random: () => number, teamMode: boolean): SkillId {
  const tiers = slot === 0 ? SKILL_TIERS.attack : teamMode ? SKILL_TIERS.teamSupport : SKILL_TIERS.support;
  const top = Math.min(tiers.length - 1, tier);
  // Prefer the highest unlocked tier; fall back downwards if it has nothing new.
  for (let tier = top; tier >= 0; tier--) {
    const options = tiers[tier]!.filter((id) => id !== current && id !== other);
    if (options.length) return pick(options, random);
  }
  return current;
}

export const AMBULANCE_HEAL = 120;
export const ERASER_CHARGES = 3;
export const OVERTIME_MULT = 2;
/** A player can carry at most this many sabotages at once. */
export const MAX_ACTIVE_SABOTAGES = 2;

export function isValidLoadout(ids: unknown, teamMode: boolean): ids is [SkillId, SkillId] {
  if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1]) return false;
  return ids.every((id) => typeof id === "string" && id in SKILLS && (teamMode || !SKILLS[id as SkillId].teamOnly));
}
