import { Client, type Room } from "@colyseus/sdk";
import { ROOM_NAME, SKILLS, type EntrantView, type JoinOptions, type ModeId, type PlayerView, type RoyaleJoinOptions, type ServerMessages, type SkillId } from "@keywar/shared";
import { Emitter, nowMs, type GameSession, type Snapshot } from "./session";

const MESSAGE_TYPES: (keyof ServerMessages)[] = ["judged", "skillCast", "damage", "knockout", "heal", "selfDamage", "skillUpgrade"];

/** Live match against a regional Colyseus server. */
export class OnlineSession implements GameSession {
  readonly kind = "online";
  private events = new Emitter();
  private snap: Snapshot;
  /** serverEpoch ≈ localEpoch + clockOffset */
  private clockOffset = 0;
  private bestRtt = Infinity;
  private startsAt = 0;
  private lastCast: Partial<Record<SkillId, number>> = {};
  /** Set when the server closed the connection (kicked, event cancelled, room gone). */
  closedCode: number | null = null;

  private constructor(
    private room: Room,
    readonly meId: string,
    mode: ModeId,
    lang: JoinOptions["lang"],
    difficulty: JoinOptions["difficulty"],
  ) {
    this.snap = { mode, lang, difficulty, phase: "waiting", seed: 0, winnerTeam: -1, players: [] };
    room.onStateChange(() => this.refresh());
    room.onLeave((code: number) => {
      this.closedCode = code;
      // New snapshot object so React re-renders and notices the closed connection.
      this.snap = { ...this.snap };
      this.events.changed();
    });
    for (const type of MESSAGE_TYPES) room.onMessage(type, (msg: never) => this.events.emit(type, msg));
    room.onMessage("skillCast", (msg: ServerMessages["skillCast"]) => {
      if (msg.from === this.meId) this.lastCast[msg.skill] = this.matchNow();
    });
    room.onMessage("clock", (msg: ServerMessages["clock"]) => {
      const rtt = nowMs() - msg.c;
      if (rtt < this.bestRtt) {
        this.bestRtt = rtt;
        this.clockOffset = msg.s - (msg.c + rtt / 2);
      }
    });
    this.syncClock();
  }

  static async join(url: string, mode: ModeId, opts: JoinOptions) {
    const client = new Client(url);
    const room = await client.joinOrCreate(ROOM_NAME[mode], opts);
    return new OnlineSession(room, room.sessionId, mode, opts.lang, opts.difficulty);
  }

  /** Twitch chat battle: one room per channel, joined with a Twitch session token (or as an overlay). */
  static async joinRoyale(url: string, channel: string, opts: RoyaleJoinOptions) {
    const room = await new Client(url).join(ROOM_NAME.royale, { channel, ...opts });
    return new OnlineSession(room, room.sessionId, "royale", "es", "normal");
  }

  sendLoadout(loadout: [SkillId, SkillId]) {
    this.room.send("loadout", { loadout });
  }

  /** NTP-style: a burst of pings, keep the sample with the lowest round trip. */
  private syncClock() {
    for (let i = 0; i < 8; i++) setTimeout(() => this.room.send("clock", { c: nowMs() }), i * 120);
    // Re-sync now and then; the countdown is a good moment.
    setTimeout(() => {
      this.bestRtt = Infinity;
      for (let i = 0; i < 5; i++) setTimeout(() => this.room.send("clock", { c: nowMs() }), i * 120);
    }, 3_000);
  }

  private refresh() {
    const s = this.room.state;
    const players: PlayerView[] = [];
    s.players?.forEach((p: PlayerView & { loadout: Iterable<SkillId>; effects: Iterable<PlayerView["effects"][number]> }) =>
      players.push({
        sessionId: p.sessionId,
        name: p.name,
        team: p.team,
        seat: p.seat,
        hp: p.hp,
        streak: p.streak,
        bestStreak: p.bestStreak,
        ink: p.ink,
        damageDealt: p.damageDealt,
        targetId: p.targetId,
        connected: p.connected,
        alive: p.alive,
        loadout: [...p.loadout],
        effects: [...p.effects].map((e) => ({ skill: e.skill, from: e.from, until: e.until })),
      }),
    );
    this.startsAt = s.startsAt;
    this.snap = {
      mode: s.mode,
      lang: s.lang,
      difficulty: s.difficulty,
      phase: s.phase,
      seed: s.seed,
      winnerTeam: s.winnerTeam,
      players: players.sort((a, b) => a.seat - b.seat),
      royale: s.channel
        ? {
            channel: s.channel,
            channelName: s.channelName,
            stage: s.stage,
            command: s.command,
            maxPlayers: s.maxPlayers,
            remaining: s.remaining,
            entrants: [...(s.entrants ?? [])].map((e: EntrantView) => ({
              login: e.login,
              displayName: e.displayName,
              order: e.order,
              connected: e.connected,
              seated: e.seated,
            })),
          }
        : undefined,
    };
    this.events.changed();
  }

  snapshot = () => this.snap;
  subscribe = (fn: () => void) => this.events.subscribe(fn);
  on: GameSession["on"] = (type, fn) => this.events.on(type, fn);
  matchNow = () => (this.startsAt ? nowMs() + this.clockOffset - this.startsAt : -Infinity);
  hit = (noteId: number, offset: number) => this.room.send("hit", { noteId, offset });
  holdEnd = (noteId: number, heldMs: number) => this.room.send("holdEnd", { noteId, heldMs });
  wrong = () => this.room.send("wrong", {});
  skill = (slot: 0 | 1) => this.room.send("skill", { slot });
  target = (sessionId: string) => this.room.send("target", { sessionId });
  cooldownLeft = (skill: SkillId) => {
    const last = this.lastCast[skill];
    return last === undefined ? 0 : Math.max(0, SKILLS[skill].cooldownMs - (this.matchNow() - last));
  };
  leave = () => void this.room.leave();
}
