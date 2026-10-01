/**
 * Thin wrapper over the Twitch OAuth and Helix endpoints KeyWar needs.
 * Plain fetch: no SDK dependency.
 */
import { config } from "../config.js";

export const STREAMER_SCOPES = ["user:read:chat", "user:write:chat"];

export const redirectUri = () => `${config.publicApiUrl}/auth/twitch/callback`;

export interface TwitchTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface TwitchUser {
  id: string;
  login: string;
  displayName: string;
}

export function authorizeUrl(state: string, scopes: string[]) {
  const q = new URLSearchParams({
    client_id: config.twitch.clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: scopes.join(" "),
    state,
  });
  return `https://id.twitch.tv/oauth2/authorize?${q}`;
}

async function tokenRequest(params: Record<string, string>): Promise<TwitchTokens> {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.twitch.clientId, client_secret: config.twitch.clientSecret, ...params }),
  });
  if (!res.ok) throw new Error(`twitch token ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: Date.now() + json.expires_in * 1000 };
}

export const exchangeCode = (code: string) => tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
export const refresh = (refreshToken: string) => tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });

export async function helix(path: string, accessToken: string, init: RequestInit = {}) {
  return fetch(`https://api.twitch.tv/helix${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": config.twitch.clientId,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

export async function getUser(accessToken: string): Promise<TwitchUser> {
  const res = await helix("/users", accessToken);
  if (!res.ok) throw new Error(`twitch users ${res.status}`);
  const { data } = (await res.json()) as { data: { id: string; login: string; display_name: string }[] };
  const u = data[0];
  if (!u) throw new Error("twitch users: empty");
  return { id: u.id, login: u.login, displayName: u.display_name };
}

/**
 * Streamer tokens, kept in memory per login (one process per region, and a
 * streamer just logs in again after a restart). Refreshed on demand.
 */
const streamers = new Map<string, { user: TwitchUser; tokens: TwitchTokens }>();

export function saveStreamer(user: TwitchUser, tokens: TwitchTokens) {
  streamers.set(user.login, { user, tokens });
}

export function getStreamer(login: string) {
  return streamers.get(login);
}

export async function freshToken(login: string): Promise<string> {
  const s = streamers.get(login);
  if (!s) throw new Error(`no twitch session for ${login}; log in again on the panel`);
  if (s.tokens.expiresAt - Date.now() < 60_000) s.tokens = await refresh(s.tokens.refreshToken);
  return s.tokens.accessToken;
}

export async function forceRefresh(login: string) {
  const s = streamers.get(login);
  if (s) s.tokens = await refresh(s.tokens.refreshToken);
}

/** Post a message in the streamer's chat, as the streamer. */
export async function sendChat(login: string, message: string) {
  const s = streamers.get(login);
  if (!s) return;
  const res = await helix("/chat/messages", await freshToken(login), {
    method: "POST",
    body: JSON.stringify({ broadcaster_id: s.user.id, sender_id: s.user.id, message: message.slice(0, 500) }),
  });
  if (!res.ok) console.warn(`[twitch] chat send ${res.status}: ${await res.text()}`);
}
