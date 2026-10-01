/**
 * Wire contract between client and server. Room state is synced by Colyseus
 * schema (see apps/server/src/rooms/schema.ts); the views below describe that
 * state for the client, and the message maps describe everything else.
 */
import type { Difficulty, Judgement, Lang, ModeId } from "./constants.js";
import type { SkillId } from "./skills.js";

export const ROOM_NAME: Record<ModeId, string> = { ffa3: "ffa3", team6: "team6" };

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
}
