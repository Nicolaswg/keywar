import {
  CONTROL_KEYS,
  DIFFICULTIES,
  KEYBOARD_WIDTH_U,
  KEY_SLOTS,
  LAYOUT_FOR_LANG,
  MATCH,
  SKILLS,
  legendFor,
  skillCost,
  skillLevel,
  multiplierFor,
  phaseAt,
  type Judgement,
  type LayoutId,
  type PlayerView,
  type ServerMessages,
  type SkillId,
} from "@keywar/shared";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { BrickWall, Building, Button, Callout, ROOF_FOR_TEAM, Roof, Sign, WaterTower } from "../ds";
import { BeatPlayer } from "../game/audio";
import { LaneController } from "../game/controller";
import { drawLane, readPaint } from "../game/draw";
import type { T } from "../i18n/strings";
import type { GameSession, Snapshot } from "../net/session";
import type { Profile } from "../profile";
import { teamWall } from "./MatchFlow";
import "./match.css";

interface Cast {
  id: number;
  msg: ServerMessages["skillCast"];
}

const JUDGE_KEY: Record<Judgement, "perfect" | "great" | "good" | "miss"> = {
  perfect: "perfect",
  great: "great",
  good: "good",
  miss: "miss",
};

export function Match({ session, snap, profile, t, onExit }: { session: GameSession; snap: Snapshot; profile: Profile; t: T; onExit: () => void }) {
  const layout = LAYOUT_FOR_LANG[snap.lang];
  const me = snap.players.find((p) => p.sessionId === session.meId);
  const ctrl = useMemo(() => new LaneController(session, snap.seed, snap.lang, snap.difficulty, profile.inputOffsetMs), [session, snap.seed, snap.lang, snap.difficulty, profile.inputOffsetMs]);
  ctrl.effects = me?.effects ?? [];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => session.matchNow());
  const [popup, setPopup] = useState<{ id: number; judgement: Judgement | "wrong"; mult: number } | null>(null);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [hits, setHits] = useState<Record<string, number>>({});
  const [heal, setHeal] = useState<{ id: number; amount: number; word: string; perfect: boolean } | null>(null);
  /** Floating "-N" numbers: on the building you hit, and on your own wall. */
  const [floats, setFloats] = useState<Float[]>([]);
  const [upgrade, setUpgrade] = useState<{ id: number; slot: 0 | 1; to: SkillId } | null>(null);

  const enemies = snap.players.filter((p) => me && p.team !== me.team);
  const allies = snap.players.filter((p) => me && p.team === me.team && p.sessionId !== me.sessionId);
  // Chat battles (ring): only the two players that matter, whoever chases you and whoever you chase.
  const ring = snap.mode === "royale";
  const attacker = ring ? snap.players.find((p) => p.alive && p.targetId === me?.sessionId) : undefined;
  const myTarget = ring ? snap.players.find((p) => p.sessionId === me?.targetId) : undefined;
  const duel = snap.mode === "duel";
  const left = ring ? (attacker ? [attacker] : []) : snap.mode === "team6" ? allies : duel ? [] : enemies.slice(0, 1);
  const right = ring ? (myTarget ? [myTarget] : []) : snap.mode === "team6" ? enemies : duel ? enemies : enemies.slice(1);
  const tagFor = (p: PlayerView) =>
    !ring ? undefined : p.sessionId === me?.targetId ? { text: t("twYourTarget"), tone: "brick" as const } : { text: t("twAttacker"), tone: "paper" as const };

  // Audio + judgement feedback.
  useEffect(() => {
    const beat = new BeatPlayer(session.matchNow, ctrl.difficulty);
    beat.start();
    let seq = 0;
    const off = ctrl.onJudge((j) => {
      const mine = session.snapshot().players.find((p) => p.sessionId === session.meId);
      if ("wrong" in j || j.judgement === "miss") beat.thud();
      else beat.stamp(multiplierFor(mine?.streak ?? 0));
      setPopup({ id: seq++, judgement: "wrong" in j ? "wrong" : j.judgement, mult: multiplierFor(mine?.streak ?? 0) });
    });
    return () => {
      off();
      beat.stop();
    };
  }, [ctrl, session]);

  // Server events: skill casts and bricks falling.
  useEffect(() => {
    let seq = 0;
    const offCast = session.on("skillCast", (msg) => {
      const id = seq++;
      setCasts((c) => [...c.slice(-5), { id, msg }]);
      setTimeout(() => setCasts((c) => c.filter((x) => x.id !== id)), 2200);
    });
    const pushFloat = (f: Omit<Float, "id">) => {
      const id = seq++;
      setFloats((list) => [...list.slice(-12), { id, ...f }]);
      setTimeout(() => setFloats((list) => list.filter((x) => x.id !== id)), 1100);
    };
    const offDmg = session.on("damage", (msg) => {
      setHits((h) => ({ ...h, [msg.to]: (h[msg.to] ?? 0) + 1 }));
      // Only hits that involve you: in 3v3 you don't need your teammates' numbers.
      if (msg.from === session.meId) pushFloat({ on: msg.to, amount: msg.amount, kind: "dealt" });
      else if (msg.to === session.meId) pushFloat({ on: session.meId, amount: msg.amount, kind: "taken" });
    });
    const offSelf = session.on("selfDamage", (msg) => pushFloat({ on: session.meId, amount: msg.amount, kind: msg.reason }));
    const offUpgrade = session.on("skillUpgrade", (msg) => {
      const id = seq++;
      setUpgrade({ id, slot: msg.slot, to: msg.to });
      setTimeout(() => setUpgrade((u) => (u?.id === id ? null : u)), 2600);
    });
    const offHeal = session.on("heal", (msg) => {
      const id = seq++;
      setHeal({ id, ...msg });
      setTimeout(() => setHeal((h) => (h?.id === id ? null : h)), 1800);
    });
    return () => {
      offCast();
      offDmg();
      offHeal();
      offSelf();
      offUpgrade();
    };
  }, [session]);

  // Keyboard.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === CONTROL_KEYS.menu) return onExit();
      if (e.code === CONTROL_KEYS.skill1 || e.code === CONTROL_KEYS.skill2) {
        e.preventDefault();
        if (!e.repeat) session.skill(e.code === CONTROL_KEYS.skill1 ? 0 : 1);
        return;
      }
      if (e.code === CONTROL_KEYS.cycleTarget) {
        e.preventDefault();
        const s = session.snapshot();
        const mine = s.players.find((p) => p.sessionId === session.meId);
        const foes = s.players.filter((p) => mine && p.team !== mine.team && p.alive);
        if (foes.length) {
          const i = foes.findIndex((p) => p.sessionId === mine?.targetId);
          session.target(foes[(i + 1) % foes.length]!.sessionId);
        }
        return;
      }
      ctrl.keyDown(e);
    };
    const up = (e: KeyboardEvent) => ctrl.keyUp(e);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [ctrl, session, onExit]);

  // Render loop: canvas lane + keyboard floor lights.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const paint = readPaint();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stampText = snap.lang === "es" ? "¡PUM!" : "POW!";
    const zoneLabels: [string, string, string] = snap.lang === "es" ? ["vale", "bien", "perfecto"] : ["good", "great", "perfect"];
    let w = 0;
    let h = 0;
    const ro = new ResizeObserver(([entry]) => {
      const dpr = window.devicePixelRatio || 1;
      w = entry!.contentRect.width;
      h = entry!.contentRect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    ro.observe(canvas);
    const keyEls = new Map<string, HTMLElement>();
    keysRef.current?.querySelectorAll<HTMLElement>("[data-code]").forEach((el) => keyEls.set(el.dataset.code!, el));

    let raf = 0;
    let lastClock = 0;
    const frame = () => {
      const t = session.matchNow();
      ctrl.update(t);
      if (w && h) drawLane({ ctx, w, h, now: t, ctrl, layout, paint, reducedMotion: reduced, stampText, zoneLabels });
      const next = ctrl.upcoming(t);
      keyEls.forEach((el, code) => {
        const state = ctrl.pressed.has(code) ? "down" : (next.get(code) ?? "");
        if (el.dataset.state !== state) el.dataset.state = state;
      });
      if (t - lastClock > 200) {
        lastClock = t;
        setNow(t);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [ctrl, session, layout, snap.lang]);

  if (!me) return null;

  const phase = phaseAt(Math.max(0, now), snap.difficulty);
  const remaining = Math.max(0, MATCH.durationMs - Math.max(0, now));
  const mult = multiplierFor(me.streak);
  const sabotageOnMe = me.effects.filter((e) => SKILLS[e.skill].kind === "sabotage");

  return (
    <main className="match" data-mode={snap.mode} data-sudden={phase.damageScale > 1 || undefined}>
      <header className="match__bar">
        <Sign tone="bus" className="match__clock">
          <span className="sign__small">{t("timeLeft")}</span>
          <span className="tabular">{formatTime(remaining)}</span>
        </Sign>
        <Sign tone={phase.damageScale >= 2 ? "brick" : "paper"} className="match__phase">
          <span>{phase.name[snap.lang]}</span>
          <span className="sign__small tabular">
            {DIFFICULTIES[snap.difficulty].name[snap.lang]} · {phase.bpm} BPM{phase.damageScale > 1 ? ` · ${t("damage")} x${phase.damageScale}` : ""}
          </span>
        </Sign>
        {snap.royale && (
          <Sign tone="brick" className="match__phase tabular">
            {t("twRemaining", { n: snap.royale.remaining })}
          </Sign>
        )}
        <span className="match__leave">
          <Button variant="ghost" onClick={onExit}>
            {t("leaveMatch")}
          </Button>
        </span>
      </header>

      <div className="match__arena">
        <div className="match__side">
          {left.map((p) => (
            <Rival key={p.sessionId} p={p} t={t} ally={p.team === me.team} target={me.targetId === p.sessionId} tag={tagFor(p)} hits={hits[p.sessionId] ?? 0} casts={casts} floats={floats.filter((f) => f.on === p.sessionId).slice(-3)} onTarget={() => session.target(p.sessionId)} lang={snap.lang} />
          ))}
        </div>

        <section className="mine" style={{ "--wall": teamWall(me.team) } as CSSProperties} aria-label={me.name}>
          <div className="mine__top">
            <div className="mine__tower">
              <WaterTower value={me.ink} label={t("ink")} />
              <Callout dir="left" className="tabular">
                {t("ink")} {me.ink}
              </Callout>
            </div>
            <Roof shape={ROOF_FOR_TEAM[me.team % 3]!} />
          </div>

          <div className="mine__body">
            <Sign className="mine__plate" tone="paper">
              {me.name}
            </Sign>
            <div className="mine__lane">
              <canvas ref={canvasRef} className="mine__canvas" aria-hidden="true" />
              {popup && (
                <span key={popup.id} className="judge" data-j={popup.judgement}>
                  {popup.judgement === "wrong" ? t("miss") : t(JUDGE_KEY[popup.judgement])}
                  {popup.judgement !== "wrong" && popup.judgement !== "miss" && popup.mult > 1 && <small> x{popup.mult}</small>}
                </span>
              )}
              {sabotageOnMe.length > 0 && (
                <div className="mine__sabotage" role="status">
                  {sabotageOnMe.map((e) => (
                    <Sign key={e.skill} tone="brick" className="sabotage">
                      {SKILLS[e.skill].name[snap.lang]}
                      <span className="sign__small">{snap.players.find((p) => p.sessionId === e.from)?.name}</span>
                    </Sign>
                  ))}
                </div>
              )}
              {now < 0 && (
                <div className="countdown" aria-live="assertive">
                  <span className="countdown__label">{t("countdown")}</span>
                  <span key={Math.ceil(-now / 1000)} className="countdown__n">
                    {Math.ceil(-now / 1000)}
                  </span>
                </div>
              )}
            </div>
            <Keyboard refEl={keysRef} layout={layout} />
          </div>

          <div className="mine__street">
            <SkillSign slot={0} id={me.loadout[0]!} me={me} session={session} t={t} lang={snap.lang} upgraded={upgrade?.slot === 0 ? upgrade.id : undefined} />
            <div className="streak" data-mult={mult}>
              <span className="streak__n tabular">{me.streak}</span>
              <span className="streak__label">
                {t("streak")} · <strong>x{mult}</strong>
              </span>
            </div>
            <SkillSign slot={1} id={me.loadout[1]!} me={me} session={session} t={t} lang={snap.lang} upgraded={upgrade?.slot === 1 ? upgrade.id : undefined} />
          </div>
          <div className="mine__hp">
            <Floats list={floats.filter((f) => f.on === me.sessionId).slice(-3)} t={t} />
            {heal && (
              <span key={heal.id} className="heal" role="status">
                <strong>{t("healed", { n: heal.amount })}</strong>
                <span className="heal__word">{t("healedWord", { word: heal.word.toUpperCase() })}</span>
              </span>
            )}
            <BrickWall hp={me.hp} max={MATCH.maxHp} />
            <span className="tabular">
              {t("hp")} {me.hp}
            </span>
          </div>
        </section>

        <div className="match__side">
          {right.map((p) => (
            <Rival key={p.sessionId} p={p} t={t} ally={false} target={me.targetId === p.sessionId} tag={tagFor(p)} hits={hits[p.sessionId] ?? 0} casts={casts} floats={floats.filter((f) => f.on === p.sessionId).slice(-3)} onTarget={() => session.target(p.sessionId)} lang={snap.lang} />
          ))}
        </div>
      </div>
    </main>
  );
}

function Keyboard({ refEl, layout }: { refEl: RefObject<HTMLDivElement | null>; layout: LayoutId }) {
  return (
    <div className="workshop" ref={refEl} aria-hidden="true">
      {KEY_SLOTS.map((s) => {
        const legend = legendFor({ code: s.code, shift: false, ctrl: false }, layout);
        if (legend === "?") return null;
        return (
          <span
            key={s.code}
            className="wkey"
            data-code={s.code}
            style={{ left: `${(s.x / KEYBOARD_WIDTH_U) * 100}%`, top: `${s.row * 25}%` }}
          >
            {legend}
          </span>
        );
      })}
    </div>
  );
}

interface Float {
  id: number;
  /** sessionId of the building the number floats over. */
  on: string;
  amount: number;
  kind: "dealt" | "taken" | "miss" | "wrong";
}

function Floats({ list, t }: { list: Float[]; t: T }) {
  return (
    <span className="floats" aria-hidden="true">
      {list.map((f, i) => (
        <span key={f.id} className="float" data-kind={f.kind} style={{ "--x": `${((f.id * 37) % 60) - 30}px`, "--i": i } as CSSProperties}>
          −{f.amount}
          {f.kind === "miss" && <small> {t("floatMiss")}</small>}
          {f.kind === "wrong" && <small> {t("floatWrong")}</small>}
        </span>
      ))}
    </span>
  );
}

function SkillSign({
  slot,
  id,
  me,
  session,
  t,
  lang,
  upgraded,
}: {
  slot: 0 | 1;
  id: SkillId;
  me: PlayerView;
  session: GameSession;
  t: T;
  lang: "es" | "en";
  /** Set (to a changing id) right after the streak swapped this tool. */
  upgraded?: number;
}) {
  const def = SKILLS[id];
  const cost = skillCost(id, me.streak);
  const level = skillLevel(me.streak);
  const cd = session.cooldownLeft(id);
  const state = cd > 0 ? "cooldown" : me.ink < cost ? "noink" : "ready";
  return (
    <button type="button" key={upgraded} className="skill" data-state={state} data-new={upgraded !== undefined || undefined} onClick={() => session.skill(slot)} title={def.blurb[lang]}>
      {upgraded !== undefined && <span className="skill__new">{t("newTool")}</span>}
      <span className="skill__top">
        <span className="skill__key">{slot === 0 ? t("keySpace") : "Enter"}</span>
        {/* Level = filled bricks: 1 to 3, it climbs with the streak. */}
        <span className="skill__level" aria-label={t("toolLevel", { n: level })}>
          {[1, 2, 3].map((n) => (
            <span key={n} data-on={n <= level || undefined} />
          ))}
        </span>
      </span>
      <span className="skill__name">{def.name[lang]}</span>
      <span className="skill__meta tabular">
        {state === "cooldown" ? `${t("cooldown")} ${Math.ceil(cd / 1000)}s` : state === "noink" ? `${t("noInk")} · ${cost}` : `${t("ready")} · ${cost}`}
      </span>
    </button>
  );
}

function Rival({
  p,
  t,
  ally,
  target,
  hits,
  casts,
  onTarget,
  lang,
  tag,
  floats,
}: {
  p: PlayerView;
  t: T;
  ally: boolean;
  target: boolean;
  hits: number;
  casts: Cast[];
  onTarget: () => void;
  lang: "es" | "en";
  /** Replaces the default "target · Tab switches" sign (chat battles). */
  tag?: { text: string; tone: "brick" | "paper" };
  floats: Float[];
}) {
  const incoming = casts.filter((c) => c.msg.to === p.sessionId && c.msg.from !== p.sessionId);
  const left = Math.ceil(Math.max(0, p.hp) / 50);
  return (
    <button type="button" className="rival" data-target={target || undefined} data-ally={ally || undefined} onClick={onTarget} disabled={ally || !p.alive}>
      {tag ? (
        <span className="rival__hook">
          <Sign tone={tag.tone}>{tag.text}</Sign>
        </span>
      ) : (
        target && (
          <span className="rival__hook">
            <Sign tone="brick">
              {t("target")}
              <span className="sign__small">{t("targetHint")}</span>
            </Sign>
          </span>
        )
      )}
      <Building
        roof={ROOF_FOR_TEAM[p.team % 3]!}
        wall={teamWall(p.team)}
        down={!p.alive}
        floorHeight={44}
        className={hits ? "rival__building rival__building--hit" : "rival__building"}
        style={{ "--hit": hits } as CSSProperties}
        floors={[
          <span className="rival__name">
            {p.name}
            {ally && <span className="rival__tag">{t("ally")}</span>}
          </span>,
          <span className="rival__wall" key={hits}>
            <Floats list={floats} t={t} />
            <BrickWall hp={p.hp} max={MATCH.maxHp} falling={hits ? left : -1} />
          </span>,
          <span className="rival__stats tabular">
            {t("streak")} {p.streak} · x{multiplierFor(p.streak)}
          </span>,
        ]}
      />
      <span className="rival__fx">
        {p.effects.map((e) => (
          <Callout key={e.skill} dir="up" len={14}>
            {SKILLS[e.skill].name[lang]}
          </Callout>
        ))}
        {incoming.map((c) => (
          <span key={c.id} className="rival__cast">
            {c.msg.blocked ? t("blocked") : `¡${SKILLS[c.msg.skill].name[lang]}!`}
          </span>
        ))}
      </span>
    </button>
  );
}

function formatTime(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
