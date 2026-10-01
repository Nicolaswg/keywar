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
