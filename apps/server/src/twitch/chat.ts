/**
 * Reads a streamer's chat through EventSub over WebSocket (the official
 * replacement for IRC). It runs on the streamer's own token, so no bot
 * account is needed, and it works from localhost: unlike webhooks, it needs
 * no public URL.
 */
import { WebSocket } from "ws";
import type { ChatBadges } from "@keywar/shared";
import { forceRefresh, freshToken, getStreamer, helix } from "./helix.js";

const EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws";

export interface ChatMessage {
  login: string;
  displayName: string;
  text: string;
  badges: ChatBadges;
}

export class ChatListener {
  private ws?: WebSocket;
  private closed = false;
  private keepaliveTimer?: ReturnType<typeof setTimeout>;
  private keepaliveMs = 15_000;

  constructor(
    readonly channel: string,
    private onMessage: (m: ChatMessage) => void,
  ) {}

  start(url = EVENTSUB_URL) {
    this.closed = false;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.on("message", (raw) => this.handle(JSON.parse(raw.toString())));
    ws.on("close", () => {
      clearTimeout(this.keepaliveTimer);
      if (!this.closed && this.ws === ws) setTimeout(() => this.start(), 3_000);
    });
    ws.on("error", (e) => console.warn(`[twitch:${this.channel}] eventsub socket error`, e.message));
  }

  stop() {
    this.closed = true;
    clearTimeout(this.keepaliveTimer);
    this.ws?.close();
  }

  /** If Twitch goes quiet past the keepalive window, the socket is dead: reconnect. */
  private armKeepalive() {
    clearTimeout(this.keepaliveTimer);
    this.keepaliveTimer = setTimeout(() => this.ws?.terminate(), this.keepaliveMs + 5_000);
  }

  private async handle(msg: EventSubMessage) {
    this.armKeepalive();
    const type = msg.metadata?.message_type;
    if (type === "session_welcome") {
      this.keepaliveMs = (msg.payload.session?.keepalive_timeout_seconds ?? 10) * 1000;
      await this.subscribe(msg.payload.session!.id).catch((e) => console.warn(`[twitch:${this.channel}] subscribe failed`, e));
    } else if (type === "session_reconnect" && msg.payload.session?.reconnect_url) {
      // Twitch asks us to move: open the new socket, then drop the old one.
      const old = this.ws;
      this.start(msg.payload.session.reconnect_url);
      old?.removeAllListeners("close");
      old?.close();
    } else if (type === "notification" && msg.payload.event) {
      const e = msg.payload.event;
      const badges = new Set((e.badges ?? []).map((b) => b.set_id));
      this.onMessage({
        login: e.chatter_user_login,
        displayName: e.chatter_user_name,
        text: e.message?.text ?? "",
        badges: { broadcaster: badges.has("broadcaster"), moderator: badges.has("moderator") },
      });
    }
  }

  private async subscribe(sessionId: string, retried = false): Promise<void> {
    const s = getStreamer(this.channel);
    if (!s) throw new Error("streamer not logged in");
    const res = await helix("/eventsub/subscriptions", await freshToken(this.channel), {
      method: "POST",
      body: JSON.stringify({
        type: "channel.chat.message",
        version: "1",
        condition: { broadcaster_user_id: s.user.id, user_id: s.user.id },
        transport: { method: "websocket", session_id: sessionId },
      }),
    });
    if (res.status === 401 && !retried) {
      await forceRefresh(this.channel);
      return this.subscribe(sessionId, true);
    }
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    console.log(`[twitch:${this.channel}] listening to chat`);
  }
}

interface EventSubMessage {
  metadata?: { message_type?: string };
  payload: {
    session?: { id: string; keepalive_timeout_seconds?: number; reconnect_url?: string };
    event?: {
      chatter_user_login: string;
      chatter_user_name: string;
      message?: { text?: string };
      badges?: { set_id: string }[];
    };
  };
}
