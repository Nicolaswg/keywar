import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

export type SessionRole = "player" | "streamer";

export interface Identity {
  /** Twitch user id ("dev-<login>" for fake identities). */
  id: string;
  /** Lowercase Twitch login: the stable key everywhere. */
  login: string;
  displayName: string;
  role: SessionRole;
}

interface Payload extends Identity {
  exp: number;
  /** Issued at (ms). Lets a streamer log out everyone who signed in before "stop everything". */
  iat: number;
}

const DAY = 24 * 60 * 60 * 1000;

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (body: string) => createHmac("sha256", config.sessionSecret).update(body).digest("base64url");

/** Compact signed token: base64url(json).signature. Not a JWT, same idea, no dependency. */
export function issueToken(identity: Identity, ttlMs = 7 * DAY): string {
  const now = Date.now();
  const body = b64(JSON.stringify({ ...identity, exp: now + ttlMs, iat: now } satisfies Payload));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: unknown): (Identity & { iat: number }) | null {
  if (typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (p.exp < Date.now()) return null;
    return { id: p.id, login: p.login, displayName: p.displayName, role: p.role, iat: p.iat ?? 0 };
  } catch {
    return null;
  }
}

/** Short-lived signed value for the OAuth `state` parameter (CSRF + where to return). */
export function signState(data: object): string {
  const body = b64(JSON.stringify({ ...data, exp: Date.now() + 10 * 60 * 1000 }));
  return `${body}.${sign(body)}`;
}

export function readState<T>(state: unknown): T | null {
  if (typeof state !== "string") return null;
  const [body, sig] = state.split(".");
  if (!body || !sig || sign(body) !== sig) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
  return data.exp > Date.now() ? data : null;
}

/** Twitch logins are 4–25 chars of [a-z0-9_]; fake dev names are squeezed into the same shape. */
export function toLogin(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 25);
}
