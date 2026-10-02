import type { AudioCueType } from './types.js';

interface ActiveVoice {
  id: number;
  stop: () => void;
  type: AudioCueType;
  endTime: number;
}

/**
 * Audio Director and Procedural Synthesizer.
 * Implements 06_ART_UX.md §12 specifications:
 * - Max 16 concurrent voices pool with impact throttling.
 * - Stereo panning based on public event coordinate.
 * - Transient cutoff on seek (stopAllTransients).
 * - Mute, volume, and reduced sensory support.
 * - Safe graceful fallback when Web Audio API is unavailable (SSR/Node/headless).
 */
export class AudioDirector {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.5;
  private muted: boolean = false;
  private reducedSensory: boolean = false;
  private voiceIdCounter: number = 0;
  private activeVoices: ActiveVoice[] = [];
  private readonly maxConcurrentVoices: number = 16;
  private lastImpactTime: number = 0;

  constructor(options?: { volume?: number; muted?: boolean; reducedSensory?: boolean }) {
    this.volume = options?.volume ?? 0.5;
    this.muted = options?.muted ?? false;
    this.reducedSensory = options?.reducedSensory ?? false;
  }

  /**
   * Initializes AudioContext upon user gesture
   */
  public init(): boolean {
    if (typeof window === 'undefined') return false;
    const AudioContextClass =
      window.AudioContext ||
      // @ts-expect-error webkitAudioContext fallback
      window.webkitAudioContext;
    if (!AudioContextClass) return false;

    if (!this.ctx) {
      try {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return false;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return true;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public setReducedSensory(reduced: boolean): void {
    this.reducedSensory = reduced;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public getActiveVoiceCount(): number {
    this.cleanupFinishedVoices();
    return this.activeVoices.length;
  }

  /**
   * Immediately halts all playing transient sounds.
   * MUST be called during replay scrubbing/seeking to prevent sound stacking.
   */
  public stopAllTransients(): void {
    for (const voice of this.activeVoices) {
      try {
        voice.stop();
      } catch {
        // ignore already stopped voices
      }
    }
    this.activeVoices = [];
  }

  /**
   * Plays a procedural sound motif based on event type and stereo location.
   */
  public playCue(type: AudioCueType, worldX: number = 0): void {
    if (this.muted) return;
    if (!this.ctx || !this.masterGain) {
      const initialized = this.init();
      if (!initialized || !this.ctx || !this.masterGain) return;
    }

    const now = this.ctx.currentTime;
    this.cleanupFinishedVoices();

    // Voice pool check (max 16 voices)
    if (this.activeVoices.length >= this.maxConcurrentVoices) {
      // Throttle: drop oldest impact or non-critical voice
      const oldest = this.activeVoices.shift();
      if (oldest) {
        try {
          oldest.stop();
        } catch {
          // ignore
        }
      }
    }

    // Impact throttling (minimum 30ms between impact sounds)
    if (type === 'blade_hit' || type === 'module_break' || type === 'shield_block') {
      if (now - this.lastImpactTime < 0.03) return;
      this.lastImpactTime = now;
    }

    // Reduced sensory mode: tone down heavy impacts
    const intensityScale = this.reducedSensory ? 0.4 : 1.0;

    // Stereo Panner (-20m to +20m arena width mapped to -0.85 to +0.85 pan)
    const panNode = this.createPanner(worldX);
    const voiceGain = this.ctx.createGain();
    voiceGain.gain.setValueAtTime(intensityScale, now);

    voiceGain.connect(panNode);
    panNode.connect(this.masterGain);

    const voiceId = ++this.voiceIdCounter;
    let duration = 0.2;
    let stopFn: () => void = () => {};

    switch (type) {
      case 'ui_click':
        duration = 0.05;
        stopFn = this.synthClick(now, voiceGain);
        break;
      case 'ui_confirm':
        duration = 0.15;
        stopFn = this.synthConfirm(now, voiceGain);
        break;
      case 'ui_alert':
        duration = 0.25;
        stopFn = this.synthAlert(now, voiceGain);
        break;
      case 'ui_submit':
        duration = 0.4;
        stopFn = this.synthSubmit(now, voiceGain);
        break;
      case 'blade_windup':
        duration = 0.3; // 18 ticks = 300ms
        stopFn = this.synthBladeWindup(now, voiceGain);
        break;
      case 'blade_active':
        duration = 0.12;
        stopFn = this.synthBladeSwoosh(now, voiceGain);
        break;
      case 'blade_hit':
        duration = 0.2;
        stopFn = this.synthCeramicHit(now, voiceGain);
        break;
      case 'burst_pulse':
        duration = 0.08;
        stopFn = this.synthBurstPulse(now, voiceGain);
        break;
      case 'shield_raise':
        duration = 0.25;
        stopFn = this.synthShieldRaise(now, voiceGain);
        break;
      case 'shield_block':
        duration = 0.2;
        stopFn = this.synthShieldBlock(now, voiceGain);
        break;
      case 'module_break':
        duration = 0.35;
        stopFn = this.synthModuleBreak(now, voiceGain);
        break;
      case 'core_break':
      case 'core_critical':
        duration = 0.6;
        stopFn = this.synthCoreCritical(now, voiceGain);
        break;
      default:
        duration = 0.1;
        stopFn = this.synthClick(now, voiceGain);
        break;
    }

    this.activeVoices.push({
      id: voiceId,
      type,
      endTime: now + duration,
      stop: stopFn,
    });
  }

  private createPanner(worldX: number): AudioNode {
    if (!this.ctx) throw new Error('No audio context');
    const clampedX = Math.max(-20, Math.min(20, worldX));
    const panValue = (clampedX / 20) * 0.85;

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(panValue, this.ctx.currentTime);
      return panner;
    }
    // Fallback simple gain node if StereoPanner is unsupported
    return this.ctx.createGain();
  }

  private cleanupFinishedVoices(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.activeVoices = this.activeVoices.filter(v => v.endTime > now);
  }

  // --- Procedural Synth Motifs ---

  private synthClick(now: number, out: GainNode): () => void {
    if (!this.ctx) return () => {};
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
    g.gain.setValueAtTime(0.4, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.05);
    return () => {
      try {
        osc.stop();
      } catch {}
    };
  }

  private synthConfirm(now: number, out: GainNode): () => void {
    if (!this.ctx) return () => {};
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.setValueAtTime(780, now + 0.06);
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.15);
    return () => {
      try {
        osc.stop();
      } catch {}
    };
  }

  private synthAlert(now: number, out: GainNode): () => void {
    if (!this.ctx) return () => {};
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(330, now + 0.1);
    g.gain.setValueAtTime(0.35, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.25);
    return () => {
      try {
        osc.stop();
      } catch {}
    };
  }

  private synthSubmit(now: number, out: GainNode): () => void {
    if (!this.ctx) return () => {};
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.2);
    g.gain.setValueAtTime(0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.4);
    return () => {
      try {
        osc.stop();
      } catch {}
    };
  }

  private synthBladeWindup(now: number, out: GainNode): () => void {
    if (!this.ctx) return () => {};
    // Rising servo motor whine (300ms / 18 ticks)
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.28);
    g.gain.setValueAtTime(0.05, now);
    g.gain.linearRampToValueAtTime(0.3, now + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.3);
    return () => {
      try {
        osc.stop();
      } catch {}
    };
  }

  private synthBladeSwoosh(now: number, out: GainNode): () => void {
    if (!this.ctx) return () => {};
    // Sharp air swoosh
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
    g.gain.setValueAtTime(0.4, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.12);
    return () => {
      try {
        osc.stop();
      } catch {}
    };
  }

  private synthCeramicHit(now: number, out: GainNode): () => void {
    if (!this.ctx) return () => {};
    // Crisp ceramic fracture snap
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    g.gain.setValueAtTime(0.6, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.2);
    return () => {
      try {
        osc.stop();
      } catch {}
    };
  }

  private synthBurstPulse(now: number, out: GainNode): () => void {
    if (!this.ctx) return () => {};
    // Dry metallic report pulse
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.07);
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.08);
    return () => {
      try {
        osc.stop();
      } catch {}
    };
  }

  private synthShieldRaise(now: number, out: GainNode): () => void {
    if (!this.ctx) return () => {};
    // Gentle magnetic hum
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(330, now + 0.2);
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.25);
    return () => {
      try {
        osc.stop();
      } catch {}
    };
  }

  private synthShieldBlock(now: number, out: GainNode): () => void {
    if (!this.ctx) return () => {};
    // Muffled low-pass absorption thud
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.18);
    g.gain.setValueAtTime(0.55, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.2);
    return () => {
      try {
        osc.stop();
      } catch {}
    };
  }

  private synthModuleBreak(now: number, out: GainNode): () => void {
    if (!this.ctx) return () => {};
    // Violent ceramic fracture
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.3);
    g.gain.setValueAtTime(0.7, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.35);
    return () => {
      try {
        osc.stop();
      } catch {}
    };
  }

  private synthCoreCritical(now: number, out: GainNode): () => void {
    if (!this.ctx) return () => {};
    // Deep harmonic gong
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.55);
    g.gain.setValueAtTime(0.8, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.6);
    return () => {
      try {
        osc.stop();
      } catch {}
    };
  }
}
