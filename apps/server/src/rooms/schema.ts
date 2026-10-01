import { schema, t, type SchemaType } from "@colyseus/schema";

export const Effect = schema(
  {
    skill: t.string(),
    from: t.string(),
    /** Match-clock ms at which the effect ends. */
    until: t.number(),
  },
  "Effect",
);
export type Effect = SchemaType<typeof Effect>;

export const Player = schema(
  {
    sessionId: t.string(),
    name: t.string(),
    team: t.uint8(),
    seat: t.uint8(),
    hp: t.int16(),
    streak: t.uint16(),
    bestStreak: t.uint16(),
    ink: t.uint8(),
    damageDealt: t.uint32(),
    targetId: t.string(),
    connected: t.boolean(),
    alive: t.boolean(),
    loadout: t.array("string"),
    effects: t.array(Effect),
  },
  "Player",
);
export type Player = SchemaType<typeof Player>;

export const MatchState = schema(
  {
    mode: t.string(),
    lang: t.string(),
    difficulty: t.string(),
    phase: t.string(),
    seed: t.uint32(),
    startsAt: t.number(),
    players: t.map(Player),
    /** -1 while undecided; for a draw the team with most damage dealt wins. */
    winnerTeam: t.int8(),
  },
  "MatchState",
);
export type MatchState = SchemaType<typeof MatchState>;

export const Entrant = schema(
  {
    login: t.string(),
    displayName: t.string(),
    /** 1-based sign-up order; past the cap they are in the waitlist. */
    order: t.uint16(),
    connected: t.boolean(),
    seated: t.boolean(),
  },
  "Entrant",
);
export type Entrant = SchemaType<typeof Entrant>;

/** A Twitch chat battle: the match fields plus registration. */
export const RoyaleState = schema(
  {
    mode: t.string(),
    lang: t.string(),
    difficulty: t.string(),
    phase: t.string(),
    seed: t.uint32(),
    startsAt: t.number(),
    players: t.map(Player),
    winnerTeam: t.int16(),
    channel: t.string(),
    channelName: t.string(),
    /** registering → closed → match. */
    stage: t.string(),
    command: t.string(),
    maxPlayers: t.uint8(),
    entrants: t.array(Entrant),
    remaining: t.uint8(),
  },
  "RoyaleState",
);
export type RoyaleState = SchemaType<typeof RoyaleState>;
