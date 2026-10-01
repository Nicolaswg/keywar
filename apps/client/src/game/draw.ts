import { KEYBOARD_WIDTH_U, SLOT_BY_CODE, legendFor, phaseAt, type JudgeWindows, type LayoutId, type Note } from "@keywar/shared";
import type { LaneController } from "./controller";

/** Paint read once from the CSS tokens so canvas and DOM share one palette. */
export function readPaint() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    paper: v("--paper"),
    paperShade: v("--paper-shade"),
    ink: v("--ink"),
    inkSoft: v("--ink-soft"),
    brick: v("--brick"),
    bus: v("--bus"),
    grass: v("--grass-deep"),
    grassLight: v("--grass"),
    skyDeep: v("--sky-deep"),
    sky: v("--sky"),
    sand: v("--sand"),
    sandDeep: v("--sand-deep"),
    cement: v("--cement"),
    fontKey: v("--font-key"),
    fontDisplay: v("--font-display"),
    fontLabel: v("--font-label"),
  };
}
export type Paint = ReturnType<typeof readPaint>;

export interface DrawInput {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  now: number;
  ctrl: LaneController;
  layout: LayoutId;
  paint: Paint;
  reducedMotion: boolean;
  /** Word printed by the rubber stamp on a hit ("¡PUM!"). */
  stampText: string;
  /** Labels for the three timing bands, widest first: [good, great, perfect]. */
  zoneLabels: [string, string, string];
}

const FLOORS = 4;
/** Room under the hit line for the lower half of the timing bands. */
export const HIT_FROM_BOTTOM = 44;

/** Draws the inside of your building: floors, the hit beam, falling crates and active sabotage. */
export function drawLane({ ctx, w, h, now, ctrl, layout, paint, reducedMotion, stampText, zoneLabels }: DrawInput) {
  const hitY = h - HIT_FROM_BOTTOM;
  const unit = w / KEYBOARD_WIDTH_U;
  const size = Math.min(50, unit * 0.86);
  const phase = phaseAt(Math.max(0, now), ctrl.difficulty);
  const W = ctrl.windows;
  const approach = phase.approachMs * (ctrl.hasEffect("crane") ? 0.6 : 1);
  const mirrored = ctrl.hasEffect("mirror");

  ctx.save();
  ctx.clearRect(0, 0, w, h);

  if (ctrl.hasEffect("quake") && !reducedMotion) {
    ctx.translate(Math.sin(now / 23) * 7, Math.cos(now / 31) * 4);
  }

  // Floors of the building, cut open.
  for (let i = 1; i < FLOORS; i++) {
    const y = Math.round((hitY / FLOORS) * i);
    ctx.fillStyle = paint.sandDeep;
    ctx.fillRect(0, y - 3, w, 6);
    ctx.fillStyle = paint.ink;
    ctx.fillRect(0, y + 3, w, 1.5);
  }

  // Timing bands: drawn to scale, so a crate's centre inside a band IS that judgement.
  const pxPerMs = hitY / approach;
  drawZone(ctx, w, hitY, pxPerMs, paint, zoneLabels, W);

  // Word ropes first, so crates sit on top of them.
  const visible: { n: Note; x: number; y: number }[] = [];
  for (let i = ctrl.firstVisibleIndex(); i < ctrl.chart.length; i++) {
    const n = ctrl.chart[i]!;
    const dt = n.t - now;
    if (dt > approach) break;
    const done = ctrl.judged.get(n.id);
    if (done && done.judgement !== "miss") continue;
    if (dt < -220) continue;
    const slot = SLOT_BY_CODE.get(n.key.code);
    if (!slot) continue;
    visible.push({ n, x: slot.x * unit, y: hitY - (dt / approach) * hitY });
  }

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = paint.inkSoft;
  ctx.setLineDash([4, 4]);
  for (let i = 1; i < visible.length; i++) {
    const a = visible[i - 1]!;
    const b = visible[i]!;
    if (a.n.wordId === undefined || a.n.wordId !== b.n.wordId) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Landing pads: where each crate will land, filling in as its moment arrives.
  for (const { n, x } of visible) {
    const dt = n.t - now;
    if (dt > approach * 0.6 || ctrl.judged.has(n.id)) continue;
    drawPad(ctx, x, hitY, size, dt, approach, paint, W.good);
  }

  for (const { n, x, y } of visible) {
    const hot = !ctrl.judged.has(n.id) && Math.abs(n.t - now) <= W.perfect;
    drawCrate(ctx, n, x, y, size, ctrl, layout, paint, mirrored, approach, hitY, hot);
    const first = n.wordId !== undefined && visible.find((v) => v.n.wordId === n.wordId)?.n === n;
    if (first) label(ctx, n.word!, x + size * 0.55, y - size * 0.9, paint);
  }

  // The signature moment: the crate is squashed onto the beam and a rubber stamp prints "¡PUM!".
  for (const j of ctrl.judged.values()) {
    if (j.judgement === "miss") continue;
    const age = now - j.at;
    if (age > STAMP_MS || age < 0) continue;
    const slot = SLOT_BY_CODE.get(j.note.key.code);
    if (slot) drawStamp(ctx, slot.x * unit, hitY, size, age, j.judgement === "perfect", stampText, paint);
  }

  // Sabotage overlays.
  if (ctrl.hasEffect("mixer")) drawCement(ctx, w, hitY, now, paint);
  if (ctrl.hasEffect("blackout")) {
    ctx.fillStyle = paint.ink;
    ctx.globalAlpha = 0.95;
    ctx.fillRect(0, hitY * 0.62, w, hitY * 0.38 - 8);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/** Good / great / perfect bands centred on the hit line, with the exact moment as an ink line. */
function drawZone(ctx: CanvasRenderingContext2D, w: number, hitY: number, pxPerMs: number, paint: Paint, labels: [string, string, string], win: JudgeWindows) {
  const bands: [number, string, number][] = [
    [win.good, paint.sandDeep, 0.55],
    [win.great, paint.sky, 1],
    [win.perfect, paint.bus, 1],
  ];
  for (const [ms, color, alpha] of bands) {
    const half = ms * pxPerMs;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, hitY - half, w, half * 2);
  }
  ctx.globalAlpha = 1;
  const outer = win.good * pxPerMs;
  ctx.fillStyle = paint.ink;
  ctx.fillRect(0, hitY - outer, w, 2);
  ctx.fillRect(0, hitY + outer, w, 2);
  // The exact moment.
  ctx.fillRect(0, hitY - 1.25, w, 2.5);

  // Labels at the left edge, one per band, above the line so they never cover the centre.
  ctx.font = `15px ${paint.fontLabel}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = paint.ink;
  const perfectH = win.perfect * pxPerMs;
  const greatH = win.great * pxPerMs;
  if (perfectH >= 7) ctx.fillText(labels[2], 6, hitY - perfectH / 2 - 1);
  if (greatH - perfectH >= 9) ctx.fillText(labels[1], 6, hitY - (greatH + perfectH) / 2);
  if (outer - greatH >= 9) ctx.fillText(labels[0], 6, hitY - (outer + greatH) / 2);
}

/** Dashed outline where a crate will land; it firms up as the moment nears and turns green in the window. */
function drawPad(ctx: CanvasRenderingContext2D, x: number, hitY: number, size: number, dt: number, approach: number, paint: Paint, goodMs: number) {
  const inWindow = Math.abs(dt) <= goodMs;
  const closeness = 1 - Math.min(1, Math.max(0, dt) / (approach * 0.6));
  ctx.save();
  ctx.globalAlpha = inWindow ? 1 : 0.25 + closeness * 0.6;
  if (inWindow) {
    ctx.fillStyle = paint.grassLight;
    ctx.globalAlpha = 0.45;
    roundRect(ctx, x - size / 2 - 4, hitY - size / 2 - 4, size + 8, size + 8, 10);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = inWindow ? paint.grass : paint.ink;
  ctx.lineWidth = inWindow ? 3 : 2;
  ctx.setLineDash(inWindow ? [] : [5, 4]);
  roundRect(ctx, x - size / 2 - 4, hitY - size / 2 - 4, size + 8, size + 8, 10);
  ctx.stroke();
  ctx.restore();
}

function drawCrate(
  ctx: CanvasRenderingContext2D,
  n: Note,
  x: number,
  y: number,
  size: number,
  ctrl: LaneController,
  layout: LayoutId,
  paint: Paint,
  mirrored: boolean,
  approach: number,
  hitY: number,
  hot: boolean,
) {
  const shift = ctrl.needsShift(n);
  const ctrlKey = n.key.ctrl;
  const missed = ctrl.judged.get(n.id)?.judgement === "miss";
  const fill = ctrlKey ? paint.brick : shift ? paint.grass : n.kind === "hold" ? paint.sky : paint.bus;
  const text = ctrlKey || shift ? paint.paper : paint.ink;
  const tagged = ctrlKey || shift;
  const hgt = tagged ? size * 1.22 : size;
  const left = x - size / 2;
  const top = y - hgt / 2;

  ctx.globalAlpha = missed ? 0.35 : 1;

  // Hold tail: a rope up to where the hold ends.
  if (n.kind === "hold" && n.holdMs) {
    const tail = (n.holdMs / approach) * hitY;
    ctx.fillStyle = paint.sky;
    ctx.strokeStyle = paint.ink;
    ctx.lineWidth = 2;
    roundRect(ctx, x - size * 0.16, y - tail, size * 0.32, tail, 6);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = fill;
  ctx.strokeStyle = paint.ink;
  ctx.lineWidth = hot ? 4.5 : 2.5;
  roundRect(ctx, left, top, size, hgt, 8);
  ctx.fill();
  // painted depth band
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgb(74 46 28 / 0.16)";
  ctx.fillRect(left, top + hgt - 6, size, 6);
  ctx.restore();
  ctx.stroke();

  const legend = legendFor({ ...n.key, shift }, layout);
  ctx.save();
  ctx.translate(x, top + hgt - size / 2);
  if (mirrored) ctx.scale(-1, 1);
  ctx.fillStyle = text;
  ctx.font = `700 ${Math.round(size * 0.52)}px ${paint.fontKey}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(legend, 0, 1);
  ctx.restore();

  if (tagged) {
    ctx.fillStyle = text;
    ctx.font = `${Math.round(size * 0.26)}px ${paint.fontLabel}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(ctrlKey ? "CTRL" : "SHIFT", x, top + 3);
  }
  ctx.globalAlpha = 1;
}

const STAMP_MS = 420;

function drawStamp(ctx: CanvasRenderingContext2D, x: number, hitY: number, size: number, age: number, perfect: boolean, text: string, paint: Paint) {
  const k = age / STAMP_MS;
  // Squash: wide and flat on impact, springing back as it fades.
  const squash = Math.max(0, 1 - age / 140);
  const sw = size * (1 + 0.35 * squash);
  const sh = size * (1 - 0.5 * squash);
  ctx.globalAlpha = 1 - Math.max(0, (age - 140) / (STAMP_MS - 140));
  ctx.fillStyle = paint.bus;
  ctx.strokeStyle = paint.ink;
  ctx.lineWidth = 2.5;
  roundRect(ctx, x - sw / 2, hitY - sh, sw, sh, 8);
  ctx.fill();
  ctx.stroke();

  // Rubber stamp, slightly askew, printed in brick ink above the beam.
  ctx.save();
  ctx.translate(x, hitY - size * 1.25 - k * 10);
  ctx.rotate(-0.14);
  const scale = 1 + 0.25 * squash;
  ctx.scale(scale, scale);
  ctx.font = `800 ${Math.round(size * (perfect ? 0.5 : 0.42))}px ${paint.fontDisplay}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(text).width + 14;
  const th = size * 0.62;
  ctx.strokeStyle = paint.brick;
  ctx.lineWidth = 2.5;
  roundRect(ctx, -tw / 2, -th / 2, tw, th, 6);
  ctx.stroke();
  ctx.fillStyle = paint.brick;
  ctx.fillText(text, 0, 1);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Handwritten label with a hairline pointer down-left to the crate. */
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, paint: Paint) {
  ctx.strokeStyle = paint.ink;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 18);
  ctx.lineTo(x + 6, y + 4);
  ctx.stroke();
  ctx.fillStyle = paint.ink;
  ctx.font = `20px ${paint.fontLabel}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(text, x + 8, y + 8);
}

function drawCement(ctx: CanvasRenderingContext2D, w: number, hitY: number, now: number, paint: Paint) {
  const top = hitY * 0.32;
  const bottom = hitY * 0.6;
  ctx.beginPath();
  ctx.moveTo(0, top + 10);
  for (let x = 0; x <= w; x += w / 10) ctx.lineTo(x, top + Math.sin(x / 40 + now / 400) * 8);
  for (let x = w; x >= 0; x -= w / 10) ctx.lineTo(x, bottom + Math.cos(x / 50 + now / 500) * 10);
  ctx.closePath();
  ctx.fillStyle = paint.cement;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgb(74 46 28 / 0.25)";
  ctx.lineWidth = 2;
  for (let x = -hitY; x < w; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, bottom + 20);
    ctx.lineTo(x + (bottom - top) + 40, top - 20);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = paint.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
