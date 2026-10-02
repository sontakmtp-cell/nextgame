import type { PublicFrame, CombatEvent, PublicModule } from '@prompt-chien/contracts';
import { THEME } from './tokens.js';
import { drawModule } from './glyphs.js';
import { VfxDirector } from './vfx.js';
import { AudioDirector } from './audio.js';
import { PresentationCamera } from './camera.js';
import type { QualityTier, RendererOptions, RenderStats } from './types.js';

export class ArenaRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private camera: PresentationCamera;
  private vfx: VfxDirector;
  private audio: AudioDirector;

  private tier: QualityTier = 'high';
  private enableVfx: boolean = true;
  private enableAudio: boolean = true;
  private grayscale: boolean = false;
  private showColliders: boolean = false;
  private showTelegraphs: boolean = true;
  private dprCap: number = 2.0;

  private frames: PublicFrame[] = [];
  private events: CombatEvent[] = [];
  private currentFrameIndex: number = 0;
  private contextLost: boolean = false;

  private frameDurationMs: number = 0;

  constructor(options: RendererOptions) {
    this.canvas = options.canvas;
    this.tier = options.tier ?? 'high';
    this.enableVfx = options.enableVfx ?? true;
    this.enableAudio = options.enableAudio ?? true;
    this.grayscale = options.grayscale ?? false;
    this.showColliders = options.showColliders ?? false;
    this.showTelegraphs = options.showTelegraphs ?? true;
    this.dprCap = options.dprCap ?? (this.tier === 'high' ? 2.0 : this.tier === 'medium' ? 1.5 : 1.0);

    this.camera = new PresentationCamera(this.canvas.width || 1000, this.canvas.height || 700);
    this.vfx = new VfxDirector();
    this.audio = new AudioDirector({
      volume: options.volume ?? 0.5,
      muted: !this.enableAudio,
      reducedSensory: options.reducedSensory ?? false,
    });

    this.initContext();
    this.setupContextLossHandlers();
  }

  private initContext(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      this.contextLost = true;
      return;
    }
    this.ctx = ctx;
    this.contextLost = false;
    this.applyDpr();
    this.camera.resize(this.canvas.width, this.canvas.height);
  }

  private setupContextLossHandlers(): void {
    if (typeof this.canvas.addEventListener !== 'function') return;

    this.canvas.addEventListener('contextlost', (e: Event) => {
      e.preventDefault();
      this.contextLost = true;
      this.ctx = null;
    });

    this.canvas.addEventListener('contextrestored', () => {
      this.initContext();
      this.renderCurrentFrame();
    });
  }

  private applyDpr(): void {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const effectiveDpr = Math.min(dpr, this.dprCap);

    const rect = this.canvas.getBoundingClientRect?.() ?? { width: 1000, height: 700 };
    const width = Math.round((rect.width || 1000) * effectiveDpr);
    const height = Math.round((rect.height || 700) * effectiveDpr);

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.camera.resize(this.canvas.width, this.canvas.height);
  }

  // --- Public Configuration Methods ---

  public setTier(tier: QualityTier): void {
    this.tier = tier;
    this.dprCap = tier === 'high' ? 2.0 : tier === 'medium' ? 1.5 : 1.0;
    this.applyDpr();
    this.renderCurrentFrame();
  }

  public setVfxEnabled(enabled: boolean): void {
    this.enableVfx = enabled;
    this.renderCurrentFrame();
  }

  public setGrayscale(enabled: boolean): void {
    this.grayscale = enabled;
    this.renderCurrentFrame();
  }

  public setShowColliders(show: boolean): void {
    this.showColliders = show;
    this.renderCurrentFrame();
  }

  public setShowTelegraphs(show: boolean): void {
    this.showTelegraphs = show;
    this.renderCurrentFrame();
  }

  public setVolume(vol: number): void {
    this.audio.setVolume(vol);
  }

  public setMuted(muted: boolean): void {
    this.enableAudio = !muted;
    this.audio.setMuted(muted);
  }

  public getCamera(): PresentationCamera {
    return this.camera;
  }

  public getAudio(): AudioDirector {
    return this.audio;
  }

  public getStats(): RenderStats {
    return {
      frameTimeMs: this.frameDurationMs,
      fps: this.frameDurationMs > 0 ? Math.round(1000 / this.frameDurationMs) : 60,
      drawCalls: 1,
      activeVfxCount: this.enableVfx ? 5 : 0,
      audioVoiceCount: this.audio.getActiveVoiceCount(),
      contextLost: this.contextLost,
      tier: this.tier,
    };
  }

  // --- Replay & Simulation Data Loading ---

  public loadReplay(frames: PublicFrame[], events: CombatEvent[] = []): void {
    this.frames = frames;
    this.events = events;
    this.currentFrameIndex = 0;
    this.audio.stopAllTransients();
    this.renderCurrentFrame();
  }

  /**
   * Seeks to a specific frame index.
   * Completely deterministic: halts transient audio and reconstructs frame.
   */
  public seek(frameIndex: number): void {
    if (this.frames.length === 0) return;
    const target = Math.max(0, Math.min(this.frames.length - 1, frameIndex));
    this.currentFrameIndex = target;
    // Transient audio cut off on seek (06_ART_UX.md §12)
    this.audio.stopAllTransients();
    this.renderCurrentFrame();
  }

  /**
   * Advances by delta frames and plays audio cues for new events.
   */
  public step(delta: number = 1): void {
    if (this.frames.length === 0) return;
    const oldIndex = this.currentFrameIndex;
    const nextIndex = Math.max(0, Math.min(this.frames.length - 1, oldIndex + delta));
    if (oldIndex === nextIndex) return;

    this.currentFrameIndex = nextIndex;
    const frame = this.frames[nextIndex];

    // Trigger audio cues for public events at this tick
    if (this.enableAudio && frame) {
      const boundary = frame.boundary;
      const tickEvents = this.events.filter(e => e.tick === boundary - 1 || e.tick === boundary);
      for (const evt of tickEvents) {
        const actorPose = evt.actor === 'A' || evt.actor === 'B' ? frame.actors[evt.actor].pose.x / 1000 : 0;
        if (evt.kind === 'hit') {
          this.audio.playCue('blade_hit', actorPose);
        } else if (evt.kind === 'blocked') {
          this.audio.playCue('shield_block', actorPose);
        } else if (evt.kind === 'destroyed' || evt.kind === 'detached') {
          this.audio.playCue('module_break', actorPose);
        }
      }
    }

    this.renderCurrentFrame();
  }

  // --- Main Render Pipeline ---

  public renderCurrentFrame(): void {
    if (this.contextLost || !this.ctx) return;
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Clear background
    ctx.save();
    ctx.fillStyle = this.grayscale ? '#101010' : THEME.VOID;
    ctx.fillRect(0, 0, w, h);

    // Apply Presentation Camera Transform
    this.camera.applyTransform(ctx);

    // 2. Draw 40m x 28m Arena Grid & Boundaries
    this.drawArena(ctx);

    const frame = this.frames[this.currentFrameIndex];
    if (frame) {
      // 3. Center Objective & Ring
      this.drawObjectiveAndRing(ctx, frame);

      // 4. Telegraph Layer (Authored readability cues - always visible if enabled)
      if (this.showTelegraphs) {
        this.vfx.renderTelegraphs(ctx, frame, this.tier);
      }

      // 5. Dynamic VFX Layer
      if (this.enableVfx) {
        this.vfx.renderVfx(ctx, frame, this.events, frame.boundary, this.tier);
      }

      // 6. Synth Actors & Modules
      this.drawActors(ctx, frame);

      // 7. Collider Overlay Verification (No collider lie)
      if (this.showColliders) {
        this.drawColliders(ctx, frame);
      }
    }

    ctx.restore();

    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.frameDurationMs = endTime - startTime;
  }

  private drawArena(ctx: CanvasRenderingContext2D): void {
    const arenaFill = this.grayscale ? '#181818' : THEME.ARENA;
    const lineQuiet = this.grayscale ? '#303030' : THEME.LINE_QUIET;
    const lineBorder = this.grayscale ? '#606060' : THEME.LINE;

    // Arena Floor: 40m x 28m (-20 to 20, -14 to 14)
    ctx.fillStyle = arenaFill;
    ctx.fillRect(-20, -14, 40, 28);

    // Grid lines (every 2 meters)
    ctx.strokeStyle = lineQuiet;
    ctx.lineWidth = 0.03;
    for (let x = -20; x <= 20; x += 2) {
      ctx.beginPath();
      ctx.moveTo(x, -14);
      ctx.lineTo(x, 14);
      ctx.stroke();
    }
    for (let y = -14; y <= 14; y += 2) {
      ctx.beginPath();
      ctx.moveTo(-20, y);
      ctx.lineTo(20, y);
      ctx.stroke();
    }

    // Outer Perimeter Wall
    ctx.strokeStyle = lineBorder;
    ctx.lineWidth = 0.12;
    ctx.strokeRect(-20, -14, 40, 28);
  }

  private drawObjectiveAndRing(ctx: CanvasRenderingContext2D, frame: PublicFrame): void {
    // 1. Center Objective (radius 3m at (0, 0))
    const objColor = this.grayscale ? '#A0A0A0' : THEME.CORE;
    ctx.strokeStyle = objColor;
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.arc(0, 0, 3.0, 0, Math.PI * 2);
    ctx.stroke();

    // Objective center marker
    ctx.fillStyle = objColor;
    ctx.beginPath();
    ctx.arc(0, 0, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 2. Shrinking Ring Boundary
    if (frame.ringRadius < 25000) {
      const ringRadiusMeters = frame.ringRadius / 1000;
      const ringColor = this.grayscale ? '#808080' : THEME.DANGER;
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 0.14;
      ctx.setLineDash([0.5, 0.25]);
      ctx.beginPath();
      ctx.arc(0, 0, ringRadiusMeters, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawActors(ctx: CanvasRenderingContext2D, frame: PublicFrame): void {
    for (const actorId of ['A', 'B'] as const) {
      const actor = frame.actors[actorId];
      const core = actor.modules.find((m: PublicModule) => m.catalogId === 'core') ?? actor.modules[0];
      if (!core) continue;

      ctx.save();
      // Actor Pose: (x/1000, y/1000), heading (2048 units = pi radians)
      ctx.translate(actor.pose.x / 1000, actor.pose.y / 1000);
      ctx.rotate((actor.pose.heading * Math.PI) / 2048);

      for (const m of actor.modules) {
        const modRelX = m.x - core.x - 1;
        const modRelY = m.y - core.y - 1;
        const size = m.catalogId === 'core' ? 2 : 1;

        drawModule(ctx, modRelX, modRelY, {
          catalogId: m.catalogId,
          status: m.status,
          phase: m.phase || 'idle',
          team: actorId,
          size,
          grayscale: this.grayscale,
          tier: this.tier,
        });
      }

      ctx.restore();
    }
  }

  private drawColliders(ctx: CanvasRenderingContext2D, frame: PublicFrame): void {
    ctx.save();
    ctx.lineWidth = 0.04;
    ctx.setLineDash([0.1, 0.1]);

    for (const actorId of ['A', 'B'] as const) {
      const actor = frame.actors[actorId];
      const core = actor.modules.find((m: PublicModule) => m.catalogId === 'core') ?? actor.modules[0];
      if (!core) continue;

      ctx.save();
      ctx.translate(actor.pose.x / 1000, actor.pose.y / 1000);
      ctx.rotate((actor.pose.heading * Math.PI) / 2048);

      // Exact collider geometry: 1m x 1m per module, 2m x 2m for core
      ctx.strokeStyle = actorId === 'A' ? '#FF00FF' : '#00FFFF';

      for (const m of actor.modules) {
        if (m.status !== 'alive') continue;
        const modRelX = m.x - core.x - 1;
        const modRelY = m.y - core.y - 1;
        const size = m.catalogId === 'core' ? 2 : 1;
        ctx.strokeRect(modRelX, modRelY, size, size);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Captures the rendered frame as a PNG data URL (for visual fixtures & tests).
   */
  public captureScreenshot(): string {
    return this.canvas.toDataURL ? this.canvas.toDataURL('image/png') : '';
  }
}
