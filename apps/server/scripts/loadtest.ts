/**
 * Fill a Twitch chat battle with bots, for local testing and load testing.
 * Needs the server running with DEV_FAKE_TWITCH=1.
 *
 *   pnpm --filter @keywar/server loadtest -- --channel dev --bots 99          # bots sign up and wait; you start from the panel
 *   pnpm --filter @keywar/server loadtest -- --channel dev --bots 100 --start # also starts and plays the whole match
 *
 * Each bot signs up through the chat simulator (same path as a real "!keywar"),
 * joins the room and plays the real chart with ~85% accuracy.
 */
import { readFileSync } from "node:fs";
import { Client, type Room } from "@colyseus/sdk";
import { generateChart, type Difficulty, type Lang } from "@keywar/shared";

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1]!.startsWith("--") ? args[i + 1]! : fallback;
};
const url = arg("url", "ws://localhost:2567");
const http = url.replace(/^ws/, "http");
const channel = arg("channel", "dev");
const bots = Number(arg("bots", "99"));
const autoStart = args.includes("--start");

async function devToken(name: string, role: "player" | "streamer") {
  const res = await fetch(`${http}/auth/dev/login?name=${encodeURIComponent(name)}&role=${role}`);
  if (!res.ok) throw new Error(`dev login failed (${res.status}). Is the server running with DEV_FAKE_TWITCH=1?`);
  return ((await res.json()) as { token: string }).token;
}

async function api(path: string, token: string, body: unknown = {}) {
  const res = await fetch(`${http}/api/twitch/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

const loopbackBytes = () => {
  try {
    return Number(readFileSync("/sys/class/net/lo/statistics/tx_bytes", "utf8"));
  } catch {
    return NaN;
  }
};

const streamer = await devToken(channel, "streamer");
await api("open", streamer); // no-op if sign-ups are already open
console.log(`Sign-ups open on "${channel}". Adding ${bots} bots…`);

const rooms: Room[] = [];
for (let i = 1; i <= bots; i++) {
  const name = `bot_${String(i).padStart(3, "0")}`;
  await api("dev/chat", streamer, { user: name, text: "!keywar" });
  const token = await devToken(name, "player");
  const room = await new Client(url).join("royale", { channel, token, role: "player" });
  rooms.push(room);
  playLikeABot(room);
}
console.log(`${rooms.length} bots connected.`);

if (!autoStart) {
  console.log("Start the match from the panel (/stream) or with !kw empezar. Ctrl+C to remove the bots.");
} else {
  const res = await api("start", streamer);
  console.log("start →", res);
  const t0 = Date.now();
  const b0 = loopbackBytes();
  const state = rooms[0]!.state;
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      if (state.phase === "ended") {
        clearInterval(iv);
        resolve();
      }
    }, 500);
  });
  const secs = (Date.now() - t0) / 1000;
  const mbps = (loopbackBytes() - b0) / secs / 1024 / 1024;
  let winner = "";
  state.players.forEach((p: { team: number; name: string }) => p.team === state.winnerTeam && (winner = p.name));
  console.log(`Match over in ${secs.toFixed(0)} s (incl. countdown). Winner: ${winner}. Remaining: ${state.remaining}.`);
  console.log(`Loopback traffic during the match: ${mbps.toFixed(2)} MB/s (server → clients + clients → server).`);
  for (const r of rooms) void r.leave();
  setTimeout(() => process.exit(0), 500);
}

/** Plays the seated bot's chart with human-ish accuracy and timing spread. */
function playLikeABot(room: Room) {
  let offset = 0;
  room.onMessage("clock", (m: { c: number; s: number }) => (offset = m.s - (m.c + (Date.now() - m.c) / 2)));
  for (const t of ["judged", "damage", "skillCast", "knockout"]) room.onMessage(t, () => {});
  room.send("clock", { c: Date.now() });

  let started = false;
  room.onStateChange((s: any) => {
    if (started || s.phase !== "countdown" || !s.players.has(room.sessionId)) return;
    started = true;
    const chart = generateChart(s.seed, s.lang as Lang, s.difficulty as Difficulty);
    const skill = 0.75 + Math.random() * 0.2;
    for (const n of chart) {
      if (Math.random() > skill) continue;
      const press = n.t + (Math.random() - 0.5) * 120;
      const delay = s.startsAt + press - (Date.now() + offset);
      if (delay > 0) setTimeout(() => s.phase === "playing" && room.send("hit", { noteId: n.id, offset: Math.round(press - n.t) }), delay);
    }
  });
}
