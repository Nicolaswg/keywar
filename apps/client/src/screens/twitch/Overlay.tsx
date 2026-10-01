import { MATCH, type PlayerView } from "@keywar/shared";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Sign } from "../../ds";
import { strings } from "../../i18n/strings";
import { OnlineSession } from "../../net/online";
import type { Snapshot } from "../../net/session";
import { regionFromUrl } from "../../net/twitch";
import "./overlay.css";

const RETRY_MS = 3_000;
const EMPTY: Snapshot = { mode: "royale", lang: "es", difficulty: "normal", phase: "waiting", seed: 0, winnerTeam: -1, players: [] };

interface FeedItem {
  id: number;
  by: string;
  victim: string;
}

/**
 * /overlay/<channel>: an OBS browser source (1920×1080). Read-only: it joins
 * the channel's room as a spectator and reconnects on its own when a new
 * round opens. Add ?bg=0 for a transparent background.
 */
export function Overlay({ channel }: { channel: string }) {
  const region = regionFromUrl();
  const transparent = new URLSearchParams(location.search).get("bg") === "0";
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    document.documentElement.dataset.overlay = transparent ? "transparent" : "paper";
  }, [transparent]);

  useEffect(() => {
    let live = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    OnlineSession.joinRoyale(region.url, channel, { token: "", role: "overlay" })
      .then((s) => {
        if (!live) return s.leave();
        setSession(s);
        setFeed([]);
      })
      .catch(() => {
        if (live) retry = setTimeout(() => setAttempt((a) => a + 1), RETRY_MS);
      });
    return () => {
      live = false;
      clearTimeout(retry);
    };
  }, [attempt, channel, region.url]);

  const snap = useSyncExternalStore(session?.subscribe ?? noop, session?.snapshot ?? (() => EMPTY));

  // Room gone (round over, cancelled): look for the next one.
  useEffect(() => {
    if (session && session.closedCode !== null) {
      setSession(null);
      setAttempt((a) => a + 1);
    }
  });

  useEffect(() => {
    if (!session) return;
    let seq = 0;
    return session.on("knockout", (k) => {
      const name = (id: string) => session.snapshot().players.find((p) => p.sessionId === id)?.name ?? "";
      setFeed((f) => [{ id: seq++, by: name(k.by), victim: name(k.victim) }, ...f].slice(0, 7));
    });
  }, [session]);

  const t = strings(snap.lang ?? "es");
  const royale = snap.royale;

  if (!session || !royale) {
    return (
      <main className="ov ov--idle">
        <Sign className="ov__idle">{t("ovWaiting", { channel })}</Sign>
      </main>
    );
  }

  if (royale.stage !== "match") {
    const recent = [...royale.entrants].sort((a, b) => b.order - a.order).slice(0, 40);
    return (
      <main className="ov ov--signup">
        <div className="ov__call">
          <span className="ov__cmd">{royale.command}</span>
          <span className="ov__sub">{t("ovJoinNow")}</span>
          <Sign tone="bus" className="ov__count tabular">
            {Math.min(royale.entrants.length, royale.maxPlayers)} / {royale.maxPlayers}
          </Sign>
        </div>
        <ul className="ov__names">
          {recent.map((e) => (
            <li key={e.login} className="ov__name" data-on={e.connected || undefined}>
              {e.displayName}
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const ranked = rank(snap.players);
  if (snap.phase === "ended") {
    return (
      <main className="ov ov--podium">
        <h1 className="ov__winner">{t("winner")}</h1>
        <ol className="podium">
          {[ranked[1], ranked[0], ranked[2]].map(
            (p, i) =>
              p && (
                <li key={p.sessionId} className="podium__step" data-place={[2, 1, 3][i]}>
                  <span className="podium__name">{p.name}</span>
                  <span className="podium__block tabular">{[2, 1, 3][i]}</span>
                  <span className="podium__stats tabular">
                    {t("hp")} {p.hp} · {t("damage")} {p.damageDealt}
                  </span>
                </li>
              ),
          )}
        </ol>
      </main>
    );
  }

  return (
    <main className="ov ov--arena">
      <header className="ov__bar">
        <Sign tone="brick" className="ov__left tabular">
          {t("twRemaining", { n: royale.remaining })}
        </Sign>
        <Clock session={session} />
      </header>
      <ol className="arena" style={{ "--cols": Math.ceil(Math.sqrt(snap.players.length * 1.8)) } as React.CSSProperties}>
        {snap.players.map((p) => (
          <li key={p.sessionId} className="cell" data-down={!p.alive || undefined} data-team={p.team % 3}>
            <span className="cell__roof" />
            <span className="cell__body">
              <span className="cell__name">{p.name}</span>
              <span className="cell__hp" style={{ "--hp": p.hp / MATCH.maxHp } as React.CSSProperties} />
            </span>
          </li>
        ))}
      </ol>
      <ul className="feed" aria-live="polite">
        {feed.map((f) => (
          <li key={f.id} className="feed__item">
            {f.by ? (
              <>
                <strong>{f.by}</strong> {t("ovKnockedOut")} <strong>{f.victim}</strong>
              </>
            ) : (
              <>
                <strong>{f.victim}</strong> {t("ovLeft")}
              </>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

function Clock({ session }: { session: OnlineSession }) {
  const [now, setNow] = useState(session.matchNow());
  useEffect(() => {
    const iv = setInterval(() => setNow(session.matchNow()), 500);
    return () => clearInterval(iv);
  }, [session]);
  const left = Math.max(0, Math.ceil((MATCH.durationMs - Math.max(0, now)) / 1000));
  return (
    <Sign tone="bus" className="ov__clock tabular">
      {now < 0 ? Math.ceil(-now / 1000) : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
    </Sign>
  );
}

/** Standing order: still alive first, then most HP, then most damage dealt. */
export function rank(players: PlayerView[]) {
  return [...players].sort((a, b) => Number(b.alive) - Number(a.alive) || b.hp - a.hp || b.damageDealt - a.damageDealt);
}

const noop = () => () => {};
