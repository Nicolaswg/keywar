import type { Difficulty, Lang, MatchPhase, ModeId, PlayerView, ServerMessages, SkillId } from "@keywar/shared";

export interface Snapshot {
  mode: ModeId;
  lang: Lang;
  difficulty: Difficulty;
  phase: MatchPhase;
  seed: number;
  winnerTeam: number;
  players: PlayerView[];
}

type Listener<K extends keyof ServerMessages> = (msg: ServerMessages[K]) => void;

/**
 * What the match screen talks to. Online and practice sessions implement it,
 * so the screens never know whether a real server is on the other end.
 */
export interface GameSession {
  readonly meId: string;
  readonly kind: "online" | "practice";
  /** Latest state; a new object after every change (safe for React). */
  snapshot(): Snapshot;
  subscribe(fn: () => void): () => void;
  on<K extends keyof ServerMessages>(type: K, fn: Listener<K>): () => void;
  /** Match clock in ms (negative during the countdown). */
  matchNow(): number;
  hit(noteId: number, offset: number): void;
  holdEnd(noteId: number, heldMs: number): void;
  wrong(): void;
  skill(slot: 0 | 1): void;
  target(sessionId: string): void;
  cooldownLeft(skill: SkillId): number;
  leave(): void;
}

/** Tiny typed event hub shared by both session kinds. */
export class Emitter {
  private subs = new Set<() => void>();
  private handlers = new Map<string, Set<(msg: never) => void>>();

  subscribe(fn: () => void) {
    this.subs.add(fn);
    return () => void this.subs.delete(fn);
  }
  changed() {
    for (const fn of this.subs) fn();
  }
  on<K extends keyof ServerMessages>(type: K, fn: Listener<K>) {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn as (msg: never) => void);
    return () => void set.delete(fn as (msg: never) => void);
  }
  emit<K extends keyof ServerMessages>(type: K, msg: ServerMessages[K]) {
    this.handlers.get(type)?.forEach((fn) => (fn as Listener<K>)(msg));
  }
}

export const nowMs = () => performance.timeOrigin + performance.now();
