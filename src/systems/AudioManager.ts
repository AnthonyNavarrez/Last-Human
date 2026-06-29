/** Generates synthetic sound effects via Web Audio API — no audio files required. */
export class AudioManager {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private osc(
    ctx: AudioContext,
    type: OscillatorType,
    f0: number,
    f1: number,
    t: number,
    dur: number,
    vol: number,
  ): void {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t);
    o.stop(t + dur);
  }

  private play(fn: (ctx: AudioContext, t: number) => void): void {
    try {
      const ctx = this.getCtx();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      fn(ctx, ctx.currentTime);
    } catch { /* audio not supported */ }
  }

  sfxMeleeAttack(): void {
    this.play((ctx, t) => { this.osc(ctx, 'square', 180, 60, t, 0.08, 0.12); });
  }

  sfxGather(): void {
    this.play((ctx, t) => { this.osc(ctx, 'sawtooth', 100, 50, t, 0.1, 0.08); });
  }

  sfxEnemyHit(): void {
    this.play((ctx, t) => { this.osc(ctx, 'sine', 500, 250, t, 0.07, 0.15); });
  }

  sfxPlayerHit(): void {
    this.play((ctx, t) => { this.osc(ctx, 'sine', 280, 140, t, 0.12, 0.20); });
  }

  sfxEnemyDeath(): void {
    this.play((ctx, t) => {
      this.osc(ctx, 'sawtooth', 350, 40,  t,        0.25, 0.18);
      this.osc(ctx, 'square',   200, 80,  t + 0.05, 0.15, 0.10);
    });
  }

  sfxHammerHit(): void {
    this.play((ctx, t) => {
      this.osc(ctx, 'square', 220, 80,  t,       0.06, 0.18);
      this.osc(ctx, 'sine',   440, 120, t,       0.04, 0.10);
    });
  }

  sfxHouseHit(): void {
    this.play((ctx, t) => { this.osc(ctx, 'square', 70, 30, t, 0.2, 0.25); });
  }

  sfxCraft(): void {
    this.play((ctx, t) => {
      this.osc(ctx, 'sine', 440, 440, t,        0.08, 0.12);
      this.osc(ctx, 'sine', 550, 550, t + 0.08, 0.08, 0.12);
      this.osc(ctx, 'sine', 660, 660, t + 0.16, 0.12, 0.15);
    });
  }

  sfxNightStart(): void {
    this.play((ctx, t) => {
      this.osc(ctx, 'sine', 440, 220, t,       0.5, 0.08);
      this.osc(ctx, 'sine', 330, 165, t + 0.1, 0.4, 0.06);
    });
  }

  sfxDayStart(): void {
    this.play((ctx, t) => {
      this.osc(ctx, 'sine', 330, 440, t,        0.2, 0.08);
      this.osc(ctx, 'sine', 440, 550, t + 0.15, 0.2, 0.08);
      this.osc(ctx, 'sine', 550, 660, t + 0.30, 0.2, 0.08);
    });
  }

  sfxGameOver(): void {
    this.play((ctx, t) => {
      this.osc(ctx, 'sawtooth', 220, 110, t,       0.6, 0.10);
      this.osc(ctx, 'sawtooth', 165,  82, t + 0.3, 0.5, 0.08);
      this.osc(ctx, 'square',    80,  20, t + 0.7, 0.8, 0.12);
    });
  }
}

export const audioManager = new AudioManager();
