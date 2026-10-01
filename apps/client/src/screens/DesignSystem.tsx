import { MATCH } from "@keywar/shared";
import { BrickWall, Building, Button, Callout, Field, KeyCap, ROOF_FOR_TEAM, Sign, WaterTower } from "../ds";
import "./ds-page.css";

const PAINT = [
  ["--paper", "Papel"],
  ["--paper-shade", "Papel sombra"],
  ["--ink", "Tinta (contorno y texto)"],
  ["--brick", "Ladrillo · equipo 0"],
  ["--sky-deep", "Cielo hondo · equipo 1"],
  ["--grass", "Césped · equipo 2"],
  ["--bus", "Autobús escolar · acción"],
  ["--sky", "Cielo"],
  ["--sand", "Arena"],
  ["--cement", "Cemento"],
] as const;

/** Living reference for the design system. Open the client with ?ds. */
export function DesignSystem() {
  return (
    <main className="dsp">
      <header className="dsp__head">
        <h1 className="wordmark">KeyWar</h1>
        <p>Design system · ciudad en corte. Gouache plano, un contorno marrón para todo, etiquetas a mano que nombran cada cosa.</p>
      </header>

      <section className="dsp__section">
        <h2>Pintura</h2>
        <div className="dsp__swatches">
          {PAINT.map(([token, name]) => (
            <figure key={token} className="swatch">
              <span style={{ background: `var(${token})` }} />
              <figcaption>
                <Callout dir="left" len={18}>
                  {name}
                </Callout>
                <code>{token}</code>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="dsp__section">
        <h2>Letra</h2>
        <div className="dsp__type">
          <p className="t-display">¡PUM! Display · Shantell Sans</p>
          <p className="t-key">a s d f ñ ; Ç ¿ 0 · Teclas y texto · Andika</p>
          <p className="t-label">etiqueta a mano · Patrick Hand</p>
        </div>
      </section>

      <section className="dsp__section">
        <h2>Controles</h2>
        <div className="dsp__row">
          <Button variant="go">¡A pelear!</Button>
          <Button>Practicar con bots</Button>
          <Button variant="danger">Cancelar</Button>
          <Button variant="go" disabled>
            Sin servidor
          </Button>
          <Button variant="ghost">Inicio</Button>
        </div>
        <div className="dsp__row">
          <Field label="Tu apodo" placeholder="p. ej. Gato Tecla" />
        </div>
      </section>

      <section className="dsp__section">
        <h2>Letreros y etiquetas</h2>
        <div className="dsp__row">
          <Sign tone="bus">
            <span className="sign__small">tiempo</span>2:41
          </Sign>
          <Sign tone="brick">
            objetivo<span className="sign__small">Tab cambia</span>
          </Sign>
          <Sign posts>
            <span className="sign__small">Región</span>sa-east · 38 ms
          </Sign>
          <Callout dir="left">línea de golpe</Callout>
          <Callout dir="down">tú</Callout>
        </div>
      </section>

      <section className="dsp__section">
        <h2>Edificios (jugadores)</h2>
        <p className="dsp__note">Cada equipo tiene color y forma de tejado: el color nunca va solo.</p>
        <div className="dsp__row dsp__row--end">
          {[0, 1, 2].map((team) => (
            <Building
              key={team}
              roof={ROOF_FOR_TEAM[team]!}
              wall={`var(--team-${team})`}
              floorHeight={44}
              style={{ width: 190 }}
              floors={[<strong>Equipo {team}</strong>, <BrickWall hp={MATCH.maxHp - team * 330} max={MATCH.maxHp} />, <span>racha 12 · x2</span>]}
            />
          ))}
          <Building roof="gable" wall="var(--team-0)" down floorHeight={44} style={{ width: 190 }} floors={[<strong>Derribado</strong>, <BrickWall hp={0} max={MATCH.maxHp} />]} />
        </div>
      </section>

      <section className="dsp__section">
        <h2>Medidores y teclas</h2>
        <div className="dsp__row dsp__row--end">
          <WaterTower value={64} label="tinta" />
          <KeyCap legend="a" />
          <KeyCap legend="ñ" state="next" />
          <KeyCap legend="k" state="down" />
          <div className="dsp__crates">
            <span className="crate">f</span>
            <span className="crate crate--hold">j</span>
            <span className="crate crate--shift">
              <small>SHIFT</small>?
            </span>
            <span className="crate crate--ctrl">
              <small>CTRL</small>s
            </span>
          </div>
        </div>
        <p className="dsp__note">Cajas: amarilla = tecla, celeste = mantener, verde = con Shift, roja = con Ctrl.</p>
      </section>
    </main>
  );
}
