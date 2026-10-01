/**
 * Glue between a channel's chat, its streamer panel and its RoyaleRoom.
 * One process serves one region, so plain in-memory maps are enough.
 */
import { matchMaker } from "@colyseus/core";
import { DEFAULT_CHAT_COMMAND, parseChatCommand, type Difficulty, type Lang } from "@keywar/shared";
import { config, twitchEnabled } from "../config.js";
import type { RoyaleRoom } from "../rooms/RoyaleRoom.js";
import { ChatListener, type ChatMessage } from "./chat.js";
import { getStreamer, sendChat } from "./helix.js";

export interface ChannelSettings {
  lang: Lang;
  difficulty: Difficulty;
  command: string;
  maxPlayers: number;
  /** Confirm sign-ups in chat ("@pepe ¡dentro! #12"). */
  replyInChat: boolean;
}

export const DEFAULT_SETTINGS: ChannelSettings = {
  lang: "es",
  difficulty: "normal",
  command: DEFAULT_CHAT_COMMAND,
  maxPlayers: 100,
  replyInChat: true,
};

/** channel → live room (set by RoyaleRoom itself). */
export const rooms = new Map<string, RoyaleRoom>();
/** channel → moment the streamer pressed "stop everything": player sessions older than this are logged out. */
const revokedAt = new Map<string, number>();

export function sessionRevoked(channel: string, issuedAt: number) {
  return issuedAt <= (revokedAt.get(channel) ?? 0);
}

/**
 * The streamer's emergency brake: end whatever is running (sign-ups or match),
 * stop reading chat, and log every participant out of this channel. They
 * must sign in again to come back.
 */
export function stopEverything(channel: string) {
  revokedAt.set(channel, Date.now());
  rooms.get(channel)?.stopAll();
  stopChat(channel);
  replyQueues.delete(channel);
}
const listeners = new Map<string, ChatListener>();
const settings = new Map<string, ChannelSettings>();
const replyQueues = new Map<string, { joined: string[]; timer?: ReturnType<typeof setTimeout> }>();

export const joinUrl = (channel: string) => `${config.publicWebUrl}/c/${channel}?r=${encodeURIComponent(config.region)}`;

export function getSettings(channel: string) {
  return settings.get(channel) ?? DEFAULT_SETTINGS;
}

/** Open sign-ups: create (or recycle) the channel's room and start reading its chat. */
export async function openEvent(channel: string, channelName: string, next?: Partial<ChannelSettings>) {
  const s: ChannelSettings = { ...getSettings(channel), ...next };
  settings.set(channel, s);

  const current = rooms.get(channel);
  if (current && current.state.stage === "closed") {
    current.reopen();
    return current;
  }
  if (current && current.state.stage === "registering") return current;
  // A finished (or running) match: the next round is a fresh room.
  if (current) await current.disconnect();

  await matchMaker.createRoom("royale", {
    channel,
    channelName,
    lang: s.lang,
    difficulty: s.difficulty,
    command: s.command,
    maxPlayers: s.maxPlayers,
  });
  ensureChat(channel);
  return rooms.get(channel)!;
}

/** Start the EventSub chat reader for a real Twitch streamer (not for fake dev channels). */
function ensureChat(channel: string) {
  if (!twitchEnabled() || listeners.has(channel) || !getStreamer(channel)) return;
  const listener = new ChatListener(channel, (m) => handleChat(channel, m));
  listener.start();
  listeners.set(channel, listener);
}

export function chatConnected(channel: string) {
  return listeners.has(channel);
}

/** Every chat line goes through here, real or simulated. */
export async function handleChat(channel: string, m: ChatMessage) {
  const room = rooms.get(channel);
  const cmd = parseChatCommand(m.text, m.badges, { command: room?.state.command ?? getSettings(channel).command });
  if (!cmd) return;

  if (cmd.type === "join") {
    if (!room) return;
    const res = room.register(m.login, m.displayName);
    if (res.ok && !res.already) queueReply(channel, res.waitlisted ? `${m.displayName} (espera)` : m.displayName);
    return;
  }

  switch (cmd.action) {
    case "open":
      await openEvent(channel, room?.state.channelName ?? channel);
      break;
    case "start":
      room?.start();
      break;
    case "close":
      room?.close();
      break;
    case "cancel":
      room?.cancel();
      break;
  }
}

/** Batch sign-up confirmations so a rush of 100 joins is a handful of chat lines, not 100. */
function queueReply(channel: string, name: string) {
  if (!getSettings(channel).replyInChat || !listeners.has(channel)) return;
  const q = replyQueues.get(channel) ?? { joined: [] };
  replyQueues.set(channel, q);
  q.joined.push(name);
  q.timer ??= setTimeout(() => {
    const names = q.joined.splice(0);
    q.timer = undefined;
    const tail = getSettings(channel).lang === "es" ? ` ¡dentro! Juega aquí → ${joinUrl(channel)}` : ` you're in! Play here → ${joinUrl(channel)}`;
    let line = "";
    for (const n of names) {
      const next = `${line}@${n} `;
      if (next.length + tail.length > 480) {
        void sendChat(channel, line.trim() + tail);
        line = "";
      }
      line += `@${n} `;
    }
    if (line) void sendChat(channel, line.trim() + tail);
  }, 4_000);
}

export function stopChat(channel: string) {
  listeners.get(channel)?.stop();
  listeners.delete(channel);
}
