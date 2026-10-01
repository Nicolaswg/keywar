/**
 * Twitch chat battles: pure helpers shared by the server (real chat and the
 * dev chat simulator go through the same parser) and covered by tests.
 */

export interface ChatBadges {
  broadcaster?: boolean;
  moderator?: boolean;
}

export interface ChatConfig {
  /** The join command viewers type, e.g. "!keywar". */
  command: string;
}

export const DEFAULT_CHAT_COMMAND = "!keywar";
/** Prefix for streamer/moderator commands: "!kw empezar". */
export const MOD_PREFIX = "!kw";

export type ModAction = "open" | "start" | "close" | "cancel";

export type ChatCommand = { type: "join" } | { type: "mod"; action: ModAction } | null;

const MOD_WORDS: Record<string, ModAction> = {
  abrir: "open",
  open: "open",
  empezar: "start",
  start: "start",
  go: "start",
  cerrar: "close",
  close: "close",
  cancelar: "cancel",
  cancel: "cancel",
};

/** Commands start with "!", one word, letters/digits/_ only, 2–25 chars. */
export function normalizeCommand(raw: string): string {
  const word = raw.trim().toLowerCase().replace(/^!*/, "").replace(/[^a-z0-9_]/g, "").slice(0, 24);
  return word.length >= 2 ? `!${word}` : DEFAULT_CHAT_COMMAND;
}

export function parseChatCommand(text: string, badges: ChatBadges, config: ChatConfig): ChatCommand {
  const words = text.trim().toLowerCase().split(/\s+/);
  const first = words[0] ?? "";
  if (first === normalizeCommand(config.command)) return { type: "join" };
  if (first === MOD_PREFIX && (badges.broadcaster || badges.moderator)) {
    const action = MOD_WORDS[words[1] ?? ""];
    if (action) return { type: "mod", action };
  }
  return null;
}

/**
 * Who plays when the streamer presses start: connected entrants in sign-up
 * order, then connected people from the waitlist fill the empty seats.
 */
export function fillSeats(entrants: readonly string[], waitlist: readonly string[], connected: ReadonlySet<string>, max: number): string[] {
  const seats: string[] = [];
  for (const login of [...entrants, ...waitlist]) {
    if (seats.length >= max) break;
    if (connected.has(login) && !seats.includes(login)) seats.push(login);
  }
  return seats;
}
