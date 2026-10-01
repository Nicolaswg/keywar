/** Server configuration from the environment, read once. */

// Local secrets live in apps/server/.env (gitignored). Real env vars win.
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env file: fine */
}

const env = process.env;
const production = env.NODE_ENV === "production";

export const config = {
  port: Number(env.PORT) || 2567,
  region: env.REGION ?? "local",
  /** Where the web client lives (OAuth redirects back here). */
  publicWebUrl: (env.PUBLIC_WEB_URL ?? "http://localhost:5173").replace(/\/$/, ""),
  /** Public URL of this server's HTTP API (used for the OAuth redirect URI). */
  publicApiUrl: (env.PUBLIC_API_URL ?? `http://localhost:${Number(env.PORT) || 2567}`).replace(/\/$/, ""),
  twitch: {
    clientId: env.TWITCH_CLIENT_ID ?? "",
    clientSecret: env.TWITCH_CLIENT_SECRET ?? "",
  },
  /**
   * Fake Twitch identities and the chat simulator, for local development.
   * Hard-disabled in production whatever the variable says.
   */
  devTwitch: env.DEV_FAKE_TWITCH === "1" && !production,
  sessionSecret: env.SESSION_SECRET ?? "",
  production,
};

export const twitchEnabled = () => Boolean(config.twitch.clientId && config.twitch.clientSecret);

if (!config.sessionSecret) {
  if (production && twitchEnabled()) throw new Error("SESSION_SECRET is required in production");
  // Stable across tsx-watch restarts so dev logins survive code edits.
  config.sessionSecret = "keywar-dev-only-secret";
}
