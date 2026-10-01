import {
  MatchSim,
  SKILLS,
  SKILL_IDS,
  type JoinOptions,
  type ModeId,
  type PlayerView,
  type SimPlayer,
  type SimState,
  type SkillId,
} from "@keywar/shared";
import { Emitter, nowMs, type GameSession, type Snapshot } from "./session";

const BOT_ACCURACY: Record<Snapshot["difficulty"], [number, number]> = {
  easy: [0.5, 0.75],
  normal: [0.72, 0.9],
  expert: [0.85, 0.97],
};

const BOT_NAMES = ["Grúa Gus", "Lola Ladrillo", "Paco Pintor", "Rita Remache", "Toño Tuerca", "Vera Viga"];

/**
 * Offline match: the real MatchSim runs in the browser, bots play the other
 * seats. Used for practice and whenever no server is reachable.
 */
export class PracticeSession implements GameSession {
  readonly kind = "practice";
  readonly meId = "me";
  private events = new Emitter();
  private sim: MatchSim;
  private state: SimState;
  private timer: ReturnType<typeof setInterval>;
  private snap!: Snapshot;
  private bots: { id: string; skill: number; cursor: number; plan: Map<number, number> }[] = [];

  constructor(mode: ModeId, me: JoinOptions) {
    this.state = { mode: "", lang: "", difficulty: "", phase: "", seed: 0, startsAt: 0, winnerTeam: -1, players: new Map() };
    this.sim = new MatchSim(this.state, {
      now: nowMs,
      createPlayer: () => ({ loadout: [], effects: [] }) as unknown as SimPlayer,
      createEffect: () => ({ skill: "", from: "", until: 0 }),
      send: (to, type, msg) => to === this.meId && this.events.emit(type, msg),
      broadcast: (type, msg) => this.events.emit(type, msg),
    }, { mode, lang: me.lang, difficulty: me.difficulty, seed: Math.floor(Math.random() * 2 ** 32) });

    this.sim.join(this.meId, me);
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 1; i < this.sim.def.players; i++) {
      const id = `bot${i}`;
      const pool = SKILL_IDS.filter((s) => this.sim.teamMode || !SKILLS[s].teamOnly);
      const loadout = [...pool].sort(() => Math.random() - 0.5).slice(0, 2);
      this.sim.join(id, { name: names[i - 1], loadout });
      // Each bot gets its own accuracy, matched to the difficulty, so matches feel uneven but fair.
      const [low, high] = BOT_ACCURACY[me.difficulty];
      this.bots.push({ id, skill: low + Math.random() * (high - low), cursor: 0, plan: new Map() });
    }
    this.sim.startCountdown();
    this.refresh();
    this.timer = setInterval(() => this.tick(), 25);
  }

  private tick() {
    const now = this.sim.matchMs();
    if (this.state.phase === "playing") this.driveBots(now);
    this.sim.tick();
    this.refresh();
    if (this.state.phase === "ended") clearInterval(this.timer);
  }

  private driveBots(now: number) {
    const chart = this.sim.chart;
    for (const bot of this.bots) {
      const p = this.state.players.get(bot.id)!;
      if (!p.alive) continue;
      // Decide each upcoming note's fate once: an offset to hit at, or a miss.
      while (bot.cursor < chart.length && chart[bot.cursor]!.t < now + 500) {
        const n = chart[bot.cursor++]!;
        if (Math.random() < bot.skill) bot.plan.set(n.id, n.t + gaussian() * this.sim.windows.great * (1.3 - bot.skill));
      }
      for (const [id, at] of bot.plan) {
        if (now >= at) {
          const n = chart[id]!;
          this.sim.hit(bot.id, id, at - n.t);
          if (n.kind === "hold") this.sim.holdEnd(bot.id, id, n.holdMs ?? 0);
          bot.plan.delete(id);
        }
      }
      for (const [slot, sid] of [...p.loadout].entries()) {
        const def = SKILLS[sid as SkillId];
        if (p.ink >= def.cost && Math.random() < 0.004) this.sim.skill(bot.id, slot);
      }
    }
  }

  private refresh() {
    const players: PlayerView[] = [];
    this.state.players.forEach((p) =>
      players.push({ ...p, loadout: [...p.loadout] as SkillId[], effects: [...(p.effects as unknown as PlayerView["effects"])] }),
    );
    this.snap = {
      mode: this.state.mode as ModeId,
      lang: this.state.lang as Snapshot["lang"],
      difficulty: this.state.difficulty as Snapshot["difficulty"],
      phase: this.state.phase as Snapshot["phase"],
      seed: this.state.seed,
      winnerTeam: this.state.winnerTeam,
      players: players.sort((a, b) => a.seat - b.seat),
    };
    this.events.changed();
  }

  snapshot = () => this.snap;
  subscribe = (fn: () => void) => this.events.subscribe(fn);
  on: GameSession["on"] = (type, fn) => this.events.on(type, fn);
  matchNow = () => this.sim.matchMs();
  hit = (noteId: number, offset: number) => this.sim.hit(this.meId, noteId, offset);
  holdEnd = (noteId: number, heldMs: number) => this.sim.holdEnd(this.meId, noteId, heldMs);
  wrong = () => this.sim.wrong(this.meId);
  skill = (slot: 0 | 1) => this.sim.skill(this.meId, slot);
  target = (id: string) => this.sim.setTarget(this.meId, id);
  cooldownLeft = (skill: SkillId) => this.sim.cooldownLeft(this.meId, skill);
  leave = () => clearInterval(this.timer);
}

function gaussian() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}
