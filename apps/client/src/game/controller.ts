import {
  SLOT_BY_CODE,
  generateChart,
  judge,
  judgeWindows,
  type Difficulty,
  type EffectView,
  type JudgeWindows,
  type Judgement,
  type Lang,
  type Note,
} from "@keywar/shared";
import type { GameSession } from "../net/session";

export interface LocalJudgement {
  note: Note;
  judgement: Judgement;
  /** Match time it was judged at (for stamp animations). */
  at: number;
}

const LETTER = /^Key[A-Z]$/;

/**
 * Turns key presses into hits. Judges locally for instant feedback and sends
 * the offset to the session, which (online) the server re-validates.
 */
export class LaneController {
  readonly chart: Note[];
  readonly windows: JudgeWindows;
  readonly judged = new Map<number, LocalJudgement>();
  readonly pressed = new Set<string>();
  private missCursor = 0;
  private holds = new Map<string, { note: Note; downAt: number }>();
  private listeners = new Set<(j: LocalJudgement | { wrong: string }) => void>();
  effects: EffectView[] = [];

  constructor(
    private session: GameSession,
    seed: number,
    lang: Lang,
    readonly difficulty: Difficulty,
    /** Player calibration: positive = I tend to press late. */
    private inputOffsetMs = 0,
  ) {
    this.chart = generateChart(seed, lang, difficulty);
    this.windows = judgeWindows(difficulty);
  }

  onJudge(fn: (j: LocalJudgement | { wrong: string }) => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private emit(j: LocalJudgement | { wrong: string }) {
    for (const fn of this.listeners) fn(j);
  }

  hasEffect(skill: string) {
    return this.effects.some((e) => e.skill === skill);
  }

  /** Under the all-caps sabotage every letter needs Shift. */
  needsShift(note: Note) {
    return note.key.shift || (this.hasEffect("caps") && LETTER.test(note.key.code));
  }

  keyDown(e: KeyboardEvent): boolean {
    if (!SLOT_BY_CODE.has(e.code)) return false;
    e.preventDefault();
    if (e.repeat) return true;
    this.pressed.add(e.code);

    const now = this.session.matchNow() - this.inputOffsetMs;
    const W = this.windows;
    if (now < -W.good) return true;

    let best: Note | undefined;
    for (let i = this.missCursor; i < this.chart.length; i++) {
      const n = this.chart[i]!;
      if (n.t - now > W.good) break;
      if (n.key.code !== e.code || this.judged.has(n.id) || Math.abs(now - n.t) > W.good) continue;
      if (!best || Math.abs(now - n.t) < Math.abs(now - best.t)) best = n;
    }

    const modsOk = best && e.shiftKey === this.needsShift(best) && e.ctrlKey === best.key.ctrl;
    if (!best || !modsOk) {
      this.session.wrong();
      this.emit({ wrong: e.code });
      return true;
    }

    const offset = now - best.t;
    const j: LocalJudgement = { note: best, judgement: judge(offset, this.difficulty), at: now };
    this.judged.set(best.id, j);
    this.session.hit(best.id, Math.round(offset));
    if (best.kind === "hold") this.holds.set(e.code, { note: best, downAt: now });
    this.emit(j);
    return true;
  }

  keyUp(e: KeyboardEvent) {
    this.pressed.delete(e.code);
    const hold = this.holds.get(e.code);
    if (hold) {
      this.holds.delete(e.code);
      this.session.holdEnd(hold.note.id, Math.round(this.session.matchNow() - hold.downAt));
    }
  }

  /** Local miss sweep, mirrors the server so feedback is immediate. */
  update(now: number) {
    while (this.missCursor < this.chart.length) {
      const n = this.chart[this.missCursor]!;
      if (n.t + this.windows.missAfter > now) break;
      if (!this.judged.has(n.id)) {
        const j: LocalJudgement = { note: n, judgement: "miss", at: now };
        this.judged.set(n.id, j);
        this.emit(j);
      }
      this.missCursor++;
    }
  }

  /**
   * Keys to light on the keyboard floor: "now" while the note is inside the
   * hit window (press it!), "next" while it is on its way.
   */
  upcoming(now: number, withinMs = 900) {
    const keys = new Map<string, "now" | "next">();
    const t = now - this.inputOffsetMs;
    for (let i = this.missCursor; i < this.chart.length; i++) {
      const n = this.chart[i]!;
      if (n.t - t > withinMs) break;
      if (this.judged.has(n.id)) continue;
      if (Math.abs(n.t - t) <= this.windows.good) keys.set(n.key.code, "now");
      else if (!keys.has(n.key.code)) keys.set(n.key.code, "next");
    }
    return keys;
  }

  firstVisibleIndex() {
    return Math.max(0, this.missCursor - 12);
  }
}
