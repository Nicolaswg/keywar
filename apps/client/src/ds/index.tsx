import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import "./ds.css";

type ButtonVariant = "go" | "plain" | "danger" | "ghost";

export function Button({ variant = "plain", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type="button" className="btn" data-variant={variant} {...rest} />;
}

export function Field({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="field__input" {...rest} />
    </div>
  );
}

/** A small handwritten label with a hairline pointer, Busytown style. */
export function Callout({
  children,
  dir = "left",
  len = 28,
  style,
  className = "",
}: {
  children: ReactNode;
  dir?: "left" | "right" | "up" | "down";
  len?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <span className={`callout ${className}`} data-dir={dir} style={{ "--len": `${len}px`, ...style } as CSSProperties}>
      {children}
    </span>
  );
}

export function Sign({
  children,
  tone = "paper",
  posts = false,
  className = "",
  style,
}: {
  children: ReactNode;
  tone?: "paper" | "bus" | "grass" | "brick" | "sky";
  posts?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`sign ${className}`} data-tone={tone} data-posts={posts || undefined} style={style}>
      {children}
    </div>
  );
}

export type RoofShape = "gable" | "flat" | "dome";

/** Team → roof shape, so a team is readable without colour. */
export const ROOF_FOR_TEAM: RoofShape[] = ["gable", "flat", "dome"];

const ROOF_VIEWBOX: Record<RoofShape, string> = { gable: "0 0 120 40", flat: "0 22 120 18", dome: "0 12 120 28" };

export function Roof({ shape }: { shape: RoofShape }) {
  return (
    <svg className="building__roof" data-shape={shape} viewBox={ROOF_VIEWBOX[shape]} preserveAspectRatio="none" aria-hidden="true">
      {shape === "gable" && <path d="M4 38 L60 4 L116 38 Z" />}
      {shape === "flat" && <path d="M2 38 V24 H14 V30 H106 V24 H118 V38 Z" />}
      {shape === "dome" && <path d="M8 38 C 14 8, 106 8, 112 38 Z" />}
    </svg>
  );
}

export function Building({
  roof,
  wall,
  floors,
  plate,
  down = false,
  floorHeight,
  className = "",
  style,
  roofSlot,
}: {
  roof: RoofShape;
  wall: string;
  floors: ReactNode[];
  plate?: ReactNode;
  down?: boolean;
  floorHeight?: number;
  className?: string;
  style?: CSSProperties;
  /** Something standing on the roof (the ink water tower). */
  roofSlot?: ReactNode;
}) {
  return (
    <div
      className={`building ${className}`}
      data-down={down || undefined}
      style={{ "--wall": wall, ...(floorHeight ? { "--floor-h": `${floorHeight}px` } : {}), ...style } as CSSProperties}
    >
      <div style={{ position: "relative", width: "100%", display: "grid", justifyItems: "center" }}>
        {roofSlot}
        <Roof shape={roof} />
      </div>
      <div className="building__body">
        {plate && <div className="building__plate">{plate}</div>}
        {floors.map((f, i) => (
          <div className="building__floor" key={i}>
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}

/** HP drawn as bricks: each brick is `per` HP. */
export function BrickWall({ hp, max, per = 50, falling = -1 }: { hp: number; max: number; per?: number; falling?: number }) {
  const total = Math.ceil(max / per);
  const left = Math.ceil(Math.max(0, hp) / per);
  return (
    <div className="bricks" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp} aria-label="HP">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="brick" data-gone={i >= left || undefined} data-falling={i === falling || undefined} />
      ))}
    </div>
  );
}

export function WaterTower({ value, max = 100, label }: { value: number; max?: number; label: string }) {
  return (
    <div className="tower" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <div className="tower__tank">
        <div className="tower__ink" style={{ transform: `scaleY(${value / max})` }} />
      </div>
      <div className="tower__legs" />
    </div>
  );
}

export function KeyCap({ legend, state, style }: { legend: string; state?: "next" | "down"; style?: CSSProperties }) {
  return (
    <span className="keycap" data-state={state} style={style}>
      {legend}
    </span>
  );
}
