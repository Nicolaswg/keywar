import { describe, expect, it } from "vitest";
import { MATCH } from "./constants.js";
import { MatchSim, type SimPlayer, type SimState } from "./sim.js";

function setup(mode: "ffa3" | "team6" = "ffa3") {
  let now = 1_000_000;
  const sent: { to: string; type: string; msg: unknown }[] = [];
  const state: SimState = { mode: "", lang: "", difficulty: "", phase: "", seed: 0, startsAt: 0, winnerTeam: -1, players: new Map() };
  const sim = new MatchSim(state, {
    now: () => now,
    createPlayer: () => ({ loadout: [], effects: [] }) as unknown as SimPlayer,
    createEffect: () => ({ skill: "", from: "", until: 0 }),
    send: (to, type, msg) => sent.push({ to, type, msg }),
    broadcast: (type, msg) => sent.push({ to: "*", type, msg }),
  }, { mode, lang: "es", difficulty: "normal", seed: 99 });
  const ids = Array.from({ length: sim.def.players }, (_, i) => `p${i}`);
  for (const id of ids) sim.join(id, { name: id, loadout: ["mixer", "helmet"] });
  sim.startCountdown();
  const advanceTo = (matchMs: number) => {
    now = state.startsAt + matchMs;
    sim.tick();
  };
  return { sim, state, ids, sent, advanceTo };
}

describe("MatchSim", () => {
  it("starts on countdown and deals damage on a perfect hit", () => {
    const { sim, state, advanceTo } = setup();
    const note = sim.chart[0]!;
    advanceTo(note.t + 10);
    expect(state.phase).toBe("playing");
    sim.hit("p0", note.id, 5);
    const me = state.players.get("p0")!;
    const target = state.players.get(me.targetId)!;
    expect(me.streak).toBe(1);
    expect(target.hp).toBeLessThan(MATCH.maxHp);
  });

  it("sweeps unhit notes as misses and rejects stale hits", () => {
    const { sim, state, advanceTo } = setup();
    const [a, b] = sim.chart;
    advanceTo(a!.t);
    sim.hit("p0", a!.id, 0);
    advanceTo(b!.t + 2_000);
    sim.hit("p0", b!.id, 0); // 2 s late: ignored
    expect(state.players.get("p0")!.streak).toBe(0);
  });

  it("helmet blocks the next sabotage", () => {
    const { sim, state, advanceTo } = setup();
    advanceTo(sim.chart[0]!.t);
    const p0 = state.players.get("p0")!;
    const victim = state.players.get(p0.targetId)!;
    p0.ink = 100;
    victim.ink = 100;
    sim.skill(victim.sessionId, 1); // helmet
    sim.skill("p0", 0); // mixer
    expect(victim.effects.some((e) => e.skill === "mixer")).toBe(false);
    expect(victim.effects.some((e) => e.skill === "helmet")).toBe(false);
  });

  it("ends when one team is left and names the winner", () => {
    const { state, advanceTo } = setup();
    advanceTo(100);
    state.players.get("p1")!.alive = false;
    state.players.get("p2")!.alive = false;
    advanceTo(200);
    expect(state.phase).toBe("ended");
    expect(state.winnerTeam).toBe(0);
  });

  it("puts six players in two teams", () => {
    const { state } = setup("team6");
    const teams = new Set<number>();
    state.players.forEach((p) => teams.add(p.team));
    expect([...teams].sort()).toEqual([0, 1]);
  });
});
