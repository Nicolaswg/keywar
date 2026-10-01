import { useEffect, useState, useSyncExternalStore } from "react";
import { CLOSE_CODES } from "@keywar/shared";
import { Building, Button, Callout, Field, Sign } from "../../ds";
import { strings, type T } from "../../i18n/strings";
import { OnlineSession } from "../../net/online";
import { consumeTokenFromHash, devLogin, fetchChannel, fetchConfig, getToken, regionFromUrl, setToken, tokenLogin, twitchLoginUrl, type ServerConfig } from "../../net/twitch";
import type { Profile } from "../../profile";
import { MatchFlow } from "../MatchFlow";
import "../home.css";
import "./twitch.css";

type JoinState =
  | { kind: "loading" }
  | { kind: "login" }
  | { kind: "not_registered" }
  | { kind: "no_event" }
  | { kind: "error"; message: string }
  | { kind: "in"; session: OnlineSession };

const RETRY_MS = 3_000;

/** /c/<channel>: a viewer signs in, waits in the channel's room, and plays when the streamer starts. */
export function ChannelJoin({ channel, profile, onProfile }: { channel: string; profile: Profile; onProfile: (p: Profile) => void }) {
  const t = strings(profile.lang);
  const region = regionFromUrl();
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [token, setTokenState] = useState<string | null>(() => {
    consumeTokenFromHash("player");
    return getToken("player");
  });
  const [state, setState] = useState<JoinState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [command, setCommand] = useState("!keywar");
  const [notice, setNotice] = useState<"logged_out" | null>(null);

  useEffect(() => {
    void fetchChannel(region.url, channel).then((c) => c && setCommand(c.command));
  }, [region.url, channel, attempt]);

  useEffect(() => {
    void fetchConfig(region.url).then(setConfig);
  }, [region.url]);

  // Try to join; while not registered (or no battle open), keep retrying quietly.
  useEffect(() => {
    if (!token) {
      setState({ kind: "login" });
      return;
    }
    let live = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    OnlineSession.joinRoyale(region.url, channel, { token, role: "player", loadout: profile.loadout })
      .then((session) => {
        if (live) setState({ kind: "in", session });
        else session.leave();
      })
      .catch((e: { code?: number; message?: string }) => {
        if (!live) return;
        const msg = String(e?.message ?? "");
        if (e?.code === 401 || msg.includes("login_required") || msg.includes("logged_out")) {
          setToken("player", null);
          setTokenState(null);
          if (msg.includes("logged_out")) setNotice("logged_out");
          return;
        }
        setState(msg.includes("not_registered") ? { kind: "not_registered" } : /no rooms|not found|criteria/i.test(msg) ? { kind: "no_event" } : { kind: "error", message: msg });
        retry = setTimeout(() => setAttempt((a) => a + 1), RETRY_MS);
      });
    return () => {
      live = false;
      clearTimeout(retry);
    };
  }, [token, attempt, channel, region.url]); // eslint-disable-line react-hooks/exhaustive-deps

  const leave = () => {
    if (state.kind === "in") state.session.leave();
    setState({ kind: "loading" });
    setAttempt((a) => a + 1);
  };

  /** The streamer pressed "stop everything": forget the session, back to login. */
  const loggedOut = () => {
    setToken("player", null);
    setTokenState(null);
    setNotice("logged_out");
    setState({ kind: "login" });
  };

  if (state.kind === "in") {
    return <InRoom session={state.session} channel={channel} profile={profile} onProfile={onProfile} t={t} onRejoin={leave} onLoggedOut={loggedOut} />;
  }

  const me = tokenLogin(token);
  return (
    <main className="flow">
      <div className="flow__card tw-card">
        <h2 className="flow__title">KEYWAR × {channel}</h2>
        {notice === "logged_out" && (
          <Sign tone="brick" className="tw-callout" role="alert">
            {t("twLoggedOut")}
          </Sign>
        )}
        {state.kind === "login" || !token ? (
          <LoginBox config={config} wsUrl={region.url} t={t} onToken={setTokenState} />
        ) : state.kind === "not_registered" ? (
          <Sign tone="bus" className="tw-callout">
            <span>{t("twNotRegistered")}</span>
            <span className="sign__small">{t("twTypeInChat", { cmd: command, channel })}</span>
          </Sign>
        ) : state.kind === "no_event" ? (
          <Sign className="tw-callout">
            <span>{t("twNoEvent", { channel })}</span>
          </Sign>
        ) : state.kind === "error" ? (
          <p role="alert">{t("connectionError")}</p>
        ) : (
          <p>…</p>
        )}
        {me && (
          <p className="tw-who">
            <Callout dir="left">{me}</Callout>
            <Button
              variant="ghost"
              onClick={() => {
                setToken("player", null);
                setTokenState(null);
              }}
            >
              {t("twLogout")}
            </Button>
          </p>
        )}
      </div>
    </main>
  );
}

function LoginBox({ config, wsUrl, t, onToken }: { config: ServerConfig | null; wsUrl: string; t: T; onToken: (tok: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="tw-login">
      {config?.twitch && (
        <a className="btn tw-twitch" data-variant="go" href={twitchLoginUrl(wsUrl, "player")}>
          {t("twLoginTwitch")}
        </a>
      )}
      {config?.dev && (
        <form
          className="tw-dev"
          onSubmit={async (e) => {
            e.preventDefault();
            if (name.trim()) onToken(await devLogin(wsUrl, name.trim(), "player"));
          }}
        >
          <Field label={t("twDevName")} value={name} maxLength={25} onChange={(e) => setName(e.target.value)} />
          <Button type="submit">{t("twDevLogin")}</Button>
        </form>
      )}
      {config && !config.twitch && !config.dev && <p>Twitch login is not configured on this server.</p>}
    </div>
  );
}

function InRoom({
  session,
  channel,
  profile,
  onProfile,
  t,
  onRejoin,
  onLoggedOut,
}: {
  session: OnlineSession;
  channel: string;
  profile: Profile;
  onProfile: (p: Profile) => void;
  t: T;
  onRejoin: () => void;
  onLoggedOut: () => void;
}) {
  const snap = useSyncExternalStore(session.subscribe, session.snapshot);
  const royale = snap.royale;
  const login = tokenLogin(getToken("player"));
  const entrant = royale?.entrants.find((e) => e.login === login);
  const seated = snap.players.some((p) => p.sessionId === session.meId);

  useEffect(() => {
    if (session.closedCode === CLOSE_CODES.loggedOut) onLoggedOut();
  });

  if (session.closedCode !== null) {
    return (
      <main className="flow">
        <div className="flow__card tw-card">
          <Sign tone="brick" className="tw-callout">
            {session.closedCode === CLOSE_CODES.kicked ? t("twKicked") : t("twEventClosed")}
          </Sign>
          <Button variant="go" onClick={onRejoin}>
            {t("twRetry")}
          </Button>
        </div>
      </main>
    );
  }

  if (royale?.stage === "match" && seated) {
    return <MatchFlow session={session} profile={profile} onExit={onRejoin} onAgain={onRejoin} />;
  }

  const connected = royale?.entrants.filter((e) => e.connected).length ?? 0;

  return (
    <main className="flow">
      <div className="flow__card tw-card tw-card--wide">
        <h2 className="flow__title">{royale?.stage === "match" ? t("twNotSeated") : t("twWaitingRoom", { channel: royale?.channelName ?? channel })}</h2>
        {entrant && royale && (
          <Sign tone={entrant.order > royale.maxPlayers ? "paper" : "bus"} className="tw-callout">
            {entrant.order > royale.maxPlayers ? t("twWaitlisted", { n: entrant.order }) : t("twYourNumber", { n: entrant.order })}
          </Sign>
        )}
        <p className="flow__count tabular">
          {royale?.entrants.length ?? 0} {t("twSignedUp")} · {connected} {t("twConnected")}
          {royale?.stage === "match" ? ` · ${t("twRemaining", { n: royale.remaining })}` : ""}
        </p>
        <Building
          className="tw-building"
          roof="gable"
          wall="var(--team-0)"
          floorHeight={40}
          floors={[
            <span className="tw-floor">
              {(royale?.entrants ?? []).slice(-6).map((e) => (
                <span key={e.login} className="tw-chip" data-me={e.login === login || undefined}>
                  {e.displayName}
                </span>
              ))}
            </span>,
          ]}
        />
        {royale?.stage !== "match" && (
          <div className="tools-info">
            <span className="field__label">{t("toolsRandom")}</span>
            <p>{t("toolsRandomHint")}</p>
          </div>
        )}
      </div>
    </main>
  );
}
