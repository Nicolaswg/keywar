/**
 * Twitch login and the streamer API, talking to the regional server that
 * hosts the channel's battle.
 */
import { configuredRegions } from "./regions";

export type TokenRole = "player" | "streamer";

export interface ServerConfig {
  twitch: boolean;
  dev: boolean;
  region: string;
}

const KEY = (role: TokenRole) => `keywar.token.${role}`;

/** ws(s)://host → http(s)://host */
export const httpBase = (wsUrl: string) => wsUrl.replace(/^ws/, "http").replace(/\/$/, "");

/** The region in ?r=, else the first configured one. */
export function regionFromUrl() {
  const regions = configuredRegions();
  const wanted = new URLSearchParams(location.search).get("r");
  return regions.find((r) => r.id === wanted) ?? regions[0]!;
}

export function getToken(role: TokenRole): string | null {
  try {
    return localStorage.getItem(KEY(role));
  } catch {
    return null;
  }
}

export function setToken(role: TokenRole, token: string | null) {
  try {
    if (token) localStorage.setItem(KEY(role), token);
    else localStorage.removeItem(KEY(role));
  } catch {
    /* private mode: login lasts for this page only */
  }
}

/** After the Twitch redirect the token arrives in the URL fragment; keep it and clean the address bar. */
export function consumeTokenFromHash(role: TokenRole) {
  const m = location.hash.match(/token=([^&]+)/);
  if (!m) return;
  setToken(role, decodeURIComponent(m[1]!));
  history.replaceState(null, "", location.pathname + location.search);
}

export async function fetchConfig(wsUrl: string): Promise<ServerConfig | null> {
  try {
    const res = await fetch(`${httpBase(wsUrl)}/api/config`);
    return res.ok ? ((await res.json()) as ServerConfig) : null;
  } catch {
    return null;
  }
}

export async function fetchChannel(wsUrl: string, channel: string): Promise<{ open: boolean; command: string; stage?: string; channelName?: string } | null> {
  try {
    const res = await fetch(`${httpBase(wsUrl)}/api/twitch/channel/${channel}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export function twitchLoginUrl(wsUrl: string, role: TokenRole) {
  const ret = location.pathname + location.search;
  return `${httpBase(wsUrl)}/auth/twitch/login?role=${role}&return=${encodeURIComponent(ret)}`;
}

export async function devLogin(wsUrl: string, name: string, role: TokenRole) {
  const res = await fetch(`${httpBase(wsUrl)}/auth/dev/login?name=${encodeURIComponent(name)}&role=${role}`);
  if (!res.ok) throw new Error("dev login unavailable");
  const { token } = (await res.json()) as { token: string };
  setToken(role, token);
  return token;
}

/** Login (Twitch name) from a token, without verifying it (the server does that). */
export function tokenLogin(token: string | null): string | null {
  if (!token) return null;
  try {
    return (JSON.parse(atob(token.split(".")[0]!.replace(/-/g, "+").replace(/_/g, "/"))) as { login: string }).login;
  } catch {
    return null;
  }
}

export async function streamerApi<T = Record<string, unknown>>(wsUrl: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${httpBase(wsUrl)}/api/twitch/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${getToken("streamer") ?? ""}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    setToken("streamer", null);
    throw new Error("login");
  }
  return (await res.json()) as T;
}
