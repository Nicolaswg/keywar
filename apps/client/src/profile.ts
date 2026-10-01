import { DEFAULT_LOADOUT, type Difficulty, type Lang, type ModeId, type SkillId } from "@keywar/shared";

export interface Profile {
  name: string;
  lang: Lang;
  mode: ModeId;
  difficulty: Difficulty;
  loadout: [SkillId, SkillId];
  /** Audio/input calibration in ms. Positive = you press late. */
  inputOffsetMs: number;
}

const KEY = "keywar.profile";

const defaults = (): Profile => ({
  name: "",
  lang: navigator.language?.toLowerCase().startsWith("es") ? "es" : "en",
  mode: "ffa3",
  difficulty: "normal",
  loadout: DEFAULT_LOADOUT,
  inputOffsetMs: 0,
});

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults(), ...(JSON.parse(raw) as Partial<Profile>) } : defaults();
  } catch {
    return defaults();
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: the profile just won't persist */
  }
}
