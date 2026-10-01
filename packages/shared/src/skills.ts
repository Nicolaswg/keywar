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
export const DEFAULT_LOADOUT: [SkillId, SkillId] = ["mixer", "helmet"];
export const AMBULANCE_HEAL = 120;
export const ERASER_CHARGES = 3;
export const OVERTIME_MULT = 2;
/** A player can carry at most this many sabotages at once. */
export const MAX_ACTIVE_SABOTAGES = 2;

export function isValidLoadout(ids: unknown, teamMode: boolean): ids is [SkillId, SkillId] {
  if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1]) return false;
  return ids.every((id) => typeof id === "string" && id in SKILLS && (teamMode || !SKILLS[id as SkillId].teamOnly));
}
