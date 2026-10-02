import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { MatchResult, PublicFrame, CombatEvent } from '@prompt-chien/contracts';
import { ArenaRenderer, type QualityTier } from '@prompt-chien/renderer';
import { Button, Card, Badge } from './design-system.js';
import type { PrivateTraceStep } from './types.js';

interface ArenaProps {
  frames: PublicFrame[];
  result?: MatchResult | undefined;
  traces?: PrivateTraceStep[] | undefined;
  onSeekTick?: ((tick: number) => void) | undefined;
}

export const Arena: React.FC<ArenaProps> = ({
  frames,
  result,
  traces = [],
  onSeekTick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ArenaRenderer | null>(null);

  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);

  // Quality & Presentation Toggles (06_ART_UX.md / 09_QUALITY_SECURITY.md Q12)
  const [tier, setTier] = useState<QualityTier>('high');
  const [enableVfx, setEnableVfx] = useState<boolean>(true);
  const [grayscale, setGrayscale] = useState<boolean>(false);
  const [showColliders, setShowColliders] = useState<boolean>(false);
  const [showTelegraphs, setShowTelegraphs] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.6);

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const fractionRef = useRef<number>(0);

  const maxFrames = Math.max(0, frames.length - 1);
  const currentFrame = frames[currentFrameIndex];

  // Initialize and update ArenaRenderer
  useEffect(() => {
    if (!canvasRef.current) return;

    if (!rendererRef.current) {
      rendererRef.current = new ArenaRenderer({
        canvas: canvasRef.current,
        tier,
        enableVfx,
        enableAudio: !isMuted,
        grayscale,
        showColliders,
        showTelegraphs,
        volume,
      });
    }

    const renderer = rendererRef.current;
    renderer.setTier(tier);
    renderer.setVfxEnabled(enableVfx);
    renderer.setGrayscale(grayscale);
    setShowColliders(showColliders);
    renderer.setShowColliders(showColliders);
    renderer.setShowTelegraphs(showTelegraphs);
    renderer.setMuted(isMuted);
    renderer.setVolume(volume);

    // Extract all public events across frames
    const allEvents: CombatEvent[] = [];
    for (const f of frames) {
      if (f.events) {
        allEvents.push(...f.events);
      }
    }
    renderer.loadReplay(frames, allEvents);
    renderer.seek(currentFrameIndex);
  }, [frames]); // Re-load when replay frames change

  // Synchronize state changes to renderer
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setTier(tier);
    }
  }, [tier]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setVfxEnabled(enableVfx);
    }
  }, [enableVfx]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setGrayscale(grayscale);
    }
  }, [grayscale]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setShowColliders(showColliders);
    }
  }, [showColliders]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setShowTelegraphs(showTelegraphs);
    }
  }, [showTelegraphs]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setMuted(isMuted);
    }
  }, [isMuted]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setVolume(volume);
    }
  }, [volume]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.seek(currentFrameIndex);
    }
  }, [currentFrameIndex]);

  // Playback Animation Loop
  const animate = useCallback((time: number) => {
    if (isPlaying && frames.length > 0) {
      if (lastTimeRef.current) {
        fractionRef.current += (time - lastTimeRef.current) * 0.06 * speed;
        const ticks = Math.floor(fractionRef.current);
        if (ticks > 0) {
          fractionRef.current -= ticks;
          setCurrentFrameIndex(prev => {
            const next = Math.min(frames.length - 1, prev + ticks);
            if (next === frames.length - 1) {
              setIsPlaying(false);
            }
            if (rendererRef.current) {
              rendererRef.current.step(next - prev);
            }
            return next;
          });
        }
      }
      lastTimeRef.current = time;
    }
    animationRef.current = requestAnimationFrame(animate);
  }, [isPlaying, frames.length, speed]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [animate]);

  // Keyboard controls (Space: Play/Pause, Home: Rewind, ArrowLeft/Right: Step)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(p => !p);
      } else if (e.code === 'Home') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentFrameIndex(0);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentFrameIndex(p => Math.max(0, p - 1));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentFrameIndex(p => Math.min(maxFrames, p + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [maxFrames]);

  const handleSeek = (index: number) => {
    setIsPlaying(false);
    setCurrentFrameIndex(index);
    if (onSeekTick && currentFrame) {
      onSeekTick(currentFrame.boundary);
    }
  };

  const handleEventClick = (event: CombatEvent) => {
    setIsPlaying(false);
    const targetIdx = frames.findIndex(f => f.boundary >= event.tick);
    if (targetIdx !== -1) {
      setCurrentFrameIndex(targetIdx);
    }
  };

  const actorA = currentFrame?.actors.A;
  const actorB = currentFrame?.actors.B;
  const coreA = actorA?.modules.find(m => m.catalogId === 'core');
  const coreB = actorB?.modules.find(m => m.catalogId === 'core');

  // Find active blade windup or active events for quick jump buttons
  const findTickForEvent = (predicate: (f: PublicFrame) => boolean): number => {
    return frames.findIndex(predicate);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header & Telemetry */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge variant="core">Arena Vertical Slice (G2)</Badge>
          {result && (
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Kết quả: <strong>{result.winner === 'A' ? 'Đội A thắng' : result.winner === 'B' ? 'Đội B thắng' : 'Hòa'}</strong> · Lý do: <code>{result.cause}</code> · {(result.elapsedTicks / 60).toFixed(1)}s
            </span>
          )}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>
          {currentFrame ? `${(currentFrame.boundary / 60).toFixed(2)}s · Tick ${currentFrame.boundary}` : '0.00s'}
        </div>
      </div>

      {/* Main Layout: Canvas View & Controls on Left, HUD & Debrief on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Canvas & Presentation Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Canvas Container */}
          <div
            style={{
              backgroundColor: 'var(--color-arena)',
              border: '2px solid var(--color-line)',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <canvas
              ref={canvasRef}
              width={1000}
              height={700}
              style={{
                width: '100%',
                maxHeight: 560,
                display: 'block',
                filter: grayscale ? 'grayscale(100%)' : 'none',
              }}
            />
          </div>

          {/* Timeline & Playback Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button size="sm" variant={isPlaying ? 'danger' : 'primary'} onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? '⏸ Dừng' : '▶ Phát'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsPlaying(false); setCurrentFrameIndex(0); }} title="Về đầu (Home)">
              ⏮ Đầu
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsPlaying(false); setCurrentFrameIndex(p => Math.max(0, p - 1)); }} title="Tick trước (←)">
              ◀
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsPlaying(false); setCurrentFrameIndex(p => Math.min(maxFrames, p + 1)); }} title="Tick sau (→)">
              ▶
            </Button>

            <div style={{ flex: 1 }}>
              <input
                type="range"
                min={0}
                max={maxFrames}
                value={currentFrameIndex}
                onChange={e => handleSeek(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-core)', cursor: 'pointer' }}
              />
            </div>

            <select
              value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              style={{
                backgroundColor: 'var(--color-surface2)',
                border: '1px solid var(--color-line-quiet)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 12,
              }}
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1.0x</option>
              <option value={2}>2.0x</option>
              <option value={4}>4.0x</option>
            </select>
          </div>

          {/* G2 Technical Art & Quality Controls Toolbar */}
          <Card variant="surface2" style={{ padding: '8px 12px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
              {/* Quality Tier */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Chất lượng:</span>
                <select
                  value={tier}
                  onChange={e => setTier(e.target.value as QualityTier)}
                  style={{
                    backgroundColor: 'var(--color-surface1)',
                    border: '1px solid var(--color-line-quiet)',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 12,
                  }}
                >
                  <option value="high">Cao (High Tier)</option>
                  <option value="medium">Vừa (Medium Tier)</option>
                  <option value="low">Thấp (Low Tier)</option>
                </select>
              </div>

              {/* VFX Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableVfx}
                  onChange={e => setEnableVfx(e.target.checked)}
                />
                <span>VFX {enableVfx ? 'Bật' : 'Tắt (Kiểm tra Telegraph)'}</span>
              </label>

              {/* Grayscale Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={grayscale}
                  onChange={e => setGrayscale(e.target.checked)}
                />
                <span>Thang xám (Grayscale test)</span>
              </label>

              {/* Collider Overlay Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showColliders}
                  onChange={e => setShowColliders(e.target.checked)}
                />
                <span>Khung va chạm (No Collider Lie)</span>
              </label>

              {/* Telegraph Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showTelegraphs}
                  onChange={e => setShowTelegraphs(e.target.checked)}
                />
                <span>Telegraph {showTelegraphs ? 'Bật' : 'Tắt'}</span>
              </label>

              {/* Audio Volume & Mute */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Button size="sm" variant="ghost" onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? '🔇 Tắt tiếng' : '🔊 Bật tiếng'}
                </Button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  disabled={isMuted}
                  onChange={e => setVolume(Number(e.target.value))}
                  style={{ width: 60, accentColor: 'var(--color-core)' }}
                  title="Âm lượng"
                />
              </div>
            </div>
          </Card>

          {/* Quick Event Jump Buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', alignSelf: 'center' }}>Nhảy nhanh:</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const idx = findTickForEvent(f =>
                  f.actors.A.modules.some(m => m.phase === 'windup') ||
                  f.actors.B.modules.some(m => m.phase === 'windup')
                );
                if (idx !== -1) handleSeek(idx);
              }}
            >
              ⚔️ Windup Lưỡi chém (18 ticks)
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const idx = findTickForEvent(f =>
                  f.actors.A.modules.some(m => m.catalogId === 'burst' && m.phase === 'windup') ||
                  f.actors.B.modules.some(m => m.catalogId === 'burst' && m.phase === 'windup')
                );
                if (idx !== -1) handleSeek(idx);
              }}
            >
              🔫 Đường ngắm Pháo Burst
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const idx = findTickForEvent(f =>
                  f.events.some(e => e.kind === 'blocked' || e.kind === 'shieldOn')
                );
                if (idx !== -1) handleSeek(idx);
              }}
            >
              🛡️ Khiên chặn đòn
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const idx = findTickForEvent(f =>
                  f.events.some(e => e.kind === 'destroyed' || e.kind === 'detached')
                );
                if (idx !== -1) handleSeek(idx);
              }}
            >
              💥 Phá vỡ Module
            </Button>
          </div>
        </div>

        {/* Right HUD & Events Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Health & Control Telemetry */}
          <Card variant="surface1">
            <div className="panel-title" style={{ fontSize: 15, marginBottom: 10 }}>Chỉ số trên sân</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Team A */}
              <div style={{ padding: 8, backgroundColor: 'rgba(242, 123, 89, 0.1)', border: '1px solid var(--color-team-a)', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13, color: 'var(--color-team-a)' }}>
                  <span>Đội A (Mantis/Ta)</span>
                  <span>Core: {coreA?.hp ?? 0} HP</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Điểm kiểm soát: {actorA?.controlTicks ?? 0} ticks {actorA?.overheated ? '· QUÁ NHIỆT' : ''}
                </div>
              </div>

              {/* Team B */}
              <div style={{ padding: 8, backgroundColor: 'rgba(101, 200, 212, 0.1)', border: '1px solid var(--color-team-b)', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13, color: 'var(--color-team-b)' }}>
                  <span>Đội B (Đối thủ)</span>
                  <span>Core: {coreB?.hp ?? 0} HP</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Điểm kiểm soát: {actorB?.controlTicks ?? 0} ticks {actorB?.overheated ? '· QUÁ NHIỆT' : ''}
                </div>
              </div>
            </div>
          </Card>

          {/* Combat Events List */}
          <Card variant="surface1" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 280 }}>
            <div className="panel-title" style={{ fontSize: 15, marginBottom: 8 }}>Sự kiện trận đấu (Click để tua)</div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 320, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {currentFrame?.events && currentFrame.events.length > 0 ? (
                currentFrame.events.map((evt, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleEventClick(evt)}
                    style={{
                      padding: '6px 8px',
                      backgroundColor: 'var(--color-surface2)',
                      borderRadius: 4,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      <strong style={{ color: evt.actor === 'A' ? 'var(--color-team-a)' : 'var(--color-team-b)' }}>
                        {evt.actor}:
                      </strong>{' '}
                      {evt.kind} {evt.value ? `(${evt.value})` : ''}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {(evt.tick / 60).toFixed(1)}s
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>
                  Không có sự kiện mới tại tick này.
                </div>
              )}
            </div>
          </Card>

          {/* Brain Decision (Bot A) */}
          {traces && traces.length > 0 && currentFrame && (
            <Card variant="surface1">
              <div className="panel-title" style={{ fontSize: 14, marginBottom: 6 }}>Brain Decision (Bot A)</div>
              {(() => {
                const traceStep = traces.find(t => t.tick <= currentFrame.boundary);
                return traceStep ? (
                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div>State: <strong style={{ color: 'var(--color-core)' }}>{traceStep.stateId}</strong> · Rule: <code>{traceStep.ruleId}</code></div>
                    <div style={{ color: 'var(--color-text-muted)' }}>Gas: {traceStep.gas}/4096 · Fault: {traceStep.fault ? 'CÓ' : 'Không'}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Không có trace tại tick này.</div>
                );
              })()}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
