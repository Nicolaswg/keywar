import { Room, ServerError, type Client } from "@colyseus/core";
import {
  CLOSE_CODES,
  DEFAULT_CHAT_COMMAND,
  LANGS,
  MatchSim,
  ROYALE,
  fillSeats,
  isDifficulty,
  isValidLoadout,
  normalizeCommand,
  type ClientMessages,
  type Difficulty,
  type Lang,
  type RoyaleJoinOptions,
  type SimPlayer,
  type SimState,
  type SkillId,
} from "@keywar/shared";
import { verifyToken, type Identity } from "../twitch/session.js";
import { rooms, sessionRevoked } from "../twitch/registry.js";
import { Effect, Entrant, Player, RoyaleState } from "./schema.js";

const TICK_MS = 50;
/** Viewers past the cap wait here; they fill the seats of no-shows at start. */
const WAITLIST = 100;

export interface RoyaleCreateOptions {
  channel: string;
  channelName: string;
  lang?: Lang;
  difficulty?: Difficulty;
  command?: string;
  maxPlayers?: number;
}

interface ClientData {
  role: "player" | "overlay";
  login?: string;
  loadout?: [SkillId, SkillId];
}

/**
 * One room per Twitch channel. Viewers register from chat, connect from the
 * web, and when the streamer starts, the connected ones are seated in a
 * MatchSim running the "royale" ring mode.
 */
type Auth = Identity | { overlay: true };

export class RoyaleRoom extends Room<{ state: RoyaleState; client: Client<{ userData: ClientData; auth: Auth }> }> {
  override state = new RoyaleState();
  /** Generous: a frantic masher should lose HP, not get disconnected. */
  override maxMessagesPerSecond = 120;
  /** Patches 10×/s: 100 players' HP is plenty smooth at that rate. */
  override patchRate = 100;
  override autoDispose = false;

  private sim!: MatchSim;
  private spectators = new Set<string>();

  override onCreate(options: RoyaleCreateOptions) {
    const lang: Lang = LANGS.includes(options.lang as Lang) ? (options.lang as Lang) : "es";
    const difficulty: Difficulty = isDifficulty(options.difficulty) ? options.difficulty : "normal";
    this.maxClients = ROYALE.maxPlayers + WAITLIST + 20; // + overlays and the panel

    this.sim = new MatchSim(this.state as unknown as SimState, {
      now: () => Date.now(),
      createPlayer: () => new Player() as unknown as SimPlayer,
      createEffect: () => new Effect(),
      send: (sessionId, type, msg) => this.clients.getById(sessionId)?.send(type, msg),
      broadcast: (type, msg) => this.broadcast(type, msg),
      notify: (ids, type, msg) => {
        for (const id of new Set([...ids, ...this.spectators])) this.clients.getById(id)?.send(type, msg);
      },
      onEnded: () => (this.state.remaining = this.sim.remaining()),
    }, { mode: "royale", lang, difficulty, seed: Math.floor(Math.random() * 2 ** 32) });

    this.state.channel = options.channel;
    this.state.channelName = options.channelName || options.channel;
    this.state.stage = "registering";
    this.state.command = normalizeCommand(options.command ?? DEFAULT_CHAT_COMMAND);
    this.state.maxPlayers = Math.min(ROYALE.maxPlayers, Math.max(ROYALE.minPlayers, options.maxPlayers ?? ROYALE.maxPlayers));
    this.setMetadata({ channel: options.channel });
    rooms.set(options.channel, this);

    this.onMessage("clock", (client, msg: ClientMessages["clock"]) => client.send("clock", { c: Number(msg?.c) || 0, s: Date.now() }));
    this.onMessage("hit", (client, msg: ClientMessages["hit"]) => this.sim.hit(client.sessionId, Number(msg?.noteId), Number(msg?.offset)));
    this.onMessage("holdEnd", (client, msg: ClientMessages["holdEnd"]) =>
      this.sim.holdEnd(client.sessionId, Number(msg?.noteId), Number(msg?.heldMs) || 0),
    );
    this.onMessage("wrong", (client) => this.sim.wrong(client.sessionId));
    this.onMessage("skill", (client, msg: ClientMessages["skill"]) => this.sim.skill(client.sessionId, Number(msg?.slot)));
    this.onMessage("target", () => {}); // the ring decides targets
    this.onMessage("loadout", (client, msg: { loadout?: unknown }) => {
      if (isValidLoadout(msg?.loadout, false)) client.userData!.loadout = msg.loadout;
    });

    this.setSimulationInterval(() => {
      this.sim.tick();
      if (this.state.stage === "match") this.state.remaining = this.sim.remaining();
    }, TICK_MS);
  }

  override onAuth(_client: Client, options: Partial<RoyaleJoinOptions>) {
    // Overlays and the panel watch read-only. (A falsy return would reject the join.)
    if (options.role === "overlay") return { overlay: true };
    const identity = verifyToken(options.token);
    if (!identity) throw new ServerError(401, "login_required");
    if (sessionRevoked(this.state.channel, identity.iat)) throw new ServerError(401, "logged_out");
    if (!this.state.entrants.find((e) => e.login === identity.login)) throw new ServerError(403, "not_registered");
    return identity;
  }

  override onJoin(client: Client, options: Partial<RoyaleJoinOptions>, auth: Auth) {
    if ("overlay" in auth) {
      client.userData = { role: "overlay" };
      this.spectators.add(client.sessionId);
      return;
    }
    const identity = auth;
    // One connection per viewer: a new tab replaces the old one.
    for (const other of this.clients) {
      if (other !== client && other.userData?.login === identity.login) other.leave(CLOSE_CODES.replaced);
    }
    client.userData = {
      role: "player",
      login: identity.login,
      loadout: isValidLoadout(options.loadout, false) ? options.loadout : undefined,
    };
    const entrant = this.state.entrants.find((e) => e.login === identity.login);
    if (entrant) entrant.connected = true;
  }

  override onLeave(client: Client) {
    this.spectators.delete(client.sessionId);
    const login = client.userData?.login;
    if (!login) return;
    // Another tab of the same viewer may still be here.
    const stillHere = this.clients.some((c) => c !== client && c.userData?.login === login);
    const entrant = this.state.entrants.find((e) => e.login === login);
    if (entrant && !stillHere) entrant.connected = false;
    if (this.state.players.has(client.sessionId)) this.sim.leave(client.sessionId);
  }

  override onDispose() {
    if (rooms.get(this.state.channel) === this) rooms.delete(this.state.channel);
  }

  /* ---------------- commands from chat and the panel ---------------- */

  /** A viewer typed the join command. Returns their sign-up number, or why not. */
  register(login: string, displayName: string): { ok: true; order: number; waitlisted: boolean; already: boolean } | { ok: false; reason: "closed" | "full" } {
    const existing = this.state.entrants.find((e) => e.login === login);
    if (existing) return { ok: true, order: existing.order, waitlisted: existing.order > this.state.maxPlayers, already: true };
    if (this.state.stage !== "registering") return { ok: false, reason: "closed" };
    if (this.state.entrants.length >= this.state.maxPlayers + WAITLIST) return { ok: false, reason: "full" };
    const e = new Entrant();
    e.login = login;
    e.displayName = displayName;
    e.order = this.state.entrants.length + 1;
    e.connected = this.clients.some((c) => c.userData?.login === login);
    e.seated = false;
    this.state.entrants.push(e);
    return { ok: true, order: e.order, waitlisted: e.order > this.state.maxPlayers, already: false };
  }

  close() {
    if (this.state.stage === "registering") this.state.stage = "closed";
  }

  reopen() {
    if (this.state.stage === "closed") this.state.stage = "registering";
  }

  kick(login: string) {
    const i = this.state.entrants.findIndex((e) => e.login === login);
    if (i < 0 || this.state.stage === "match") return false;
    this.state.entrants.splice(i, 1);
    this.state.entrants.forEach((e, k) => (e.order = k + 1));
    for (const c of this.clients) if (c.userData?.login === login) c.leave(CLOSE_CODES.kicked);
    return true;
  }

  /** Seat the connected entrants (waitlist fills no-shows) and start the countdown. */
  start(): { ok: true; players: number } | { ok: false; reason: "already_started" | "not_enough" } {
    if (this.state.stage === "match") return { ok: false, reason: "already_started" };
    const cap = this.state.maxPlayers;
    const ordered = [...this.state.entrants].sort((a, b) => a.order - b.order);
    const connected = new Set(ordered.filter((e) => e.connected).map((e) => e.login));
    const seats = fillSeats(
      ordered.filter((e) => e.order <= cap).map((e) => e.login),
      ordered.filter((e) => e.order > cap).map((e) => e.login),
      connected,
      cap,
    );
    if (seats.length < ROYALE.minPlayers) return { ok: false, reason: "not_enough" };

    for (const login of seats) {
      const client = this.clients.find((c) => c.userData?.login === login);
      const entrant = this.state.entrants.find((e) => e.login === login)!;
      if (!client) continue;
      this.sim.join(client.sessionId, { name: entrant.displayName, loadout: client.userData?.loadout });
      entrant.seated = true;
    }
    this.state.stage = "match";
    this.sim.startCountdown();
    this.state.remaining = this.sim.remaining();
    void this.lock();
    return { ok: true, players: seats.length };
  }

  /** Streamer cancelled the round: everyone out, room gone (sessions stay valid). */
  cancel() {
    void this.disconnect();
  }

  /** Streamer's "stop everything": everyone out with the "logged out" code. */
  stopAll() {
    void this.disconnect(CLOSE_CODES.loggedOut);
  }
}
