/**
 * Keyboard model. Notes target a physical key (KeyboardEvent.code) plus
 * modifiers, so the same chart works for every player; each client labels
 * the key with its own layout.
 */

export type LayoutId = "us" | "es";

export interface KeySlot {
  code: string;
  /** Row 0 = number row, 3 = bottom letter row. */
  row: number;
  /** Centre of the key, in key units (1u = one letter key wide). */
  x: number;
}

const row = (r: number, start: number, codes: string[]): KeySlot[] =>
  codes.map((code, i) => ({ code, row: r, x: start + i + 0.5 }));

const LETTERS_TOP = ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"];
const LETTERS_HOME = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL"];
const LETTERS_BOTTOM = ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM"];
const DIGITS = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"];

/** Physical positions (ISO superset; US boards simply never show IntlBackslash). */
export const KEY_SLOTS: readonly KeySlot[] = [
  ...row(0, 0, ["Backquote", ...DIGITS, "Minus", "Equal"]),
  ...row(1, 1.5, [...LETTERS_TOP, "BracketLeft", "BracketRight"]),
  ...row(2, 1.75, [...LETTERS_HOME, "Semicolon", "Quote", "Backslash"]),
  ...row(3, 1.25, ["IntlBackslash", ...LETTERS_BOTTOM, "Comma", "Period", "Slash"]),
];

export const KEYBOARD_WIDTH_U = 14.5;

export const SLOT_BY_CODE: ReadonlyMap<string, KeySlot> = new Map(KEY_SLOTS.map((s) => [s.code, s]));

/** [unshifted, shifted]. `null` = dead key or key absent on that layout. */
type Legend = readonly [string, string] | null;

const letters = (): Record<string, Legend> => {
  const out: Record<string, Legend> = {};
  for (const code of [...LETTERS_TOP, ...LETTERS_HOME, ...LETTERS_BOTTOM]) {
    const ch = code.slice(3).toLowerCase();
    out[code] = [ch, ch.toUpperCase()];
  }
  return out;
};

export const LAYOUTS: Record<LayoutId, Record<string, Legend>> = {
  us: {
    ...letters(),
    Backquote: ["`", "~"],
    Digit1: ["1", "!"], Digit2: ["2", "@"], Digit3: ["3", "#"], Digit4: ["4", "$"], Digit5: ["5", "%"],
    Digit6: ["6", "^"], Digit7: ["7", "&"], Digit8: ["8", "*"], Digit9: ["9", "("], Digit0: ["0", ")"],
    Minus: ["-", "_"], Equal: ["=", "+"],
    BracketLeft: ["[", "{"], BracketRight: ["]", "}"], Backslash: ["\\", "|"],
    Semicolon: [";", ":"], Quote: ["'", "\""],
    IntlBackslash: null,
    Comma: [",", "<"], Period: [".", ">"], Slash: ["/", "?"],
  },
  es: {
    ...letters(),
    Backquote: ["º", "ª"],
    Digit1: ["1", "!"], Digit2: ["2", "\""], Digit3: ["3", "·"], Digit4: ["4", "$"], Digit5: ["5", "%"],
    Digit6: ["6", "&"], Digit7: ["7", "/"], Digit8: ["8", "("], Digit9: ["9", ")"], Digit0: ["0", "="],
    Minus: ["'", "?"], Equal: ["¡", "¿"],
    BracketLeft: null, // ` ^ dead keys
    BracketRight: ["+", "*"],
    Semicolon: ["ñ", "Ñ"],
    Quote: null, // ´ ¨ dead keys
    Backslash: ["ç", "Ç"],
    IntlBackslash: ["<", ">"],
    Comma: [",", ";"], Period: [".", ":"], Slash: ["-", "_"],
  },
};

export const LAYOUT_FOR_LANG: Record<"es" | "en", LayoutId> = { es: "es", en: "us" };

export interface KeySpec {
  code: string;
  shift: boolean;
  ctrl: boolean;
}

/** What the player sees on the crate, in their own layout. */
export function legendFor(spec: KeySpec, layout: LayoutId): string {
  const legend = LAYOUTS[layout][spec.code];
  if (!legend) return "?";
  return spec.shift ? legend[1] : legend[0];
}

export function isUsable(code: string, layout: LayoutId): boolean {
  return LAYOUTS[layout][code] != null;
}

/** Reverse lookup: character → physical key on a layout (for word bursts). */
export function specForChar(ch: string, layout: LayoutId): KeySpec | null {
  for (const [code, legend] of Object.entries(LAYOUTS[layout])) {
    if (!legend) continue;
    if (legend[0] === ch) return { code, shift: false, ctrl: false };
    if (legend[1] === ch) return { code, shift: true, ctrl: false };
  }
  return null;
}

/**
 * Note tiers, unlocked by tempo phase.
 * 1 home row · 2 every letter · 3 digits + words · 4 punctuation, Shift symbols, holds · 5 Ctrl chords, capitals
 */
export const TIER_KEYS = {
  1: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL", "KeyG", "KeyH"],
  2: [...LETTERS_TOP, ...LETTERS_HOME, ...LETTERS_BOTTOM],
  3: DIGITS,
  4: ["Comma", "Period", "Slash", "Minus", "Equal", "Semicolon", "BracketRight", "Backslash", "IntlBackslash", "Backquote", "Quote", "BracketLeft"],
} as const;

/**
 * Ctrl chords the browser lets us swallow with preventDefault.
 * Ctrl+W / T / N / Q / Tab are owned by the browser and must never appear.
 */
export const SAFE_CTRL_CODES = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyK", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB"] as const;

export function sameKey(a: KeySpec, b: KeySpec): boolean {
  return a.code === b.code && a.shift === b.shift && a.ctrl === b.ctrl;
}
