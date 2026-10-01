import { describe, expect, it } from "vitest";
import { fillSeats, normalizeCommand, parseChatCommand } from "./twitch.js";

const cfg = { command: "!keywar" };

describe("parseChatCommand", () => {
  it("lets anyone join, case- and space-insensitive", () => {
    expect(parseChatCommand("!keywar", {}, cfg)).toEqual({ type: "join" });
    expect(parseChatCommand("  !KEYWAR  vamos", {}, cfg)).toEqual({ type: "join" });
    expect(parseChatCommand("keywar", {}, cfg)).toBeNull();
    expect(parseChatCommand("!keywarr", {}, cfg)).toBeNull();
  });

  it("supports a custom command", () => {
    expect(parseChatCommand("!pelea", {}, { command: "pelea" })).toEqual({ type: "join" });
    expect(normalizeCommand("  !!Pelea Ya ")).toBe("!peleaya");
    expect(normalizeCommand("!")).toBe("!keywar");
  });

  it("only obeys mod commands from mods and the broadcaster", () => {
    expect(parseChatCommand("!kw empezar", {}, cfg)).toBeNull();
    expect(parseChatCommand("!kw empezar", { moderator: true }, cfg)).toEqual({ type: "mod", action: "start" });
    expect(parseChatCommand("!KW Abrir", { broadcaster: true }, cfg)).toEqual({ type: "mod", action: "open" });
    expect(parseChatCommand("!kw close", { moderator: true }, cfg)).toEqual({ type: "mod", action: "close" });
    expect(parseChatCommand("!kw bailar", { moderator: true }, cfg)).toBeNull();
  });
});

describe("fillSeats", () => {
  it("seats connected entrants in order, then the connected waitlist", () => {
    const entrants = ["a", "b", "c", "d"];
    const waitlist = ["w1", "w2", "w3"];
    const connected = new Set(["a", "c", "d", "w2", "w3"]);
    expect(fillSeats(entrants, waitlist, connected, 4)).toEqual(["a", "c", "d", "w2"]);
    expect(fillSeats(entrants, waitlist, connected, 10)).toEqual(["a", "c", "d", "w2", "w3"]);
  });
});
