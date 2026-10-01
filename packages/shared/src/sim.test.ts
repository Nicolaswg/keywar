import { describe, expect, it } from "vitest";
import { MATCH } from "./constants.js";
import { MatchSim, type SimPlayer, type SimState } from "./sim.js";

function setup(mode: "duel" | "ffa3" | "team6" | "royale" = "ffa3", players?: number, random?: () => number) {
  let now = 1_000_000;
  const sent: { to: string; type: string; msg: unknown }[] = [];
  const state: SimState = { mode: "", lang: "", difficulty: "", phase: "", seed: 0, startsAt: 0, winnerTeam: -1, players: new Map() };
  const sim = new MatchSim(state, {
    now: () => now,
    createPlayer: () => ({ loadout: [], effects: [] }) as unknown as SimPlayer,
    createEffect: () => ({ skill: "", from: "", until: 0 }),
    send: (to, type, msg) => sent.push({ to, type, msg }),
    broadcast: (type, msg) => sent.push({ to: "*", type, msg }),
    notify: (to, type, msg) => sent.push({ to: to.join(","), type, msg }),
    random,
  }, { mode, lang: "es", difficulty: "normal", seed: 99 });
  const ids = Array.from({ length: players ?? sim.def.players }, (_, i) => `p${i}`);
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
    p0.loadout[0] = "mixer";
    victim.loadout[1] = "helmet";
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

describe("royale ring", () => {
  it("chains everyone: one attacker each, no self-targets", () => {
    const { state } = setup("royale", 10);
    const targets = new Map<string, string>();
    state.players.forEach((p) => targets.set(p.sessionId, p.targetId));
    expect(new Set(targets.values()).size).toBe(10);
    for (const [id, t] of targets) expect(t).not.toBe(id);
    // Following the chain visits everyone once.
    let cur = "p0";
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      seen.add(cur);
      cur = targets.get(cur)!;
    }
    expect(seen.size).toBe(10);
    expect(cur).toBe("p0");
  });

  it("hands the fallen player's target to their attacker and ends with one winner", () => {
    const { sim, state, sent, advanceTo } = setup("royale", 5);
    advanceTo(sim.chart[0]!.t);
    const ids = ["p0", "p1", "p2", "p3", "p4"];
    // Knock players out one by one by having each victim's attacker finish them.
    for (let round = 0; round < 4; round++) {
      const victim = [...ids].find((id) => state.players.get(id)!.alive)!;
      let attacker = "";
      state.players.forEach((p) => p.alive && p.targetId === victim && (attacker = p.sessionId));
      const inherited = state.players.get(victim)!.targetId;
      state.players.get(victim)!.hp = 1;
      state.players.get(attacker)!.streak = 0;
      const note = sim.chart.find((n, i) => i > round * 3 && n.t >= 0)!;
      advanceTo(note.t);
      sim.hit(attacker, note.id, 0);
      expect(state.players.get(victim)!.alive).toBe(false);
      if (state.phase !== "ended") expect(state.players.get(attacker)!.targetId).toBe(inherited === attacker ? "" : inherited);
    }
    advanceTo(sim.chart[20]!.t);
    expect(state.phase).toBe("ended");
    expect(sim.remaining()).toBe(1);
    expect(sent.filter((m) => m.type === "knockout")).toHaveLength(4);
  });

  it("ignores manual target switching", () => {
    const { sim, state } = setup("royale", 4);
    const before = state.players.get("p0")!.targetId;
    const other = ["p1", "p2", "p3"].find((id) => id !== before)!;
    sim.setTarget("p0", other);
    expect(state.players.get("p0")!.targetId).toBe(before);
  });

  it("sends damage only to the two players involved", () => {
    const { sim, state, sent, advanceTo } = setup("royale", 6);
    const note = sim.chart[0]!;
    advanceTo(note.t);
    sim.hit("p0", note.id, 0);
    const dmg = sent.find((m) => m.type === "damage")!;
    expect(dmg.to).toBe(`p0,${state.players.get("p0")!.targetId}`);
  });
});

describe("duel", () => {
  it("seats two players as enemies who target each other", () => {
    const { state } = setup("duel");
    expect(state.players.size).toBe(2);
    expect(state.players.get("p0")!.targetId).toBe("p1");
    expect(state.players.get("p1")!.targetId).toBe("p0");
  });
});

describe("word heal", () => {
  /** Play every letter of the first word in the chart with the given offset. */
  function finishFirstWord(random: () => number, offset: number) {
    const ctx = setup("duel", undefined, random);
    const letters = ctx.sim.chart.filter((n) => n.wordId === ctx.sim.chart.find((m) => m.wordId !== undefined)!.wordId);
    // Earlier unplayed notes now cost HP as misses: set HP right before the word.
    ctx.advanceTo(letters[0]!.t - 1);
    ctx.state.players.get("p0")!.hp = 500;
    for (const n of letters) {
      ctx.advanceTo(n.t + offset);
      ctx.sim.hit("p0", n.id, offset);
    }
    return { ...ctx, letters };
  }

  it("heals 10 HP per letter when the roll succeeds", () => {
    const { state, sent, letters } = finishFirstWord(() => 0.1, 0);
    expect(state.players.get("p0")!.hp).toBe(500 + 10 * letters.length);
    expect(sent.find((m) => m.type === "heal")?.msg).toMatchObject({ amount: 10 * letters.length, perfect: true });
  });

  it("is likelier on an all-perfect word than a sloppy one", () => {
    // A roll of 0.6 passes the perfect chance (0.75) but not the base one (0.4).
    expect(finishFirstWord(() => 0.6, 0).state.players.get("p0")!.hp).toBeGreaterThan(500);
    expect(finishFirstWord(() => 0.6, 90).state.players.get("p0")!.hp).toBe(500);
  });

  it("never heals past max HP", () => {
    const { state, sim, advanceTo } = setup("duel", undefined, () => 0);
    const word = sim.chart.filter((n) => n.wordId === sim.chart.find((m) => m.wordId !== undefined)!.wordId);
    advanceTo(word[0]!.t - 1);
    state.players.get("p0")!.hp = 995;
    for (const n of word) {
      advanceTo(n.t);
      sim.hit("p0", n.id, 0);
    }
    expect(state.players.get("p0")!.hp).toBe(1000);
  });
});

describe("life rules", () => {
  it("costs HP to let a note pass, and tells the player", () => {
    const { sim, state, sent, advanceTo } = setup("duel");
    const n = sim.chart[0]!;
    advanceTo(n.t + 1_000); // swept as a miss
    expect(state.players.get("p0")!.hp).toBe(1000 - 5);
    expect(sent.find((m) => m.to === "p0" && m.type === "selfDamage")?.msg).toEqual({ amount: 5, reason: "miss" });
  });

  it("lets the eraser absorb a miss: no HP lost, streak kept", () => {
    const { sim, state, advanceTo } = setup("duel");
    const p0 = state.players.get("p0")!;
    p0.loadout[1] = "eraser";
    p0.ink = 100;
    advanceTo(sim.chart[0]!.t - 200);
    // Not playing yet at t<0? advance into play first.
    advanceTo(sim.chart[0]!.t);
    sim.skill("p0", 1);
    p0.streak = 7;
    advanceTo(sim.chart[0]!.t + 1_000);
    expect(p0.hp).toBe(1000);
    expect(p0.streak).toBe(7);
  });
});

describe("tools", () => {
  it("deals one attack and one support tool at random", () => {
    const { state } = setup("ffa3");
    state.players.forEach((p) => {
      expect(["quake", "mirror"]).toContain(p.loadout[0]);
      expect(["helmet", "eraser"]).toContain(p.loadout[1]);
    });
  });

  it("rotates a tool every 10 hits, alternating slots, tier by streak", () => {
    const { sim, state, sent, advanceTo } = setup("duel");
    const p0 = state.players.get("p0")!;
    const [a0, a1] = [p0.loadout[0], p0.loadout[1]];
    const play = (k: number) => {
      const n = sim.chart[k]!;
      advanceTo(n.t);
      sim.hit("p0", n.id, 0);
    };
    for (let k = 0; k < 9; k++) play(k);
    expect(p0.toolHits).toBe(9);
    expect([p0.loadout[0], p0.loadout[1]]).toEqual([a0, a1]);
    play(9); // 10th hit, streak 10 → tier 2 attack
    expect(p0.toolHits).toBe(0);
    expect(["mixer", "crane", "blackout"]).toContain(p0.loadout[0]);
    expect(p0.loadout[1]).toBe(a1);
    for (let k = 10; k < 20; k++) play(k); // 20th hit, streak 20 → support slot rotates
    expect(p0.loadout[1]).not.toBe(a1);
    expect(sent.filter((m) => m.type === "skillUpgrade")).toHaveLength(2);
  });

});
