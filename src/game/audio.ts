import { PlanetId } from './types';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private soundEnabled = true;
  private musicEnabled = true;
  private musicTimer: number | null = null;
  private currentPlanet: PlanetId = 'venus';
  private stepIndex = 0;
  private customAudioEl: HTMLAudioElement | null = null;
  private customTrackActive = false;

  private ensureContext(): AudioContext | null {
    if (!this.soundEnabled && !this.musicEnabled) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setSettings(sound: boolean, music: boolean): void {
    this.soundEnabled = sound;
    this.musicEnabled = music;
    if (!music) {
      this.stopMusic();
    }
  }

  public playCustomLyriaTrack(dataUrl: string): void {
    this.stopMusic();
    try {
      this.customAudioEl = new Audio(dataUrl);
      this.customAudioEl.loop = true;
      this.customAudioEl.volume = 0.55;
      this.customTrackActive = true;
      if (this.musicEnabled) {
        this.customAudioEl.play().catch(() => {});
      }
    } catch {
      this.customTrackActive = false;
    }
  }

  public clearCustomTrack(): void {
    if (this.customAudioEl) {
      this.customAudioEl.pause();
      this.customAudioEl = null;
    }
    this.customTrackActive = false;
  }

  public startPlanetMusic(planetId: PlanetId): void {
    this.currentPlanet = planetId;
    if (!this.musicEnabled) return;
    if (this.customTrackActive && this.customAudioEl) {
      this.customAudioEl.play().catch(() => {});
      return;
    }
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
    }
    this.stepIndex = 0;

    // Scales (in Hz) tailored to each planet's mood + Indian Bhairav/Kafi/Yaman modal intervals for DesiDiya identity
    const planetScales: Record<PlanetId, number[]> = {
      venus: [220, 233.08, 277.18, 293.66, 329.63, 349.23, 415.3, 440],
      earth: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25],
      mars: [196.0, 207.65, 246.94, 261.63, 293.66, 311.13, 369.99, 392.0],
      jupiter: [174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0],
      saturn: [246.94, 277.18, 311.13, 369.99, 415.3, 493.88, 554.37, 622.25],
      uranus: [293.66, 329.63, 349.23, 440.0, 493.88, 587.33, 659.25, 698.46],
      neptune: [164.81, 185.0, 196.0, 246.94, 261.63, 329.63, 369.99, 392.0],
      sun: [261.63, 293.66, 329.63, 369.99, 392.0, 440.0, 493.88, 523.25],
    };

    this.musicTimer = window.setInterval(() => {
      if (!this.musicEnabled || this.customTrackActive) return;
      const ctx = this.ensureContext();
      if (!ctx) return;

      const scale = planetScales[this.currentPlanet] ?? planetScales.venus;
      const pattern = [0, 2, 4, 3, 5, 4, 7, 4];
      const noteFreq = scale[pattern[this.stepIndex % pattern.length]];
      const now = ctx.currentTime;

      // Arpeggio synth pulse
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = this.currentPlanet === 'sun' ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(noteFreq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.032, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);

      // Sub-bass drone on downbeats
      if (this.stepIndex % 4 === 0) {
        const bass = ctx.createOscillator();
        const bGain = ctx.createGain();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(scale[0] * 0.5, now);
        bGain.gain.setValueAtTime(0.001, now);
        bGain.gain.linearRampToValueAtTime(0.055, now + 0.05);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        bass.connect(bGain);
        bGain.connect(ctx.destination);
        bass.start(now);
        bass.stop(now + 0.68);
      }

      this.stepIndex++;
    }, 240);
  }

  public stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.customAudioEl) {
      this.customAudioEl.pause();
    }
  }

  public playLaser(weaponLevel = 1): void {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const pitchVariance = 0.94 + Math.random() * 0.12;
    const baseFreq = (580 + weaponLevel * 45) * pitchVariance;
    osc.type = weaponLevel >= 6 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.085);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  public playMissileLaunch(): void {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.22);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playHit(): void {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(240 + Math.random() * 60, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.05);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playExplosion(heavy = false): void {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = heavy ? 0.48 : 0.22;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(heavy ? 110 : 165, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + dur);
    gain.gain.setValueAtTime(heavy ? 0.16 : 0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  public playPickup(isSpecial = false): void {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isSpecial ? 523.25 : 659.25, now);
    osc.frequency.setValueAtTime(isSpecial ? 783.99 : 880, now + 0.06);
    if (isSpecial) {
      osc.frequency.setValueAtTime(1046.5, now + 0.12);
    }
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isSpecial ? 0.26 : 0.15));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isSpecial ? 0.28 : 0.16));
  }

  public playSpecialDiyaNova(): void {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [261.63, 329.63, 392.0, 523.25, 659.25];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.04);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, now + 0.55);
      gain.gain.setValueAtTime(0.05, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + 0.62);
    });
  }

  public playBossWarning(): void {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now + i * 0.28);
      osc.frequency.linearRampToValueAtTime(440, now + i * 0.28 + 0.22);
      gain.gain.setValueAtTime(0.08, now + i * 0.28);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.28 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.28);
      osc.stop(now + i * 0.28 + 0.26);
    }
  }

  public playIlluminationFanfare(): void {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    chord.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.09);
      gain.gain.setValueAtTime(0.06, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.95);
    });
  }
}

export const soundEngine = new SoundEngine();
