import { describe, expect, it } from "vitest";
import { CONTROL_KEYS, MATCH, multiplierFor } from "./constants.js";
import { generateChart } from "./chart.js";
import { damageFor, judge } from "./judge.js";
import { LAYOUTS, SLOT_BY_CODE } from "./keys.js";

describe("chart", () => {
  it("is deterministic per seed", () => {
    expect(generateChart(42, "es")).toEqual(generateChart(42, "es"));
    expect(generateChart(42, "es")).not.toEqual(generateChart(43, "es"));
  });

  it("never uses control keys, dead keys or unknown positions", () => {
    const control = new Set<string>(Object.values(CONTROL_KEYS));
    for (const lang of ["es", "en"] as const) {
      const layout = lang === "es" ? "es" : "us";
      for (const n of generateChart(7, lang)) {
        expect(control.has(n.key.code)).toBe(false);
        expect(LAYOUTS[layout][n.key.code]).toBeTruthy();
        expect(SLOT_BY_CODE.has(n.key.code)).toBe(true);
      }
    }
  });

  it("is ordered, fits the match and keeps notes apart", () => {
    const chart = generateChart(1, "en");
    expect(chart.length).toBeGreaterThan(120);
    for (let i = 1; i < chart.length; i++) {
      expect(chart[i]!.t).toBeGreaterThan(chart[i - 1]!.t + 250);
    }
    expect(chart.at(-1)!.t).toBeLessThan(MATCH.durationMs);
  });
});

describe("difficulty", () => {
  it("gets denser and faster from easy to expert", () => {
    const easy = generateChart(3, "es", "easy");
    const normal = generateChart(3, "es", "normal");
    const expert = generateChart(3, "es", "expert");
    expect(easy.length).toBeLessThan(normal.length);
    expect(normal.length).toBeLessThan(expert.length);
    expect(easy.some((n) => n.key.ctrl)).toBe(false);
  });

  it("is more forgiving on easy", () => {
    expect(judge(170, "easy")).toBe("good");
    expect(judge(170, "normal")).toBe("miss");
    expect(judge(45, "expert")).toBe("great");
  });
});

describe("judge", () => {
  it("maps offsets to windows", () => {
    expect(judge(0)).toBe("perfect");
    expect(judge(-70)).toBe("great");
    expect(judge(140)).toBe("good");
    expect(judge(200)).toBe("miss");
  });

  it("scales damage with streak and chords", () => {
    const tap = { key: { code: "KeyA", shift: false, ctrl: false }, kind: "tap" as const };
    const chord = { key: { code: "KeyA", shift: true, ctrl: false }, kind: "tap" as const };
    expect(multiplierFor(30)).toBe(3);
    expect(damageFor({ judgement: "perfect", note: tap, streak: 0, phaseScale: 1 })).toBe(6);
    expect(damageFor({ judgement: "perfect", note: chord, streak: 10, phaseScale: 1 })).toBe(18);
    expect(damageFor({ judgement: "miss", note: tap, streak: 50, phaseScale: 2 })).toBe(0);
  });
});
