import { DIFFICULTIES, MODES, type PlayerView } from "@keywar/shared";
import { useSyncExternalStore } from "react";
import { Building, Button, Callout, ROOF_FOR_TEAM, Sign } from "../ds";
import { strings, type T } from "../i18n/strings";
import type { GameSession, Snapshot } from "../net/session";
import type { Profile } from "../profile";
import { Match } from "./Match";
import "./flow.css";

export const teamWall = (team: number) => `var(--team-${team % 3})`;

export function MatchFlow({
  session,
  profile,
  onExit,
  onAgain,
}: {
  session: GameSession;
  profile: Profile;
  onExit: () => void;
  onAgain: () => void;
}) {
  const snap = useSyncExternalStore(session.subscribe, session.snapshot);
  const t = strings(snap.lang ?? profile.lang);

  if (snap.phase === "waiting") return <Queue snap={snap} meId={session.meId} t={t} onCancel={onExit} />;
  if (snap.phase === "ended") return <Results snap={snap} meId={session.meId} t={t} onAgain={onAgain} onHome={onExit} />;
  return <Match session={session} snap={snap} profile={profile} t={t} onExit={onExit} />;
}

function Queue({ snap, meId, t, onCancel }: { snap: Snapshot; meId: string; t: T; onCancel: () => void }) {
  const seats = MODES[snap.mode].players;
  const team = snap.mode === "team6";
  return (
    <main className="flow">
      <div className="flow__card">
        <h2 className="flow__title">
          {t("searching")}
          <span className="dots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </h2>
        <p className="flow__count tabular" aria-live="polite">
          {snap.players.length} / {seats} · {DIFFICULTIES[snap.difficulty].name[snap.lang]}
        </p>
        <Building
          className="flow__building"
          roof={team ? "flat" : "gable"}
          wall={teamWall(0)}
          floorHeight={46}
          floors={Array.from({ length: seats }, (_, i) => {
            const p = snap.players[seats - 1 - i];
            return p ? (
              <span className="seat" data-me={p.sessionId === meId || undefined}>
                {p.name}
                {p.sessionId === meId && <Callout dir="left">{t("you")}</Callout>}
              </span>
            ) : (
              <span className="seat seat--empty">{t("seatEmpty")}</span>
            );
          })}
        />
        <Button variant="danger" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </main>
  );
}

function Results({ snap, meId, t, onAgain, onHome }: { snap: Snapshot; meId: string; t: T; onAgain: () => void; onHome: () => void }) {
  const me = snap.players.find((p) => p.sessionId === meId);
  const won = me?.team === snap.winnerTeam;
  const ranked = [...snap.players].sort((a, b) => b.hp - a.hp || b.damageDealt - a.damageDealt);
  const maxDealt = Math.max(1, ...snap.players.map((p) => p.damageDealt));

  return (
    <main className="flow flow--results">
      <h2 className="results__headline">{won ? t("youWon") : t("youLost")}</h2>
      <div className="results__street">
        {ranked.map((p) => (
          <ResultHouse key={p.sessionId} p={p} me={p.sessionId === meId} winner={p.team === snap.winnerTeam} t={t} maxDealt={maxDealt} />
        ))}
      </div>
      <div className="results__actions">
        <Button variant="go" onClick={onAgain}>
          {t("again")}
        </Button>
        <Button variant="ghost" onClick={onHome}>
          {t("home")}
        </Button>
      </div>
    </main>
  );
}

function ResultHouse({ p, me, winner, t, maxDealt }: { p: PlayerView; me: boolean; winner: boolean; t: T; maxDealt: number }) {
  // The building's height is what's left of it.
  const floors = Math.max(1, Math.ceil((p.hp / 1000) * 4));
  return (
    <div className="result">
      {winner && (
        <Sign tone="bus" className="result__flag">
          {t("winner")}
        </Sign>
      )}
      <Building
        roof={ROOF_FOR_TEAM[p.team % 3]!}
        wall={teamWall(p.team)}
        down={!p.alive}
        floorHeight={40}
        floors={Array.from({ length: floors }, (_, i) => (i === floors - 1 ? <span className="result__hp tabular">{p.hp}</span> : <span />))}
      />
      <p className="result__name">
        {p.name}
        {me && <span className="result__you"> ({t("you")})</span>}
      </p>
      <dl className="result__stats tabular">
        <dt>{t("damage")}</dt>
        <dd>
          <span className="result__bar" style={{ width: `${(p.damageDealt / maxDealt) * 100}%` }} />
          {p.damageDealt}
        </dd>
        <dt>{t("bestStreak")}</dt>
        <dd>{p.bestStreak}</dd>
      </dl>
    </div>
  );
}
