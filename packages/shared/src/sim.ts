/**
 * The authoritative match rules, free of any network library.
 *
 * The Colyseus room runs it over synced schema objects; the client's practice
 * mode runs it over plain objects with bots. Same rules, one implementation.
 */
import { generateChart, type Note } from "./chart.js";
import {
  DAMAGE,
  DIFFICULTIES,
  MATCH,
  MODES,
  WORD_BONUS,
  WRONG_KEY_SELF_DAMAGE,
  multiplierFor,
  judgeWindows,
  phaseAt,
  type Difficulty,
  type JudgeWindows,
  type Lang,
  type ModeDef,
  type ModeId,
} from "./constants.js";
import { damageFor, inkFor, judge } from "./judge.js";
import type { MatchPhase, ServerMessages } from "./protocol.js";
import {
  AMBULANCE_HEAL,
  DEFAULT_LOADOUT,
  ERASER_CHARGES,
  MAX_ACTIVE_SABOTAGES,
  OVERTIME_MULT,
  SKILLS,
  isValidLoadout,
  type SkillId,
} from "./skills.js";

/** A hit claimed this long after its own timestamp is too stale to trust. */
export const MAX_HIT_LAG_MS = 600;
/** Extra time before an unhit note is swept as a miss (network slack). */
export const MISS_SWEEP_GRACE_MS = 300;

/** Minimal array surface shared by plain arrays and Colyseus ArraySchema. */
export interface ListLike<T> {
  readonly length: number;
  [index: number]: T;
  push(...items: T[]): number;
  splice(start: number, deleteCount?: number): unknown;
  find(pred: (v: T) => boolean): T | undefined;
  findIndex(pred: (v: T) => boolean): number;
  some(pred: (v: T) => boolean): boolean;
  indexOf(v: T): number;
  forEach(cb: (v: T) => void): void;
  [Symbol.iterator](): Iterator<T>;
}

export interface MapLike<T> {
  readonly size: number;
  get(key: string): T | undefined;
  set(key: string, value: T): unknown;
  delete(key: string): unknown;
  forEach(cb: (value: T, key: string) => void): void;
}

export interface SimEffect {
  skill: string;
  from: string;
  until: number;
}

export interface SimPlayer {
  sessionId: string;
  name: string;
  team: number;
  seat: number;
  hp: number;
  streak: number;
  bestStreak: number;
  ink: number;
  damageDealt: number;
  targetId: string;
  connected: boolean;
  alive: boolean;
  loadout: ListLike<string>;
  effects: ListLike<SimEffect>;
}

export interface SimState {
  mode: string;
  lang: string;
  difficulty: string;
  phase: string;
  seed: number;
  startsAt: number;
  winnerTeam: number;
  players: MapLike<SimPlayer>;
}

export interface SimHost {
  /** Wall clock in ms (Date.now on the server). */
  now(): number;
  createPlayer(): SimPlayer;
  createEffect(): SimEffect;
  send<K extends keyof ServerMessages>(sessionId: string, type: K, msg: ServerMessages[K]): void;
  broadcast<K extends keyof ServerMessages>(type: K, msg: ServerMessages[K]): void;
  /** Called once when the match ends. */
  onEnded?(): void;
}

interface Book {
  judged: Set<number>;
  cursor: number;
  wordHits: Map<number, number>;
  lastCast: Partial<Record<SkillId, number>>;
  eraserCharges: number;
}

export class MatchSim {
  readonly def: ModeDef;
  readonly difficulty: Difficulty;
  readonly windows: JudgeWindows;
  readonly chart: Note[];
  private noteById = new Map<number, Note>();
  private wordLength = new Map<number, number>();
  private books = new Map<string, Book>();
  /** Teams present when the countdown started; a solo dev room only ends on time. */
  private startingTeams = 0;

  constructor(
    readonly state: SimState,
    private host: SimHost,
    init: { mode: ModeId; lang: Lang; difficulty: Difficulty; seed: number },
  ) {
    this.def = MODES[init.mode];
    this.difficulty = init.difficulty;
    this.windows = judgeWindows(init.difficulty);
    state.mode = init.mode;
    state.lang = init.lang;
    state.difficulty = init.difficulty;
    state.phase = "waiting" satisfies MatchPhase;
    state.seed = init.seed;
    state.startsAt = 0;
    state.winnerTeam = -1;

    this.chart = generateChart(init.seed, init.lang, init.difficulty);
    for (const n of this.chart) {
      this.noteById.set(n.id, n);
      if (n.wordId !== undefined) this.wordLength.set(n.wordId, (this.wordLength.get(n.wordId) ?? 0) + 1);
    }
  }

  get teamMode() {
    return this.def.teams < this.def.players;
  }

  get full() {
    return this.state.players.size >= this.def.players;
  }

  /** Match clock: ms since note time 0 (negative during countdown). */
  matchMs() {
    return this.host.now() - this.state.startsAt;
  }

  /* ---------------- lobby ---------------- */

  join(sessionId: string, opts: { name?: unknown; loadout?: unknown }) {
    const seat = this.state.players.size;
    const p = this.host.createPlayer();
    p.sessionId = sessionId;
    p.name = sanitizeName(opts.name) || `Obrero ${seat + 1}`;
    p.seat = seat;
    p.team = this.teamFor(seat);
    p.hp = MATCH.maxHp;
    p.streak = 0;
    p.bestStreak = 0;
    p.ink = 0;
    p.damageDealt = 0;
    p.targetId = "";
    p.connected = true;
    p.alive = true;
    for (const id of isValidLoadout(opts.loadout, this.teamMode) ? opts.loadout : DEFAULT_LOADOUT) p.loadout.push(id);
    this.state.players.set(sessionId, p);
    this.books.set(sessionId, { judged: new Set(), cursor: 0, wordHits: new Map(), lastCast: {}, eraserCharges: 0 });
    return p;
  }

  leave(sessionId: string) {
    if (this.state.phase === "waiting") {
      this.state.players.delete(sessionId);
      this.books.delete(sessionId);
      let seat = 0;
      this.state.players.forEach((p) => {
        p.seat = seat;
        p.team = this.teamFor(seat);
        seat++;
      });
      return;
    }
    const p = this.state.players.get(sessionId);
    if (p) {
      p.connected = false;
      p.alive = false; // leaving mid-match forfeits
      p.hp = 0;
    }
  }

  startCountdown() {
    if (this.state.phase !== "waiting") return false;
    this.state.phase = "countdown";
    this.state.startsAt = this.host.now() + MATCH.countdownMs;
    const teams = new Set<number>();
    this.state.players.forEach((p) => {
      p.targetId = this.pickTarget(p);
      teams.add(p.team);
    });
    this.startingTeams = teams.size;
    return true;
  }

  private teamFor(seat: number) {
    return this.teamMode ? seat % this.def.teams : seat;
  }

  /* ---------------- clock ---------------- */

  tick() {
    if (this.state.phase === "countdown" && this.matchMs() >= 0) this.state.phase = "playing";
    if (this.state.phase !== "playing") return;

    const now = this.matchMs();
    this.state.players.forEach((p) => {
      for (let i = p.effects.length - 1; i >= 0; i--) if (p.effects[i]!.until <= now) p.effects.splice(i, 1);
      if (!p.alive) return;
      const book = this.books.get(p.sessionId)!;
      while (book.cursor < this.chart.length) {
        const n = this.chart[book.cursor]!;
        if (n.t + this.windows.missAfter + MISS_SWEEP_GRACE_MS > now) break;
        if (!book.judged.has(n.id)) {
          book.judged.add(n.id);
          this.breakStreak(p, book);
        }
        book.cursor++;
      }
    });

    this.checkEnd(now);
  }

  private checkEnd(now: number) {
    const aliveTeams = new Set<number>();
    this.state.players.forEach((p) => p.alive && aliveTeams.add(p.team));
    const lastStanding = this.startingTeams > 1 && aliveTeams.size <= 1;
    if (!lastStanding && now < MATCH.durationMs) return;

    const score = new Map<number, { hp: number; dealt: number }>();
    this.state.players.forEach((p) => {
      const s = score.get(p.team) ?? { hp: 0, dealt: 0 };
      s.hp += Math.max(0, p.hp);
      s.dealt += p.damageDealt;
      score.set(p.team, s);
    });
    const ranked = [...score.entries()].sort((a, b) => b[1].hp - a[1].hp || b[1].dealt - a[1].dealt);
    this.state.winnerTeam = ranked[0]?.[0] ?? -1;
    this.state.phase = "ended";
    this.host.onEnded?.();
  }

  /* ---------------- input ---------------- */

  private active(sessionId: string) {
    const p = this.state.players.get(sessionId);
    if (this.state.phase !== "playing" || !p?.alive) return null;
    return { p, book: this.books.get(sessionId)! };
  }

  hit(sessionId: string, noteId: number, offset: number) {
    const ctx = this.active(sessionId);
    const note = this.noteById.get(noteId);
    if (!ctx || !note || !Number.isFinite(offset) || ctx.book.judged.has(note.id)) return;

    // Plausibility: the claimed press time must be in the recent past.
    const lag = this.matchMs() - (note.t + offset);
    if (lag < -50 || lag > MAX_HIT_LAG_MS) return;

    const { p, book } = ctx;
    const judgement = judge(offset, this.difficulty);
    book.judged.add(note.id);
    if (judgement === "miss") {
      this.breakStreak(p, book);
      this.host.send(sessionId, "judged", { noteId: note.id, judgement, damage: 0, targetId: p.targetId });
      return;
    }

    const before = p.streak;
    p.streak++;
    p.bestStreak = Math.max(p.bestStreak, p.streak);
    p.ink = Math.min(100, p.ink + inkFor(judgement, before, p.streak));

    let damage = damageFor({
      judgement,
      note,
      streak: p.streak,
      phaseScale: phaseAt(note.t, this.difficulty).damageScale * DIFFICULTIES[this.difficulty].damageMult,
      bonusMult: hasEffect(p, "overtime") ? OVERTIME_MULT : 1,
    });
    if (note.wordId !== undefined) {
      const hits = (book.wordHits.get(note.wordId) ?? 0) + 1;
      book.wordHits.set(note.wordId, hits);
      if (hits === this.wordLength.get(note.wordId)) damage += WORD_BONUS * multiplierFor(p.streak);
    }

    const targetId = this.dealDamage(p, damage);
    this.host.send(sessionId, "judged", { noteId: note.id, judgement, damage, targetId });
  }

  holdEnd(sessionId: string, noteId: number, heldMs: number) {
    const ctx = this.active(sessionId);
    const note = this.noteById.get(noteId);
    if (!ctx || !note || note.kind !== "hold" || !ctx.book.judged.has(note.id)) return;
    const need = note.holdMs ?? 0;
    if (Math.min(heldMs, need) >= need - this.windows.good) {
      this.dealDamage(ctx.p, Math.round(DAMAGE.good * multiplierFor(ctx.p.streak) * DIFFICULTIES[this.difficulty].damageMult));
    }
    else this.breakStreak(ctx.p, ctx.book);
  }

  wrong(sessionId: string) {
    const ctx = this.active(sessionId);
    if (!ctx) return;
    this.hurt(ctx.p, WRONG_KEY_SELF_DAMAGE);
    this.breakStreak(ctx.p, ctx.book);
  }

  setTarget(sessionId: string, targetId: string) {
    const p = this.state.players.get(sessionId);
    const t = this.state.players.get(targetId);
    if (p && t && t.alive && t.team !== p.team) p.targetId = t.sessionId;
  }

  skill(sessionId: string, slot: number) {
    const ctx = this.active(sessionId);
    if (!ctx) return;
    const { p, book } = ctx;
    const id = p.loadout[slot === 1 ? 1 : 0] as SkillId | undefined;
    const def = id ? SKILLS[id] : undefined;
    if (!def) return;
    const now = this.matchMs();
    if (p.ink < def.cost || now - (book.lastCast[def.id] ?? -Infinity) < def.cooldownMs) return;

    p.ink -= def.cost;
    book.lastCast[def.id] = now;

    if (def.kind === "self") {
      this.addEffect(p, def.id, p.sessionId, now + def.durationMs);
      if (def.id === "eraser") book.eraserCharges = ERASER_CHARGES;
      this.host.broadcast("skillCast", { from: p.sessionId, to: p.sessionId, skill: def.id, blocked: false });
      return;
    }

    if (def.kind === "team") {
      let mate: SimPlayer | undefined;
      this.state.players.forEach((m) => {
        if (m.team === p.team && m.alive && (!mate || m.hp < mate.hp)) mate = m;
      });
      if (mate) mate.hp = Math.min(MATCH.maxHp, mate.hp + AMBULANCE_HEAL);
      this.host.broadcast("skillCast", { from: p.sessionId, to: mate?.sessionId ?? p.sessionId, skill: def.id, blocked: false });
      return;
    }

    const target = this.resolveTarget(p);
    if (!target) return;
    const helmet = target.effects.findIndex((e) => e.skill === "helmet");
    if (helmet >= 0) {
      target.effects.splice(helmet, 1);
      this.host.broadcast("skillCast", { from: p.sessionId, to: target.sessionId, skill: def.id, blocked: true });
      return;
    }
    const sabotages: SimEffect[] = [];
    target.effects.forEach((e) => SKILLS[e.skill as SkillId]?.kind === "sabotage" && sabotages.push(e));
    if (sabotages.length >= MAX_ACTIVE_SABOTAGES && !hasEffect(target, def.id)) {
      // Replace the one closest to expiring rather than stacking a third.
      const oldest = sabotages.reduce((a, b) => (a.until < b.until ? a : b));
      target.effects.splice(target.effects.indexOf(oldest), 1);
    }
    this.addEffect(target, def.id, p.sessionId, now + def.durationMs);
    this.host.broadcast("skillCast", { from: p.sessionId, to: target.sessionId, skill: def.id, blocked: false });
  }

  /** Cooldown left for a skill, in ms (0 = ready). */
  cooldownLeft(sessionId: string, skill: SkillId) {
    const last = this.books.get(sessionId)?.lastCast[skill];
    return last === undefined ? 0 : Math.max(0, SKILLS[skill].cooldownMs - (this.matchMs() - last));
  }

  /* ---------------- rules ---------------- */

  private breakStreak(p: SimPlayer, book: Book) {
    if (book.eraserCharges > 0 && hasEffect(p, "eraser")) {
      book.eraserCharges--;
      return;
    }
    p.streak = 0;
  }

  private dealDamage(from: SimPlayer, amount: number) {
    const target = this.resolveTarget(from);
    if (!target || amount <= 0) return from.targetId;
    this.hurt(target, amount);
    from.damageDealt += amount;
    this.host.broadcast("damage", { from: from.sessionId, to: target.sessionId, amount });
    return target.sessionId;
  }

  private hurt(p: SimPlayer, amount: number) {
    p.hp = Math.max(0, p.hp - amount);
    if (p.hp === 0) p.alive = false;
  }

  private resolveTarget(p: SimPlayer) {
    let t = this.state.players.get(p.targetId);
    if (!t || !t.alive || t.team === p.team) {
      p.targetId = this.pickTarget(p);
      t = this.state.players.get(p.targetId);
    }
    return t?.alive ? t : undefined;
  }

  /** Default target: the healthiest enemy, so leaders draw fire. */
  private pickTarget(p: SimPlayer) {
    let best: SimPlayer | undefined;
    this.state.players.forEach((o) => {
      if (o.team !== p.team && o.alive && (!best || o.hp > best.hp)) best = o;
    });
    return best?.sessionId ?? "";
  }

  private addEffect(p: SimPlayer, skill: SkillId, from: string, until: number) {
    const existing = p.effects.find((e) => e.skill === skill);
    if (existing) {
      existing.until = Math.max(existing.until, until);
      existing.from = from;
      return;
    }
    const e = this.host.createEffect();
    e.skill = skill;
    e.from = from;
    e.until = until;
    p.effects.push(e);
  }
}

export function hasEffect(p: Pick<SimPlayer, "effects">, skill: SkillId) {
  return p.effects.some((e) => e.skill === skill);
}

function sanitizeName(name: unknown) {
  return typeof name === "string" ? name.replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 16) : "";
}
