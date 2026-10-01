import { DIFFICULTIES, DIFFICULTY_IDS, type Difficulty, type Lang } from "@keywar/shared";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Button, Callout, Field, Sign } from "../../ds";
import { strings, type T } from "../../i18n/strings";
import { OnlineSession } from "../../net/online";
import { configuredRegions } from "../../net/regions";
import type { Snapshot } from "../../net/session";
import {
  consumeTokenFromHash,
  devLogin,
  fetchConfig,
  getToken,
  regionFromUrl,
  setToken,
  streamerApi,
  twitchLoginUrl,
  type ServerConfig,
} from "../../net/twitch";
import type { Profile } from "../../profile";
import "./twitch.css";

interface Me {
  login: string;
  displayName: string;
  settings: { lang: Lang; difficulty: Difficulty; command: string; maxPlayers: number; replyInChat: boolean };
  chatConnected: boolean;
  stage: string | null;
  joinUrl: string;
  dev: boolean;
}

const EMPTY_SNAP: Snapshot = { mode: "royale", lang: "es", difficulty: "normal", phase: "waiting", seed: 0, winnerTeam: -1, players: [] };

/** /stream: the streamer opens sign-ups, watches who joins, and starts the battle. */
export function StreamPanel({ profile }: { profile: Profile; onProfile: (p: Profile) => void }) {
  const t = strings(profile.lang);
  const [regionId, setRegionId] = useState(() => regionFromUrl().id);
  const region = configuredRegions().find((r) => r.id === regionId) ?? regionFromUrl();
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [token, setTokenState] = useState<string | null>(() => {
    consumeTokenFromHash("streamer");
    return getToken("streamer");
  });
  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState<Me["settings"] | null>(null);
  const [watch, setWatch] = useState<OnlineSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  useEffect(() => {
    void fetchConfig(region.url).then(setConfig);
  }, [region.url]);

  const loadMe = useCallback(async () => {
    try {
      const m = await streamerApi<Me>(region.url, "me");
      setMe(m);
      setForm((f) => f ?? m.settings);
      return m;
    } catch {
      setTokenState(null);
      setMe(null);
      return null;
    }
  }, [region.url]);

  useEffect(() => {
    if (token) void loadMe();
  }, [token, loadMe]);

  // Watch the room read-only (as an overlay) for the live entrant list and match state.
  const connectWatch = useCallback(
    async (login: string) => {
      watch?.leave();
      try {
        setWatch(await OnlineSession.joinRoyale(region.url, login, { token: "", role: "overlay" }));
      } catch {
        setWatch(null);
      }
    },
    [region.url, watch],
  );

  useEffect(() => {
    if (me?.stage && !watch) void connectWatch(me.login);
  }, [me, watch, connectWatch]);

  const snap = useSyncExternalStore(watch?.subscribe ?? noopSubscribe, watch?.snapshot ?? (() => EMPTY_SNAP));
  const royale = snap.royale;
  const ended = snap.phase === "ended";
  const watching = watch && watch.closedCode === null;
  const stage = watching && ended ? "ended" : ((watching ? royale?.stage : undefined) ?? me?.stage ?? null);

  const act = async (path: string, body: unknown = {}) => {
    setNotice(null);
    const res = await streamerApi<{ ok: boolean; reason?: string }>(region.url, path, body);
    if (!res.ok && res.reason === "not_enough") setNotice(t("pnlNotEnough"));
    const m = await loadMe();
    if (m && (path === "open" || path === "cancel" || path === "stop")) {
      watch?.leave();
      setWatch(null);
      if (path === "open") await connectWatch(m.login);
    }
  };

  if (!token || !me) {
    return (
      <main className="flow">
        <div className="flow__card tw-card">
          <h2 className="flow__title">{t("pnlTitle")}</h2>
          <p>{t("pnlLoginHint")}</p>
          {config?.twitch && (
            <a className="btn tw-twitch" data-variant="go" href={twitchLoginUrl(region.url, "streamer")}>
              {t("twLoginTwitch")}
            </a>
          )}
          {config?.dev && (
            <Button
              onClick={async () => {
                setTokenState(await devLogin(region.url, "dev", "streamer"));
              }}
            >
              {t("pnlDevLogin")}
            </Button>
          )}
          {config && !config.twitch && !config.dev && <p>Twitch login is not configured on this server.</p>}
        </div>
      </main>
    );
  }

  const overlayUrl = `${location.origin}/overlay/${me.login}?r=${encodeURIComponent(region.id)}`;
  const entrants = [...(royale?.entrants ?? [])].sort((a, b) => a.order - b.order);
  const connected = entrants.filter((e) => e.connected).length;

  return (
    <main className="panel">
      {/* The emergency brake: always on screen, whatever state the battle is in. */}
      <div className="panel__brake">
        <Button
          variant="danger"
          className="panel__stop"
          data-armed={confirmStop || undefined}
          onClick={async () => {
            if (!confirmStop) {
              setConfirmStop(true);
              setTimeout(() => setConfirmStop(false), 4000);
              return;
            }
            setConfirmStop(false);
            await act("stop");
            setNotice(t("pnlStopped"));
          }}
        >
          {confirmStop ? t("pnlStopConfirm") : t("pnlStopAll")}
        </Button>
        <span className="panel__hint">{t("pnlStopHint")}</span>
      </div>
      <header className="panel__head">
        <h1 className="panel__title">{t("pnlTitle")}</h1>
        <Callout dir="left">{me.displayName}</Callout>
        <Sign tone={me.chatConnected ? "grass" : "paper"} className="panel__chat">
          {me.chatConnected ? t("pnlChatOn") : t("pnlChatOff")}
        </Sign>
        <Button
          variant="ghost"
          onClick={() => {
            setToken("streamer", null);
            setTokenState(null);
          }}
        >
          {t("twLogout")}
        </Button>
      </header>

      <div className="panel__grid">
        <section className="panel__col">
          <Sign tone={stage === "registering" ? "bus" : stage === "match" ? "brick" : "paper"} className="panel__stage">
            {stageLabel(stage, t)}
            {royale && (
              <span className="sign__small tabular">
                {entrants.length} {t("twSignedUp")} · {connected} {t("twConnected")}
                {stage === "match" || ended ? ` · ${t("twRemaining", { n: royale.remaining })}` : ""}
              </span>
            )}
          </Sign>

          {form && (stage === null || stage === "ended") && (
            <form
              className="panel__form"
              onSubmit={(e) => {
                e.preventDefault();
                void act("open", form);
              }}
            >
              <div className="panel__row">
                <Field label={t("pnlCommand")} value={form.command} maxLength={25} onChange={(e) => setForm({ ...form, command: e.target.value })} />
                <Field
                  label={t("pnlMax")}
                  type="number"
                  min={2}
                  max={100}
                  value={form.maxPlayers}
                  onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) || 100 })}
                />
              </div>
              <div className="panel__row">
                <label className="field">
                  <span className="field__label">{t("difficulty")}</span>
                  <select className="field__input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}>
                    {DIFFICULTY_IDS.map((d) => (
                      <option key={d} value={d}>
                        {DIFFICULTIES[d].name[profile.lang]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">{t("language")}</span>
                  <select className="field__input" value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value as Lang })}>
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </div>
              {configuredRegions().length > 1 && (
                <label className="field">
                  <span className="field__label">{t("region")}</span>
                  <select className="field__input" value={region.id} onChange={(e) => setRegionId(e.target.value)}>
                    {configuredRegions().map((r) => (
                      <option key={r.id}>{r.id}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="panel__check">
                <input type="checkbox" checked={form.replyInChat} onChange={(e) => setForm({ ...form, replyInChat: e.target.checked })} />
                {t("pnlReply")}
              </label>
              <Button variant="go" type="submit">
                {stage === "ended" ? t("pnlNewRound") : t("pnlOpen")}
              </Button>
            </form>
          )}

          <div className="panel__actions">
            {stage === "registering" && <Button onClick={() => void act("close")}>{t("pnlClose")}</Button>}
            {stage === "closed" && <Button onClick={() => void act("open", form ?? {})}>{t("pnlReopen")}</Button>}
            {(stage === "registering" || stage === "closed") && (
              <Button variant="go" onClick={() => void act("start")}>
                {t("pnlStart")}
              </Button>
            )}
            {stage && stage !== "ended" && (
              <Button variant="danger" onClick={() => void act("cancel")}>
                {t("pnlCancel")}
              </Button>
            )}
          </div>
          {notice && (
            <p className="panel__notice" role="alert">
              {notice}
            </p>
          )}

          <section className="panel__links">
            <h2 className="panel__h">{t("pnlLinks")}</h2>
            <CopyRow label={t("pnlOverlay")} value={overlayUrl} t={t} />
            <CopyRow label={t("pnlJoinLink")} value={me.joinUrl} t={t} />
            <p className="panel__hint">{t("pnlModHint")}</p>
          </section>

          {me.dev && <ChatSimulator wsUrl={region.url} t={t} command={royale?.command ?? form?.command ?? "!keywar"} />}
        </section>

        <section className="panel__col">
          <h2 className="panel__h tabular">
            {t("twSignedUp")} · {entrants.length}/{royale?.maxPlayers ?? form?.maxPlayers ?? 100}
          </h2>
          {entrants.length === 0 ? (
            <p className="panel__hint">{t("pnlEmpty")}</p>
          ) : (
            <ol className="entrants">
              {entrants.map((e) => {
                const player = snap.players.find((p) => p.name === e.displayName && e.seated);
                return (
                  <li key={e.login} className="entrant" data-wait={royale && e.order > royale.maxPlayers ? "" : undefined}>
                    <span className="entrant__n tabular">#{e.order}</span>
                    <span className="entrant__dot" data-on={e.connected || undefined} title={e.connected ? t("twConnected") : ""} />
                    <span className="entrant__name">{e.displayName}</span>
                    {player && <span className="entrant__hp tabular">{player.alive ? `${player.hp}` : "KO"}</span>}
                    {stage !== "match" && (
                      <Button variant="ghost" onClick={() => void act("kick", { login: e.login })}>
                        {t("pnlKick")}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}

const noopSubscribe = () => () => {};

function stageLabel(stage: string | null, t: T) {
  switch (stage) {
    case "registering":
      return t("pnlStageRegistering");
    case "closed":
      return t("pnlStageClosed");
    case "match":
      return t("pnlStageMatch");
    case "ended":
      return t("pnlStageEnded");
    default:
      return t("pnlStageNone");
  }
}

function CopyRow({ label, value, t }: { label: string; value: string; t: T }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copyrow">
      <span className="field__label">{label}</span>
      <code className="copyrow__value">{value}</code>
      <Button
        onClick={async () => {
          await navigator.clipboard?.writeText(value).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? t("pnlCopied") : t("pnlCopy")}
      </Button>
    </div>
  );
}

/** Dev only: type as any chat user, through the exact pipeline real chat uses. */
function ChatSimulator({ wsUrl, t, command }: { wsUrl: string; t: T; command: string }) {
  const [user, setUser] = useState("pepe");
  const [text, setText] = useState(command);
  const [mod, setMod] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  return (
    <section className="sim">
      <h2 className="panel__h">{t("pnlSim")}</h2>
      <form
        className="sim__form"
        onSubmit={async (e) => {
          e.preventDefault();
          await streamerApi(wsUrl, "dev/chat", { user, text, mod });
          setLog((l) => [`${user}${mod ? " (mod)" : ""}: ${text}`, ...l].slice(0, 6));
          // Next fake viewer, for quick multi-signups.
          const m = user.match(/^(.*?)(\d+)$/);
          setUser(m ? `${m[1]}${Number(m[2]) + 1}` : `${user}2`);
        }}
      >
        <Field label={t("pnlSimUser")} value={user} onChange={(e) => setUser(e.target.value)} />
        <Field label={t("pnlSimText")} value={text} onChange={(e) => setText(e.target.value)} />
        <label className="panel__check">
          <input type="checkbox" checked={mod} onChange={(e) => setMod(e.target.checked)} />
          {t("pnlSimMod")}
        </label>
        <Button type="submit">{t("pnlSimSend")}</Button>
      </form>
      {log.length > 0 && (
        <ul className="sim__log">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
