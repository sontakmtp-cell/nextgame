import { useEffect, useMemo, useRef, useState } from 'react';
import { ArenaRenderer, ArenaAudio } from '@prompt-chien/renderer';
import type { ArenaOptions, Quality } from '@prompt-chien/renderer';
import type { CombatEvent } from '@prompt-chien/contracts';
import type { LocalReplay } from './protocol.js';

const captions: Record<string, string> = {
  activation: 'Lên nòng vũ khí',
  intentRejected: 'Lệnh bị từ chối',
  shot: 'Bắn loạt Burst',
  hit: 'Trúng đòn module',
  blocked: 'Khiên phòng thủ chặn',
  destroyed: 'Module bị phá hủy',
  detached: 'Nhánh mất kết nối',
  shieldOn: 'Kích hoạt khiên',
  shieldOff: 'Tắt khiên năng lượng',
  overheated: 'Cảnh báo quá nhiệt',
  cooled: 'Hạ nhiệt ổn định',
  collisionFallback: 'Giữ khoảng cách an toàn',
  ringNotice: 'Vòng bo chuẩn bị thu hẹp',
  ringDamage: 'Lõi ngoài vòng bo',
  result: 'Trận chiến kết thúc',
};

function readPreferences(): { quality: Quality; vfx: boolean; grayscale: boolean; volume: number } {
  try {
    const raw = localStorage.getItem('prompt-chien-presentation') ?? '{}';
    if (raw.length > 1024) throw new Error('PREFERENCE_CAP');
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      quality: p.quality === 'low' || p.quality === 'medium' ? p.quality : 'high',
      vfx: p.vfx !== false,
      grayscale: p.grayscale === true,
      volume: typeof p.volume === 'number' ? Math.max(0, Math.min(1, p.volume)) : 0.6,
    };
  } catch {
    return { quality: 'high', vfx: true, grayscale: false, volume: 0.6 };
  }
}

export default function Arena({ replay, onHypothesis }: { replay: LocalReplay; onHypothesis: (event: CombatEvent) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<ArenaRenderer | null>(null);
  const audio = useRef(new ArenaAudio());
  const position = useRef(0);
  const playing = useRef(false);
  const speedRef = useRef(1);
  const slider = useRef<HTMLInputElement>(null);

  const [preferences] = useState(readPreferences);
  const [tick, setTick] = useState(0);
  const [play, setPlay] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState<Quality>(preferences.quality);
  const [vfx, setVfx] = useState(preferences.vfx);
  const [grayscale, setGrayscale] = useState(preferences.grayscale);
  const [mute, setMute] = useState(true);
  const [volume, setVolume] = useState(preferences.volume);
  const [context, setContext] = useState('');
  const [tab, setTab] = useState('Sự kiện');
  const [reduced, setReduced] = useState(matchMedia('(prefers-reduced-motion: reduce)').matches);

  const options = useRef<ArenaOptions>({ quality, vfx, reducedMotion: reduced, grayscale });
  options.current = { quality, vfx, reducedMotion: reduced, grayscale };
  speedRef.current = speed;

  useEffect(() => {
    try {
      localStorage.setItem('prompt-chien-presentation', JSON.stringify({ quality, vfx, grayscale, volume }));
    } catch {}
  }, [quality, vfx, grayscale, volume]);

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(query.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);

  const events = useMemo(() => replay.frames.flatMap((f) => f.events), [replay]);

  const seek = (target: number) => {
    position.current = Math.max(0, Math.min(replay.frames.length - 1, target));
    playing.current = false;
    setPlay(false);
    setTick(Math.floor(position.current));
    if (slider.current) slider.current.value = String(position.current);
    audio.current.stop(Math.floor(position.current));
    renderer.current?.render(replay.frames, position.current, options.current);
  };

  useEffect(() => {
    audio.current = new ArenaAudio();
    position.current = 0;
    playing.current = false;
    setTick(0);
    setPlay(false);
    setMute(true);

    let disposed = false;
    let raf = 0;
    let last = 0;
    let lastHud = 0;

    const view = new ArenaRenderer(host.current!, (lost) => {
      playing.current = false;
      setPlay(false);
      audio.current.stop(Math.floor(position.current));
      setContext(
        lost
          ? 'Mất kết nối đồ hoạ. Đã dừng tại tick hiện tại; đang khôi phục…'
          : 'Đồ hoạ đã khôi phục. Tick được giữ; bấm Phát để tiếp tục.'
      );
      if (!lost) view.render(replay.frames, position.current, options.current);
    });

    void view
      .init()
      .then(() => {
        if (disposed) {
          view.destroy();
          return;
        }
        renderer.current = view;
        view.render(replay.frames, 0, options.current);
      })
      .catch((error) => {
        setContext(`Không mở được WebGL: ${String(error)}. Kết quả, timeline và tóm tắt DOM vẫn xem được.`);
      });

    const animate = (time: number) => {
      if (last && playing.current && !document.hidden) {
        position.current = Math.min(
          replay.frames.length - 1,
          position.current + Math.min(time - last, 100) * 0.06 * speedRef.current
        );
        renderer.current?.render(replay.frames, position.current, options.current);
        if (slider.current) slider.current.value = String(Math.floor(position.current));
        audio.current.play(replay.frames, position.current, speedRef.current);

        if (time - lastHud > 100) {
          setTick(Math.floor(position.current));
          lastHud = time;
        }
        if (position.current >= replay.frames.length - 1) {
          playing.current = false;
          setPlay(false);
          setTick(replay.frames.length - 1);
          audio.current.stop(replay.frames.length - 1);
        }
      }
      last = time;
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    const visibility = () => {
      if (document.hidden) {
        playing.current = false;
        setPlay(false);
        audio.current.stop(Math.floor(position.current));
      }
    };
    document.addEventListener('visibilitychange', visibility);

    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches('input,textarea,select,button')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        playing.current = !playing.current;
        setPlay(playing.current);
        if (!playing.current) audio.current.stop(Math.floor(position.current));
      }
      if (event.code === 'Home') {
        event.preventDefault();
        seek(0);
      }
      if (event.code === 'ArrowRight') {
        event.preventDefault();
        seek(position.current + 1);
      }
      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        seek(position.current - 1);
      }
    };
    window.addEventListener('keydown', key);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('keydown', key);
      audio.current.close();
      if (renderer.current) {
        renderer.current.destroy();
        renderer.current = null;
      }
    };
  }, [replay]);

  useEffect(() => {
    renderer.current?.render(replay.frames, position.current, options.current);
  }, [quality, vfx, grayscale, reduced, replay]);

  const frame = replay.frames[tick]!;
  const own = replay.owner.resources[tick]!;
  const trace = [...replay.owner.traces].reverse().find((t) => t.tick < tick);
  const rulePointer = trace ? replay.owner.compiled.sourceMap[`${trace.stateId}/${trace.ruleId}`] : null;
  const recent = events.filter((e) => e.tick < tick).slice(-12);
  const turningPoints = events.filter((e) => ['destroyed', 'overheated', 'ringNotice'].includes(e.kind)).slice(0, 3);

  const maxEnergy = 1000 + replay.source.body.modules.filter((m) => m.catalogId === 'capacitor').length * 250;
  const winnerIsA = replay.result.winner === 'A';
  const winnerIsB = replay.result.winner === 'B';

  return (
    <section className="arena-layout">
      <div className="arena-primary">
        <div className="arena-top">
          <div>
            <span className="eyebrow">TRẬN ĐÃ TÍNH · PHÁT LẠI</span>
            <span className="subtle" style={{ marginLeft: '12px' }}>
              Mô phỏng 60 Hz · Quyết định 10 Hz
            </span>
          </div>
          <div className="mono" style={{ background: 'var(--surface)', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--line-quiet)' }}>
            {(tick / 60).toFixed(2)}s / {(replay.result.elapsedTicks / 60).toFixed(2)}s
          </div>
        </div>

        <div className="arena-host" ref={host} />
        {context && (
          <p role="status" className="notice" style={{ marginTop: '12px' }}>
            {context}
          </p>
        )}

        <div className="team-strip">
          {(['A', 'B'] as const).map((id) => {
            const actor = frame.actors[id];
            const core = actor.modules.find((m) => m.catalogId === 'core');
            const hp = core ? core.hp : 0;
            const isWinner = replay.result.winner === id;

            return (
              <div key={id} className={`team-${id}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>
                    {id === 'A' ? '●' : '⬡'} Đội {id} · {id === 'A' ? replay.source.name : 'Đối thủ'}
                  </strong>
                  {isWinner && (
                    <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      CHIẾN THẮNG
                    </span>
                  )}
                </div>
                <span>
                  Core {hp} HP · vùng {actor.controlTicks} ticks
                  {actor.overheated ? ' · QUÁ NHIỆT' : ''}
                </span>
              </div>
            );
          })}
        </div>

        <label className="timeline-label" htmlFor="timeline">
          Timeline · tick {tick} · vùng {frame.controlOwner} · vòng bo {(frame.ringRadius / 1000).toFixed(2)} u
        </label>
        <input
          ref={slider}
          id="timeline"
          type="range"
          min="0"
          max={replay.frames.length - 1}
          defaultValue="0"
          onChange={(e) => seek(Number(e.target.value))}
        />

        <div className="controls">
          <button
            className={play ? 'primary' : ''}
            onClick={() => {
              if (position.current >= replay.frames.length - 1) seek(0);
              playing.current = !playing.current;
              setPlay(playing.current);
              audio.current.stop(Math.floor(position.current));
            }}
          >
            {play ? 'Dừng' : 'Phát'}
          </button>
          <button onClick={() => seek(0)}>Về đầu</button>
          <button aria-label="Lùi một tick" onClick={() => seek(position.current - 1)}>
            −1 tick
          </button>
          <button aria-label="Tiến một tick" onClick={() => seek(position.current + 1)}>
            +1 tick
          </button>

          <label>
            Tốc độ
            <select
              value={speed}
              onChange={(e) => {
                setSpeed(Number(e.target.value));
                audio.current.stop(Math.floor(position.current));
              }}
            >
              <option value=".5">0.5×</option>
              <option value="1">1×</option>
              <option value="2">2×</option>
              <option value="4">4×</option>
            </select>
          </label>

          <label>
            Chất lượng
            <select value={quality} onChange={(e) => setQuality(e.target.value as Quality)}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>

          <label className="check">
            <input type="checkbox" checked={vfx} onChange={(e) => setVfx(e.target.checked)} />
            VFX
          </label>
          <label className="check">
            <input type="checkbox" checked={grayscale} onChange={(e) => setGrayscale(e.target.checked)} />
            Thang xám
          </label>

          <button
            aria-pressed={!mute}
            onClick={() => {
              if (!mute) {
                setMute(true);
                audio.current.volume(0);
                audio.current.stop(Math.floor(position.current));
                return;
              }
              void audio.current
                .unlock()
                .then(() => {
                  setMute(false);
                  audio.current.volume(volume);
                  audio.current.stop(Math.floor(position.current));
                })
                .catch((error) => setContext(`Âm thanh chưa tải: ${String(error)}. Có thể thử lại.`));
            }}
          >
            {mute ? 'Bật âm thanh' : 'Tắt âm thanh'}
          </button>

          <label>
            Âm lượng
            <input
              type="range"
              min="0"
              max="1"
              step=".05"
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                if (!mute) audio.current.volume(v);
              }}
            />
          </label>
        </div>

        <p className="subtle">
          Space: phát/dừng · Home: về đầu · ←/→: từng tick. Telegraph vẫn hiện khi tắt VFX. Âm dày tắt ở 2×/4×.
        </p>
      </div>

      <aside className="panel telemetry">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <p className="eyebrow">DEBRIEF / LOCAL</p>
            <h2>{replay.result.winner === 'draw' ? 'Hai bot hòa' : `Đội ${replay.result.winner} thắng`}</h2>
          </div>
          <div
            className="telemetry-score-badge"
            style={{
              padding: '6px 10px',
              fontWeight: 700,
              background: winnerIsA ? 'var(--team-a-soft)' : winnerIsB ? 'var(--team-b-soft)' : 'rgba(255,255,255,0.06)',
              color: winnerIsA ? 'var(--team-a)' : winnerIsB ? 'var(--team-b)' : 'var(--text-muted)',
              border: '1px solid var(--line-quiet)',
            }}
          >
            A {replay.result.scores.A} : {replay.result.scores.B} B
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {replay.result.cause} · điểm A {replay.result.scores.A} / B {replay.result.scores.B}
        </p>

        <div className="resource">
          <label>
            Energy chủ bot A <span>{own.energy}</span>
          </label>
          <meter min="0" max={maxEnergy} value={own.energy} />
        </div>

        <div className="resource">
          <label>
            Heat chủ bot A <span>{own.heat} / 1000</span>
          </label>
          <meter min="0" max="1000" value={own.heat} />
        </div>

        <div className="subtabs">
          {['Sự kiện', 'Brain trace', 'FX gallery'].map((name) => (
            <button key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>
              {name}
            </button>
          ))}
        </div>

        {tab === 'Sự kiện' && (
          <ol className="event-list">
            {recent.map((e, i) => (
              <li key={i}>
                <button onClick={() => seek(e.tick + 1)}>
                  <span className="mono">{e.tick}</span> {e.actor} · {captions[e.kind]} {e.value > 0 ? e.value : ''}
                </button>
              </li>
            ))}
            {recent.length === 0 && <li style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '8px' }}>Chưa có sự kiện tại mốc này.</li>}
          </ol>
        )}

        {tab === 'Brain trace' && (
          <div>
            <p className="subtle">Chỉ Brain A của bản local. Dữ liệu này không đi vào renderer/public replay.</p>
            {trace ? (
              <>
                <p className="mono" style={{ color: 'var(--gold)', margin: '8px 0 4px' }}>
                  Tick {trace.tick} · {trace.stateId}/{trace.ruleId ?? 'no-match'} · gas {trace.gas}
                </p>
                <p className="mono" style={{ color: 'var(--text-secondary)' }}>
                  {rulePointer ?? 'Không khớp luật'} {trace.fault ?? ''}
                </p>
                <pre>{JSON.stringify({ observations: trace.observationsUsed, intent: trace.intent, rejections: trace.rejections }, null, 2)}</pre>
              </>
            ) : (
              <p className="subtle">Phát hoặc tua qua decision đầu tiên để xem trace.</p>
            )}
          </div>
        )}

        {tab === 'FX gallery' && (
          <div>
            <p className="subtle">Gallery từ sự kiện thực của replay này.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
              {[...new Set(events.map((e) => e.kind))].map((kind) => {
                const event = events.find((e) => e.kind === kind)!;
                return (
                  <button key={kind} onClick={() => seek(event.tick + 1)}>
                    {captions[kind]} · tick {event.tick}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <hr />
        <h3>Bước ngoặt → giả thuyết</h3>
        {turningPoints.length ? (
          turningPoints.map((event, i) => (
            <div className="turning-point" key={i}>
              <button onClick={() => seek(event.tick + 1)}>
                {captions[event.kind]} · {event.actor} · tick {event.tick}
              </button>
              <button className="link-button" onClick={() => onHypothesis(event)}>
                Tạo giả thuyết để thử
              </button>
            </div>
          ))
        ) : (
          <p className="subtle">Chưa có mất module/quá nhiệt/ring notice; xem sự kiện trúng đòn.</p>
        )}

        <details>
          <summary>Bindings và hash</summary>
          <p className="mono wrap" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Scenario {replay.manifest.scenarioId} · seed {replay.manifest.seed}
            <br />
            Package A {replay.manifest.packageHashes.A}
            <br />
            Sim {replay.simulationHash}
            <br />
            Public replay {replay.publicReplayHash}
          </p>
        </details>
      </aside>
    </section>
  );
}
