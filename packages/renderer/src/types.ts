import type { PublicFrame, CombatEvent } from '@prompt-chien/contracts';

export type QualityTier = 'high' | 'medium' | 'low';

export type RendererMode = 'practice' | 'experiment' | 'official' | 'replay';

export type AudioCueType =
  | 'ui_click'
  | 'ui_confirm'
  | 'ui_alert'
  | 'ui_submit'
  | 'blade_windup'
  | 'blade_active'
  | 'blade_hit'
  | 'burst_pulse'
  | 'shield_raise'
  | 'shield_block'
  | 'module_break'
  | 'core_break'
  | 'core_critical'
  | 'arena_ambient';

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  tier?: QualityTier;
  enableVfx?: boolean;
  enableAudio?: boolean;
  grayscale?: boolean;
  showColliders?: boolean;
  showTelegraphs?: boolean;
  dprCap?: number;
  volume?: number;
  reducedSensory?: boolean;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface RenderStats {
  frameTimeMs: number;
  fps: number;
  drawCalls: number;
  activeVfxCount: number;
  audioVoiceCount: number;
  contextLost: boolean;
  tier: QualityTier;
}

export interface EventGalleryItem {
  id: string;
  name: string;
  description: string;
  frameIndex: number;
  tick: number;
  eventType: string;
  actorId: 'A' | 'B';
  frames: PublicFrame[];
  events: CombatEvent[];
}
