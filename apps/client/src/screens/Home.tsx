import { DIFFICULTIES, DIFFICULTY_IDS, type Lang, type ModeId } from "@keywar/shared";
import { useEffect, useState } from "react";
import { Building, Button, Callout, Field, Sign } from "../ds";
import { strings } from "../i18n/strings";
import { configuredRegions, measureRegions, type Region } from "../net/regions";
import type { Profile } from "../profile";
import "./home.css";

const hasKeyboard = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

export function Home({
  profile,
  onProfile,
  onPlay,
  onPractice,
  error,
}: {
  profile: Profile;
  onProfile: (p: Profile) => void;
  onPlay: (regionUrl: string) => void;
  onPractice: () => void;
  error: string | null;
}) {
  const t = strings(profile.lang);
  const [regions, setRegions] = useState<Region[] | null>(null);
  const [joining, setJoining] = useState(false);
  const keyboard = hasKeyboard();
  const best = regions?.find((r) => r.ping !== null);

  useEffect(() => {
    let live = true;
    measureRegions(configuredRegions()).then((r) => live && setRegions(r));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => setJoining(false), [error]);

  const set = (patch: Partial<Profile>) => onProfile({ ...profile, ...patch });

  const pickMode = (mode: ModeId) => set({ mode });

  return (
    <main className="home">
      <div className="home__sky" aria-hidden="true">
        <span className="cloud" style={{ left: "34%", top: "22%" }} />
        <span className="cloud cloud--small" style={{ left: "46%", top: "5%" }} />
        <span className="cloud" style={{ right: "6%", top: "14%" }} />
      </div>

      <section className="home__intro">
        <h1 className="wordmark">KEYWAR</h1>
        <p className="home__tagline">{t("tagline")}</p>
        <p className="home__pitch">{t("pitch")}</p>

        <form
          className="home__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!best) return;
            setJoining(true);
            onPlay(best.url);
          }}
        >
          <div className="home__row">
            <Field
              label={t("nickname")}
              placeholder={t("nicknamePh")}
              maxLength={16}
              value={profile.name}
              onChange={(e) => set({ name: e.target.value })}
            />
            <fieldset className="lang">
              <legend className="field__label">{t("language")}</legend>
              {(["es", "en"] as Lang[]).map((l) => (
                <label key={l} className="lang__opt" data-on={profile.lang === l || undefined}>
                  <input type="radio" name="lang" className="visually-hidden" checked={profile.lang === l} onChange={() => set({ lang: l })} />
                  {l.toUpperCase()}
                </label>
              ))}
            </fieldset>
          </div>

          <div className="tools-info">
            <span className="field__label">{t("toolsRandom")}</span>
            <p>{t("toolsRandomHint")}</p>
          </div>

          {!keyboard && <Sign tone="brick">{t("needsKeyboard")}</Sign>}
          {error && (
            <p className="home__error" role="alert">
              {error}
            </p>
          )}

          <div className="home__actions">
            <Button variant="go" type="submit" disabled={!best || !keyboard || joining}>
              {t("fight")}
            </Button>
            <Button onClick={onPractice} disabled={!keyboard}>
              {t("practice")}
            </Button>
          </div>
        </form>
      </section>

      <section className="home__side">
        <fieldset className="levels home__levels">
          <legend className="field__label home__levels-head">
            {t("difficulty")}
            <Sign tone="paper" className="home__region">
            <span className="sign__small">{t("region")}</span>
            {regions === null ? (
              <span>{t("pinging")}</span>
            ) : best ? (
              <span className="tabular">
                {best.id} · {best.ping} ms
              </span>
            ) : (
              <>
                <span>{t("noServer")}</span>
                <span className="sign__small">{t("noServerHint")}</span>
              </>
            )}
          </Sign>
          </legend>
          <div className="levels__row">
            {DIFFICULTY_IDS.map((id, i) => {
              const def = DIFFICULTIES[id];
              return (
                <label
                  key={id}
                  className="level"
                  data-on={profile.difficulty === id || undefined}
                  title={`${def.phases[0]!.bpm}–${def.phases.at(-1)!.bpm} BPM`}
                >
                  <input
                    type="radio"
                    name="difficulty"
                    className="visually-hidden"
                    checked={profile.difficulty === id}
                    onChange={() => set({ difficulty: id })}
                  />
                  <span className="level__meter" aria-hidden="true">
                    {DIFFICULTY_IDS.map((_, k) => (
                      <span key={k} data-full={k <= i || undefined} />
                    ))}
                  </span>
                  <span className="level__name">{def.name[profile.lang]}</span>
                  <span className="level__blurb">{def.blurb[profile.lang]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>


      <section className="home__town" aria-label={t("mode")}>
        <ModeHouse
          mode="duel"
          selected={profile.mode === "duel"}
          onPick={pickMode}
          label={t("duel")}
          sub={t("duelShort")}
          floors={2}
          roof="dome"
          wall="var(--team-2)"
        />
        <ModeHouse
          mode="ffa3"
          selected={profile.mode === "ffa3"}
          onPick={pickMode}
          label={t("ffa3")}
          sub={t("ffa3Short")}
          floors={3}
          roof="gable"
          wall="var(--team-0)"
        />
        <ModeHouse
          mode="team6"
          selected={profile.mode === "team6"}
          onPick={pickMode}
          label={t("team6")}
          sub={t("team6Short")}
          floors={6}
          roof="flat"
          wall="var(--team-1)"
        />


      </section>
      </section>

      <div className="home__ground" aria-hidden="true" />
    </main>
  );
}

function ModeHouse({
  mode,
  selected,
  onPick,
  label,
  sub,
  floors,
  roof,
  wall,
}: {
  mode: ModeId;
  selected: boolean;
  onPick: (m: ModeId) => void;
  label: string;
  sub: string;
  floors: number;
  roof: "gable" | "flat" | "dome";
  wall: string;
}) {
  const team = mode === "team6";
  return (
    <label className="mode" data-selected={selected || undefined}>
      <input type="radio" name="mode" className="visually-hidden" checked={selected} onChange={() => onPick(mode)} />
      <Callout dir="down" len={22} className="mode__label">
        <strong>{label}</strong>
        <span>{sub}</span>
      </Callout>
      <Building
        roof={roof}
        wall={selected ? wall : "var(--sand)"}
        floorHeight={team ? 34 : 48}
        floors={Array.from({ length: floors }, (_, i) => (
          <span className="mode__window" data-team={team ? i % 2 : i} key={i}>
            <span />
            <span />
          </span>
        ))}
      />
    </label>
  );
}
