/**
 * Wire contract between client and server. Room state is synced by Colyseus
 * schema (see apps/server/src/rooms/schema.ts); the views below describe that
 * state for the client, and the message maps describe everything else.
 */
import type { Difficulty, Judgement, Lang, ModeId } from "./constants.js";
import type { SkillId } from "./skills.js";

export const ROOM_NAME: Record<ModeId, string> = { duel: "duel", ffa3: "ffa3", team6: "team6", royale: "royale" };

export interface JoinOptions {
  name: string;
  lang: Lang;
  /** Matchmaking only pairs players who picked the same difficulty. */
  difficulty: Difficulty;
  loadout: [SkillId, SkillId];
}

export type MatchPhase = "waiting" | "countdown" | "playing" | "ended";

export interface EffectView {
  skill: SkillId;
  from: string;
  /** Server match-clock ms at which the effect ends. */
  until: number;
}

export interface PlayerView {
  sessionId: string;
  name: string;
  team: number;
  /** 0 = top floor seat, used to place buildings in the town. */
  seat: number;
  hp: number;
  streak: number;
  bestStreak: number;
  ink: number;
  damageDealt: number;
  targetId: string;
  connected: boolean;
  alive: boolean;
  loadout: SkillId[];
  effects: EffectView[];
}

export interface MatchView {
  mode: ModeId;
  lang: Lang;
  difficulty: Difficulty;
  phase: MatchPhase;
  seed: number;
  /** Server epoch ms when match time 0 happens. Set when the countdown starts. */
  startsAt: number;
  players: Map<string, PlayerView>;
  winnerTeam: number;
}

/* ---------- client → server ---------- */
export interface ClientMessages {
  hit: { noteId: number; offset: number };
  holdEnd: { noteId: number; heldMs: number };
  wrong: Record<string, never>;
  skill: { slot: 0 | 1 };
  target: { sessionId: string };
  /** Clock sync: client sends its performance time, server echoes with its own. */
  clock: { c: number };
}

/* ---------- server → client ---------- */
export interface ServerMessages {
  clock: { c: number; s: number };
  judged: { noteId: number; judgement: Judgement; damage: number; targetId: string };
  skillCast: { from: string; to: string; skill: SkillId; blocked: boolean };
  /** A rival's hit landed on someone; drives the "brick falls" animation. */
  damage: { from: string; to: string; amount: number };
  /** You hurt yourself: a note you let pass, or a key with no crate. Only to that player. */
  selfDamage: { amount: number; reason: "miss" | "wrong" };
  /** Your streak swapped one of your tools for a stronger one. Only to that player. */
  skillUpgrade: { slot: 0 | 1; from: SkillId; to: SkillId };
  /** You finished a falling word and won the heal roll. Only sent to the healed player. */
  heal: { amount: number; word: string; perfect: boolean };
  /** Someone was knocked out (by = "" when they left). Drives the overlay feed. */
  knockout: { victim: string; by: string; remaining: number };
}

/* ---------- Twitch chat battles (mode "royale") ---------- */

export type RoyaleRole = "player" | "overlay";

/**
 * WebSocket close codes KeyWar sends on purpose. Kept above 4100: Colyseus
 * owns 4000–4099 (4001 = server shutdown, 4002 = closed with error…).
 */
export const CLOSE_CODES = {
  /** The streamer removed this viewer. */
  kicked: 4100,
  /** The streamer pressed "stop everything": log in again to come back. */
  loggedOut: 4101,
  /** The same viewer opened the battle in another tab. */
  replaced: 4102,
} as const;

export interface RoyaleJoinOptions {
  /** Session token from /auth/twitch/callback (or dev:<name> in dev mode). */
  token: string;
  role: RoyaleRole;
  loadout?: [SkillId, SkillId];
}

/** Lifecycle of a chat battle, on top of the match phases. */
export type RoyaleStage = "registering" | "closed" | "match";

export interface EntrantView {
  login: string;
  displayName: string;
  /** 1-based sign-up order; beyond the cap they sit in the waitlist. */
  order: number;
  connected: boolean;
  /** Seated in the match (decided when the streamer starts). */
  seated: boolean;
}
