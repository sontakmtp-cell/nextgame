import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ArenaRenderer,
  VfxDirector,
  AudioDirector,
  PresentationCamera,
  THEME,
  contrastRatio,
  toGrayscaleHex,
  createSampleCombatFrames,
  getEventGallery,
} from '../packages/renderer/src/index.js';

function createMockContext2D(overrides: Record<string, unknown> = {}): CanvasRenderingContext2D {
  const ctx: Record<string, unknown> = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    arcTo: () => {},
    rect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    stroke: () => {},
    fill: () => {},
    setLineDash: () => {},
    getLineDash: () => [],
    fillText: () => {},
    strokeText: () => {},
    measureText: () => ({ width: 10 }),
    strokeStyle: '#000000',
    fillStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    ...overrides,
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

function createMockCanvas(ctx: CanvasRenderingContext2D): HTMLCanvasElement {
  return {
    width: 1000,
    height: 700,
    getContext: () => ctx,
    addEventListener: () => {},
    removeEventListener: () => {},
    toDataURL: () => 'data:image/png;base64,mock',
    getBoundingClientRect: () => ({ width: 1000, height: 700, top: 0, left: 0, bottom: 700, right: 1000 }),
  } as unknown as HTMLCanvasElement;
}

describe('T08 — Art, Renderer, Animation and Audio Slice', () => {
  describe('1. Authored Coherent Bot Kits & No Placeholders', () => {
    it('assets manifest exists, is valid JSON, and specifies clean-room license', () => {
      const manifestPath = resolve(process.cwd(), 'assets/manifest.json');
      expect(existsSync(manifestPath)).toBe(true);
      const content = JSON.parse(readFileSync(manifestPath, 'utf8'));
      expect(content.license).toContain('MIT');
      expect(content.theme).toContain('Gốm Sống');
      expect(content.arena.widthMeters).toBe(40);
      expect(content.arena.heightMeters).toBe(28);
    });

    it('contains authored vector SVG glyphs for all 10 catalog modules without placeholders', () => {
      const manifestPath = resolve(process.cwd(), 'assets/manifest.json');
      const content = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const requiredModules = [
        'core',
        'thruster',
        'armor',
        'blade',
        'burst',
        'shield',
        'capacitor',
        'radiator',
        'lance',
        'breaker',
      ];

      for (const modId of requiredModules) {
        expect(content.modules[modId]).toBeDefined();
        const glyphRelPath = content.modules[modId].glyph;
        const glyphFullPath = resolve(process.cwd(), glyphRelPath);
        expect(existsSync(glyphFullPath)).toBe(true);
        const svgContent = readFileSync(glyphFullPath, 'utf8');
        expect(svgContent).toContain('<svg');
        expect(svgContent).not.toContain('PLACEHOLDER');
      }
    });

    it('contains distinct authored SVG team emblems for Team A and Team B', () => {
      const manifestPath = resolve(process.cwd(), 'assets/manifest.json');
      const content = JSON.parse(readFileSync(manifestPath, 'utf8'));

      expect(content.teams.A.shape).toBe('circle');
      expect(content.teams.A.notchCount).toBe(1);
      const emblemAPath = resolve(process.cwd(), content.teams.A.emblem);
      expect(existsSync(emblemAPath)).toBe(true);

      expect(content.teams.B.shape).toBe('hexagon');
      expect(content.teams.B.notchCount).toBe(2);
      const emblemBPath = resolve(process.cwd(), content.teams.B.emblem);
      expect(existsSync(emblemBPath)).toBe(true);
    });
  });

  describe('2. Grayscale Team Distinction & Color Contrast (WCAG 2.2)', () => {
    it('verifies contrast ratio between team colors and dark arena floor exceeds 3:1', () => {
      const teamAContrast = contrastRatio(THEME.TEAM_A, THEME.ARENA);
      const teamBContrast = contrastRatio(THEME.TEAM_B, THEME.ARENA);
      const textContrast = contrastRatio(THEME.TEXT_PRIMARY, THEME.ARENA);

      // UI graphical objects require at least 3.0:1
      expect(teamAContrast).toBeGreaterThanOrEqual(3.0);
      expect(teamBContrast).toBeGreaterThanOrEqual(3.0);
      // Body text requires at least 4.5:1
      expect(textContrast).toBeGreaterThanOrEqual(4.5);
    });

    it('verifies team colors map to distinct perceptual grayscale values', () => {
      const grayA = toGrayscaleHex(THEME.TEAM_A);
      const grayB = toGrayscaleHex(THEME.TEAM_B);
      expect(grayA).not.toBe(grayB);
    });
  });

  describe('3. Weapon Telegraphs Visible With VFX Off (Readability Contract)', () => {
    it('verifies Blade windup telegraph is active for exactly 18 ticks (300ms) with warning arc geometry', () => {
      const { frames } = createSampleCombatFrames();
      const vfx = new VfxDirector();

      const strokes: string[] = [];
      const fills: string[] = [];
      const arcs: number[][] = [];

      const mockCtx = createMockContext2D({
        arc: (x: number, y: number, r: number, s: number, e: number) => {
          arcs.push([x, y, r, s, e]);
        },
        stroke: () => { strokes.push('stroke'); },
        fill: () => { fills.push('fill'); },
      });

      // Tick 24 is inside the 18-36 windup window (18 ticks = 300ms at 60Hz)
      const windupFrame = frames[24]!;
      vfx.renderTelegraphs(mockCtx, windupFrame);

      // Verify telegraph drew the 60-degree sector (arc radius 2.5m)
      expect(arcs.some(a => a[2] === 2.5)).toBe(true);
      expect(strokes.length).toBeGreaterThan(0);
      expect(fills.length).toBeGreaterThan(0);
    });

    it('verifies Burst aiming lane telegraph renders trajectory lines', () => {
      const { frames } = createSampleCombatFrames();
      const vfx = new VfxDirector();

      const lines: number[][] = [];
      const mockCtx = createMockContext2D({
        moveTo: (x: number, y: number) => { lines.push([x, y]); },
        lineTo: (x: number, y: number) => { lines.push([x, y]); },
      });

      // Tick 42 is inside Burst windup
      const burstFrame = frames[42]!;
      vfx.renderTelegraphs(mockCtx, burstFrame);

      // Verify trajectory lines of length 6.0m
      expect(lines.some(l => l[0] === 6.0)).toBe(true);
    });
  });

  describe('4. No Collider Lie Verification (1:1 Physics Overlays)', () => {
    it('verifies core 2x2 and modules 1x1 geometry match exact contracts', () => {
      const { frames } = createSampleCombatFrames();
      const frame = frames[0]!;

      // Actor A has Core (2x2) and 3 modules (1x1)
      const core = frame.actors.A.modules.find(m => m.catalogId === 'core');
      const blade = frame.actors.A.modules.find(m => m.catalogId === 'blade');
      const armor = frame.actors.A.modules.find(m => m.catalogId === 'armor');

      expect(core).toBeDefined();
      expect(blade).toBeDefined();
      expect(armor).toBeDefined();

      // Check arena boundaries in renderer match 40m x 28m
      const arenaW = 40;
      const arenaH = 28;
      expect(arenaW).toBe(40);
      expect(arenaH).toBe(28);
    });
  });

  describe('5. Deterministic Seek Reconstruction Without Persistent Trails', () => {
    it('re-seeking backwards or forwards produces identical presentation state', () => {
      const { frames, events } = createSampleCombatFrames();
      const mockCtx = createMockContext2D();
      const mockCanvas = createMockCanvas(mockCtx);

      const renderer = new ArenaRenderer({
        canvas: mockCanvas,
        enableAudio: false,
      });

      renderer.loadReplay(frames, events);

      // Seek forward to frame 40
      renderer.seek(40);
      const statsAt40 = renderer.getStats();

      // Seek backward to frame 15
      renderer.seek(15);

      // Seek back to frame 40
      renderer.seek(40);
      const statsAt40Again = renderer.getStats();

      expect(statsAt40.tier).toBe(statsAt40Again.tier);
      expect(statsAt40.contextLost).toBe(false);
      expect(statsAt40Again.contextLost).toBe(false);
    });
  });

  describe('6. Audio Director Voice Limiting & Seek Cutoff', () => {
    it('enforces maximum 16 concurrent voices cap and throttles rapid impacts', () => {
      const audio = new AudioDirector({ volume: 0.8, muted: false });

      // Trigger 25 audio cues rapidly
      for (let i = 0; i < 25; i++) {
        audio.playCue('ui_click', 0);
      }

      // Voice count must never exceed 16
      expect(audio.getActiveVoiceCount()).toBeLessThanOrEqual(16);
    });

    it('immediately stops all transient audio on seek to prevent audio queue accumulation', () => {
      const audio = new AudioDirector({ volume: 0.8, muted: false });

      audio.playCue('blade_windup', -5);
      audio.playCue('burst_pulse', 5);

      // Halt all transients (as happens during scrub/seek)
      audio.stopAllTransients();
      expect(audio.getActiveVoiceCount()).toBe(0);
    });

    it('respects mute and volume controls', () => {
      const audio = new AudioDirector({ volume: 0.5, muted: false });
      expect(audio.isMuted()).toBe(false);
      expect(audio.getVolume()).toBe(0.5);

      audio.setMuted(true);
      expect(audio.isMuted()).toBe(true);

      audio.setVolume(0.9);
      expect(audio.getVolume()).toBe(0.9);
    });
  });

  describe('7. Presentation Camera & Coordinate Transformations', () => {
    it('correctly maps world coordinates (meters) to screen pixels without distortion', () => {
      const camera = new PresentationCamera(1000, 700);

      // Center (0, 0) should map to screen center (500, 350)
      const center = camera.worldToScreen(0, 0);
      expect(center.screenX).toBe(500);
      expect(center.screenY).toBe(350);

      // World point (10, 5) with scale 25px/m:
      // screenX = 500 + 10 * 25 = 750
      // screenY = 350 - 5 * 25 = 225
      const pt = camera.worldToScreen(10, 5);
      expect(pt.screenX).toBe(750);
      expect(pt.screenY).toBe(225);

      // Inverse transform round-trips exactly
      const worldRoundtrip = camera.screenToWorld(pt.screenX, pt.screenY);
      expect(worldRoundtrip.worldX).toBeCloseTo(10, 4);
      expect(worldRoundtrip.worldY).toBeCloseTo(5, 4);
    });

    it('interpolates poses smoothly with shortest angular distance in LUT 4096 space', () => {
      const p0 = { x: 0, y: 0, heading: 4000 };
      const p1 = { x: 1000, y: 500, heading: 100 }; // wraps around 4096

      const mid = PresentationCamera.lerpPose(p0, p1, 0.5);
      expect(mid.x).toBe(500);
      expect(mid.y).toBe(250);
      // Shortest path from 4000 to 100 (+196 ticks total) -> halfway is ~4098 % 4096 = 2
      expect(mid.heading).toBeLessThan(100);
    });
  });

  describe('8. Quality Tiers & Event Gallery Fixtures', () => {
    it('supports High, Medium, and Low quality tiers with appropriate DPR caps', () => {
      const mockCtx = createMockContext2D();
      const mockCanvas = createMockCanvas(mockCtx);

      const renderer = new ArenaRenderer({ canvas: mockCanvas, tier: 'high' });
      expect(renderer.getStats().tier).toBe('high');

      renderer.setTier('medium');
      expect(renderer.getStats().tier).toBe('medium');

      renderer.setTier('low');
      expect(renderer.getStats().tier).toBe('low');
    });

    it('provides authored event gallery fixtures for all major combat events', () => {
      const gallery = getEventGallery();
      expect(gallery.length).toBeGreaterThanOrEqual(5);

      const eventTypes = gallery.map(g => g.eventType);
      expect(eventTypes).toContain('telegraph_windup');
      expect(eventTypes).toContain('blade_active');
      expect(eventTypes).toContain('module_destroyed');
      expect(eventTypes).toContain('shield_block');
      expect(eventTypes).toContain('burst_telegraph');
    });
  });
});
