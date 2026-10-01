import { Room, type Client } from "@colyseus/core";
import { LANGS, MATCH, MatchSim, isDifficulty, type ClientMessages, type Difficulty, type JoinOptions, type Lang, type ModeId, type SimPlayer, type SimState } from "@keywar/shared";
import { Effect, MatchState, Player } from "./schema.js";

const TICK_MS = 50;

interface CreateOptions {
  mode: ModeId;
  lang?: Lang;
  difficulty?: Difficulty;
}

/**
 * Network adapter around MatchSim: Colyseus handles seats, matchmaking and
 * state sync; every game rule lives in @keywar/shared.
 */
export class MatchRoom extends Room<{ state: MatchState }> {
  override state = new MatchState();
  /** Generous: a frantic masher should lose HP, not get disconnected. */
  override maxMessagesPerSecond = 120;

  private sim!: MatchSim;
  private fillTimer?: ReturnType<typeof setTimeout>;

  override onCreate(options: CreateOptions) {
    const lang: Lang = LANGS.includes(options.lang as Lang) ? (options.lang as Lang) : "es";
    const difficulty: Difficulty = isDifficulty(options.difficulty) ? options.difficulty : "normal";

    this.sim = new MatchSim(this.state as unknown as SimState, {
      now: () => Date.now(),
      createPlayer: () => new Player() as unknown as SimPlayer,
      createEffect: () => new Effect(),
      send: (sessionId, type, msg) => this.clients.getById(sessionId)?.send(type, msg),
      broadcast: (type, msg) => this.broadcast(type, msg),
      // 3–6 players: everyone sees every hit.
      notify: (_ids, type, msg) => this.broadcast(type, msg),
      onEnded: () => this.clock.setTimeout(() => this.disconnect(), MATCH.resultsMs),
    }, { mode: options.mode, lang, difficulty, seed: Math.floor(Math.random() * 2 ** 32) });

    this.maxClients = this.sim.def.players;
    this.setMetadata({ mode: options.mode, lang, difficulty, region: process.env.REGION ?? "local" });

    this.onMessage("clock", (client, msg: ClientMessages["clock"]) => {
      client.send("clock", { c: Number(msg?.c) || 0, s: Date.now() });
    });
    this.onMessage("hit", (client, msg: ClientMessages["hit"]) => this.sim.hit(client.sessionId, Number(msg?.noteId), Number(msg?.offset)));
    this.onMessage("holdEnd", (client, msg: ClientMessages["holdEnd"]) =>
      this.sim.holdEnd(client.sessionId, Number(msg?.noteId), Number(msg?.heldMs) || 0),
    );
    this.onMessage("wrong", (client) => this.sim.wrong(client.sessionId));
    this.onMessage("skill", (client, msg: ClientMessages["skill"]) => this.sim.skill(client.sessionId, Number(msg?.slot)));
    this.onMessage("target", (client, msg: ClientMessages["target"]) => this.sim.setTarget(client.sessionId, String(msg?.sessionId)));

    this.setSimulationInterval(() => this.sim.tick(), TICK_MS);
  }

  override onJoin(client: Client, options: Partial<JoinOptions> = {}) {
    this.sim.join(client.sessionId, options);
    if (this.sim.full) this.start();
    else this.armFillTimer();
  }

  override onDrop(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.connected = false;
    if (this.state.phase !== "waiting") this.allowReconnection(client, MATCH.reconnectSeconds);
  }

  override onReconnect(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.connected = true;
  }

  override onLeave(client: Client) {
    this.sim.leave(client.sessionId);
  }

  override onDispose() {
    clearTimeout(this.fillTimer);
  }

  private start() {
    clearTimeout(this.fillTimer);
    if (this.sim.startCountdown()) void this.lock();
  }

  /** Dev convenience: with MIN_PLAYERS set, start short-handed after a while. */
  private armFillTimer() {
    const min = Number(process.env.MIN_PLAYERS);
    if (!min || this.fillTimer) return;
    this.fillTimer = setTimeout(() => {
      this.fillTimer = undefined;
      if (this.state.phase === "waiting" && this.state.players.size >= min) this.start();
    }, Number(process.env.FILL_TIMEOUT_MS) || 45_000);
  }
}
