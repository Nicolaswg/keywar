import express, { type Application, type NextFunction, type Request, type Response } from "express";
import { DIFFICULTY_IDS, LANGS, normalizeCommand, type Difficulty, type Lang } from "@keywar/shared";
import { config, twitchEnabled } from "../config.js";
import { STREAMER_SCOPES, authorizeUrl, exchangeCode, getUser, saveStreamer } from "./helix.js";
import { chatConnected, getSettings, handleChat, joinUrl, openEvent, rooms, stopChat, stopEverything, type ChannelSettings } from "./registry.js";
import { issueToken, readState, signState, toLogin, verifyToken, type Identity, type SessionRole } from "./session.js";

/** Only send the user back to a path on our own web app. */
const safeReturn = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/");

export function mountTwitchRoutes(app: Application) {
  app.use("/auth", cors);
  app.use("/api", cors, express.json());

  /** What the client can offer: real Twitch login, fake dev identities, or nothing. */
  app.get("/api/config", (_req, res) => {
    res.json({ twitch: twitchEnabled(), dev: config.devTwitch, region: config.region });
  });

  /** Public: is there a battle on this channel, and what do viewers type to join? */
  app.get("/api/twitch/channel/:channel", (req, res) => {
    const room = rooms.get(String(req.params.channel).toLowerCase());
    res.json(room ? { open: true, stage: room.state.stage, command: room.state.command, channelName: room.state.channelName } : { open: false, command: getSettings(String(req.params.channel)).command });
  });

  /* ---------------- login ---------------- */

  app.get("/auth/twitch/login", (req, res) => {
    if (!twitchEnabled()) return void res.status(503).send("Twitch login is not configured on this server (TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET).");
    const role: SessionRole = req.query.role === "streamer" ? "streamer" : "player";
    const state = signState({ role, ret: safeReturn(req.query.return) });
    res.redirect(authorizeUrl(state, role === "streamer" ? STREAMER_SCOPES : []));
  });

  app.get("/auth/twitch/callback", async (req, res) => {
    const st = readState<{ role: SessionRole; ret: string }>(req.query.state);
    const code = req.query.code;
    if (!st || typeof code !== "string") return void res.status(400).send("Login expired or was cancelled. Go back and try again.");
    try {
      const tokens = await exchangeCode(code);
      const user = await getUser(tokens.accessToken);
      if (st.role === "streamer") saveStreamer(user, tokens);
      const token = issueToken({ id: user.id, login: user.login, displayName: user.displayName, role: st.role });
      res.redirect(`${config.publicWebUrl}${st.ret}#token=${encodeURIComponent(token)}`);
    } catch (e) {
      console.warn("[twitch] login failed", e);
      res.status(502).send("Twitch login failed. Try again.");
    }
  });

  if (config.devTwitch) {
    /** Dev only: any name becomes a fake Twitch identity. */
    app.get("/auth/dev/login", (req, res) => {
      const name = String(req.query.name ?? "").trim() || "dev";
      const login = toLogin(name) || "dev";
      const role: SessionRole = req.query.role === "streamer" ? "streamer" : "player";
      res.json({ token: issueToken({ id: `dev-${login}`, login, displayName: name.slice(0, 25), role }) });
    });
  }

  /* ---------------- streamer panel ---------------- */

  app.get("/api/twitch/me", streamerOnly, (req, res) => {
    const me = res.locals.identity as Identity;
    const room = rooms.get(me.login);
    res.json({
      login: me.login,
      displayName: me.displayName,
      settings: getSettings(me.login),
      chatConnected: chatConnected(me.login),
      stage: room?.state.stage ?? null,
      joinUrl: joinUrl(me.login),
      dev: config.devTwitch && me.id.startsWith("dev-"),
    });
  });

  app.post("/api/twitch/open", streamerOnly, async (req, res) => {
    const me = res.locals.identity as Identity;
    const room = await openEvent(me.login, me.displayName, parseSettings(req.body));
    res.json({ ok: true, stage: room.state.stage, chatConnected: chatConnected(me.login) });
  });

  app.post("/api/twitch/start", streamerOnly, (_req, res) => {
    const room = rooms.get((res.locals.identity as Identity).login);
    res.json(room ? room.start() : { ok: false, reason: "no_event" });
  });

  app.post("/api/twitch/close", streamerOnly, (_req, res) => {
    rooms.get((res.locals.identity as Identity).login)?.close();
    res.json({ ok: true });
  });

  app.post("/api/twitch/cancel", streamerOnly, (_req, res) => {
    const login = (res.locals.identity as Identity).login;
    rooms.get(login)?.cancel();
    stopChat(login);
    res.json({ ok: true });
  });

  /** Emergency brake: ends sign-ups or the match, disconnects chat, logs every participant out. Always available. */
  app.post("/api/twitch/stop", streamerOnly, (_req, res) => {
    stopEverything((res.locals.identity as Identity).login);
    res.json({ ok: true });
  });

  app.post("/api/twitch/kick", streamerOnly, (req, res) => {
    const ok = rooms.get((res.locals.identity as Identity).login)?.kick(String(req.body?.login ?? "")) ?? false;
    res.json({ ok });
  });

  if (config.devTwitch) {
    /** Dev only: inject a chat line exactly as EventSub would deliver it. */
    app.post("/api/twitch/dev/chat", streamerOnly, async (req, res) => {
      const name = String(req.body?.user ?? "").trim();
      const login = toLogin(name);
      if (!login) return void res.status(400).json({ ok: false });
      const mod = Boolean(req.body?.mod);
      await handleChat((res.locals.identity as Identity).login, {
        login,
        displayName: name.slice(0, 25),
        text: String(req.body?.text ?? ""),
        badges: { moderator: mod },
      });
      res.json({ ok: true });
    });
  }
}

function parseSettings(body: unknown): Partial<ChannelSettings> {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: Partial<ChannelSettings> = {};
  if (LANGS.includes(b.lang as Lang)) out.lang = b.lang as Lang;
  if (DIFFICULTY_IDS.includes(b.difficulty as Difficulty)) out.difficulty = b.difficulty as Difficulty;
  if (typeof b.command === "string") out.command = normalizeCommand(b.command);
  if (typeof b.maxPlayers === "number") out.maxPlayers = Math.round(Math.min(100, Math.max(2, b.maxPlayers)));
  if (typeof b.replyInChat === "boolean") out.replyInChat = b.replyInChat;
  return out;
}

function streamerOnly(req: Request, res: Response, next: NextFunction) {
  const identity = verifyToken(req.headers.authorization?.replace(/^Bearer /, ""));
  if (!identity || identity.role !== "streamer") return void res.status(401).json({ error: "streamer_login_required" });
  res.locals.identity = identity;
  next();
}

/** The web app lives on another origin (Vite dev server, or the static site in production). */
function cors(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Access-Control-Allow-Origin", config.publicWebUrl);
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return void res.sendStatus(204);
  next();
}
