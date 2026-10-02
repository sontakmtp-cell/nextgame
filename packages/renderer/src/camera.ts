import type { Pose } from '@prompt-chien/contracts';
import type { CameraState } from './types.js';

export class PresentationCamera {
  private state: CameraState;

  constructor(viewportWidth: number = 1000, viewportHeight: number = 700) {
    this.state = {
      x: 0,
      y: 0,
      zoom: 1.0,
      viewportWidth,
      viewportHeight,
    };
  }

  public resize(width: number, height: number): void {
    this.state.viewportWidth = width;
    this.state.viewportHeight = height;
  }

  public getState(): CameraState {
    return { ...this.state };
  }

  public setPan(x: number, y: number): void {
    this.state.x = x;
    this.state.y = y;
  }

  public setZoom(zoom: number): void {
    this.state.zoom = Math.max(0.5, Math.min(3.0, zoom));
  }

  public reset(): void {
    this.state.x = 0;
    this.state.y = 0;
    this.state.zoom = 1.0;
  }

  /**
   * Fits standard 40m x 28m arena into viewport with margin
   */
  public fitArena(): void {
    this.state.x = 0;
    this.state.y = 0;
    const arenaW = 44; // 40m + 4m margin
    const arenaH = 32; // 28m + 4m margin
    const scaleX = this.state.viewportWidth / arenaW;
    const scaleY = this.state.viewportHeight / arenaH;
    // Base scale maps 25px per meter at zoom 1.0
    const baseScale = 25;
    const fitScale = Math.min(scaleX, scaleY) / baseScale;
    this.state.zoom = Math.max(0.6, Math.min(2.0, fitScale));
  }

  /**
   * Applies camera transform matrix to canvas 2D context
   */
  public applyTransform(ctx: CanvasRenderingContext2D): void {
    const cx = this.state.viewportWidth / 2;
    const cy = this.state.viewportHeight / 2;
    const scale = 25 * this.state.zoom;

    ctx.translate(cx + this.state.x * scale, cy + this.state.y * scale);
    ctx.scale(scale, -scale); // Invert Y so +Y is up in simulation coordinates
  }

  /**
   * Converts world coordinates (meters) to screen coordinates (pixels)
   */
  public worldToScreen(worldX: number, worldY: number): { screenX: number; screenY: number } {
    const cx = this.state.viewportWidth / 2;
    const cy = this.state.viewportHeight / 2;
    const scale = 25 * this.state.zoom;
    return {
      screenX: cx + (worldX + this.state.x) * scale,
      screenY: cy - (worldY + this.state.y) * scale,
    };
  }

  /**
   * Converts screen coordinates (pixels) to world coordinates (meters)
   */
  public screenToWorld(screenX: number, screenY: number): { worldX: number; worldY: number } {
    const cx = this.state.viewportWidth / 2;
    const cy = this.state.viewportHeight / 2;
    const scale = 25 * this.state.zoom;
    return {
      worldX: (screenX - cx) / scale - this.state.x,
      worldY: -(screenY - cy) / scale - this.state.y,
    };
  }

  /**
   * Linearly interpolates between two authoritative tick poses
   */
  public static lerpPose(p0: Pose, p1: Pose, alpha: number): Pose {
    const t = Math.max(0, Math.min(1, alpha));
    const x = Math.round(p0.x + (p1.x - p0.x) * t);
    const y = Math.round(p0.y + (p1.y - p0.y) * t);

    // Angle interpolation along shortest angular path (LUT 4096 = 2pi)
    let diff = (p1.heading - p0.heading) % 4096;
    if (diff > 2048) diff -= 4096;
    if (diff < -2048) diff += 4096;
    const heading = Math.round((p0.heading + diff * t + 4096) % 4096);

    return { x, y, heading };
  }
}
