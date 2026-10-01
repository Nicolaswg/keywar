import { beatGrid, type Difficulty } from "@keywar/shared";

/**
 * Placeholder soundtrack: a synthesized beat on the chart's own grid, so the
 * game is playable before licensed (CC0/original) tracks exist. It is
 * scheduled against the match clock, so audio and crates share one timeline.
 */
export class BeatPlayer {
  private ctx = new AudioContext();
  private master = this.ctx.createGain();
  private grid: ReturnType<typeof beatGrid>;
  private cursor = 0;
  private timer?: ReturnType<typeof setInterval>;
  private noise: AudioBuffer;

  constructor(private matchNow: () => number, difficulty: Difficulty, volume = 0.5) {
    this.grid = beatGrid(difficulty);
    this.master.gain.value = volume;
    this.master.connect(this.ctx.destination);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  start() {
    void this.ctx.resume();
    this.timer = setInterval(() => this.schedule(), 40);
  }

  stop() {
    clearInterval(this.timer);
    void this.ctx.close();
  }

  private schedule() {
    const now = this.matchNow();
    if (!Number.isFinite(now)) return;
    const horizon = now + 180;
    while (this.cursor < this.grid.length && this.grid[this.cursor]!.t < horizon) {
      const ev = this.grid[this.cursor++]!;
      if (ev.t < now - 20) continue;
      const at = this.ctx.currentTime + (ev.t - now) / 1000;
      if (ev.beat) this.kick(at, ev.bar ? 1 : 0.7);
      this.hat(at, ev.beat ? 0.12 : 0.22);
    }
  }

  private kick(at: number, gain: number) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.setValueAtTime(130, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.12);
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
    osc.connect(g).connect(this.master);
    osc.start(at);
    osc.stop(at + 0.2);
  }

  private hat(at: number, gain: number) {
    const src = this.ctx.createBufferSource();
    const hp = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    src.buffer = this.noise;
    hp.type = "highpass";
    hp.frequency.value = 7000;
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.04);
    src.connect(hp).connect(g).connect(this.master);
    src.start(at, 0, 0.05);
  }

  /** A woody "tock" when a crate is stamped; pitch rises with the multiplier. */
  stamp(mult: number) {
    const at = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520 + mult * 90, at);
    osc.frequency.exponentialRampToValueAtTime(260, at + 0.06);
    g.gain.setValueAtTime(0.25, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
    osc.connect(g).connect(this.master);
    osc.start(at);
    osc.stop(at + 0.1);
  }

  /** A dull thud for a miss or a wrong key. */
  thud() {
    const at = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    const lp = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    src.buffer = this.noise;
    lp.type = "lowpass";
    lp.frequency.value = 400;
    g.gain.setValueAtTime(0.35, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
    src.connect(lp).connect(g).connect(this.master);
    src.start(at, 0, 0.13);
  }
}
