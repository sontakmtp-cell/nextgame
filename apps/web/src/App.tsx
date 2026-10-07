import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { BotDefinition, CatalogEntry, CombatEvent, Diagnostic, InlineRule } from '@prompt-chien/contracts';
import type { Comparison, LocalReplay, Request, Response, Validation } from './protocol.js';
import { clone, diffSummary, editModule, newModule, occlusions } from './model.js';
import { listDrafts, revisions, saveDraft } from './drafts.js';
import type { Draft } from './drafts.js';
import N8nCanvas from './N8nCanvas.js';
import NodeLibrary from './NodeLibrary.js';
import { conditionSummary, insertLibraryNode, nodeLibrary } from './brain-library.js';
import type { LibraryNode } from './brain-library.js';
import { presentationUrl, readPresentationMode } from './presentation.js';
import './presentation.css';

const Arena = lazy(() => import('./Arena.js'));

const labels: Record<string, string> = {
  core: 'Lõi',
  thruster: 'Động cơ',
  armor: 'Giáp',
  blade: 'Blade',
  burst: 'Burst',
  shield: 'Khiên',
  radiator: 'Tản nhiệt',
  capacitor: 'Tụ năng lượng',
};

const json = (value: unknown) => JSON.stringify(value, null, 2);

function download(name: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([json(data)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [view, setView] = useState('Workshop');
  const [presentation, setPresentation] = useState(() => readPresentationMode(window.location.href));
  const [bot, setBot] = useState<BotDefinition | null>(null);
  const [templates, setTemplates] = useState<BotDefinition[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [cards, setCards] = useState<{ name: string; goal: string; weakness: string }[]>([]);

  const [past, setPast] = useState<BotDefinition[]>([]);
  const [future, setFuture] = useState<BotDefinition[]>([]);
  const [selected, setSelected] = useState('');
  const [cell, setCell] = useState({ x: 7, y: 5 });
  const [palette, setPalette] = useState('armor');

  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Đang mở Workshop…');

  const [replay, setReplay] = useState<LocalReplay | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [opponent, setOpponent] = useState(2);
  const [count, setCount] = useState<1 | 3 | 10>(3);
  const [baseline, setBaseline] = useState<BotDefinition | null>(null);

  const [draftId, setDraftId] = useState<string>(crypto.randomUUID());
  const [revision, setRevision] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [history, setHistory] = useState<Draft[]>([]);
  const [stored, setStored] = useState('');
  const [saving, setSaving] = useState(false);

  const [hypothesis, setHypothesis] = useState('Né telegraph rồi áp sát sẽ giảm số đòn phải nhận.');
  const [weakness, setWeakness] = useState('Nhánh ngoài dễ bị phá; kiểm tra đường bắn và vùng trung tâm.');
  const [parentHash, setParentHash] = useState<string | null>(null);

  const [uiSound, setUiSound] = useState(false);
  const [uiVolume, setUiVolume] = useState(() => {
    try {
      const value = Number(localStorage.getItem('prompt-chien-ui-volume') ?? '.4');
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.4;
    } catch {
      return 0.4;
    }
  });
  const uiAudio = useRef<HTMLAudioElement | null>(null);

  const cue = (kind: string) => {
    if (!uiSound) return;
    uiAudio.current ??= new Audio();
    uiAudio.current.src = `/assets/${kind}.wav`;
    uiAudio.current.volume = uiVolume * 0.3;
    void uiAudio.current.play().catch(() => {});
  };

  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('button')) cue('ui');
    };
    document.addEventListener('click', click);
    try {
      localStorage.setItem('prompt-chien-ui-volume', String(uiVolume));
    } catch {}
    return () => {
      document.removeEventListener('click', click);
      uiAudio.current?.pause();
    };
  }, [uiSound, uiVolume]);

  useEffect(() => {
    if (diagnostic) cue('overheated');
    else if (status.startsWith('Đã lưu') || status.includes('hợp lệ')) cue('result');
  }, [diagnostic, status]);

  const [importText, setImportText] = useState('');
  const [importDirty, setImportDirty] = useState(false);
  const [staged, setStaged] = useState<BotDefinition | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [stateIndex, setStateIndex] = useState(0);
  const [ruleIndex, setRuleIndex] = useState(0);
  const [ruleText, setRuleText] = useState('');
  const [ruleDirty, setRuleDirty] = useState(false);
  const [showNodeLibrary, setShowNodeLibrary] = useState(false);

  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  const active = useRef<Request | null>(null);
  const applyId = useRef(0);
  const applyBase = useRef('');
  const current = useRef(bot);
  const loaded = useRef(false);
  const rootCell = useRef<HTMLDivElement>(null);
  current.current = bot;

  const change = (next: BotDefinition) => {
    if (current.current) {
      setPast((p) => [...p.slice(-49), clone(current.current!)]);
      setFuture([]);
    }
    setBot(clone(next));
    setValidation(null);
    setDiagnostic(null);
  };

  const undo = () => {
    if (!bot || !past.length) return;
    setFuture((f) => [clone(bot), ...f]);
    setBot(clone(past.at(-1)!));
    setPast((p) => p.slice(0, -1));
    setValidation(null);
  };

  const redo = () => {
    if (!bot || !future.length) return;
    setPast((p) => [...p, clone(bot)]);
    setBot(clone(future[0]!));
    setFuture((f) => f.slice(1));
    setValidation(null);
  };

  const loadDraft = (draft: Draft) => {
    setBot(clone(draft.definition));
    setBaseline(clone(draft.definition));
    setDraftId(draft.id);
    setRevision(draft.revision);
    setHypothesis(draft.hypothesis);
    setWeakness(draft.weakness);
    setParentHash(draft.parentHash);
    setStored(
      json({
        bot: draft.definition,
        hypothesis: draft.hypothesis,
        weakness: draft.weakness,
        parentHash: draft.parentHash,
      })
    );
    setPast([]);
    setFuture([]);
    setImportDirty(false);
    setRuleDirty(false);
    setValidation(null);
  };

  const createWorker = () => {
    worker.current?.terminate();
    const next = new Worker(new URL('./local.worker.ts', import.meta.url), { type: 'module' });
    worker.current = next;

    next.onerror = (event) => {
      setBusy(false);
      setStatus('Worker bị dừng. Bản nháp vẫn giữ; thử lại cùng đầu vào hoặc hủy job.');
      setDiagnostic({ code: 'WORKER_CRASH', pointer: '', message: event.message || 'Không có kết quả trận.' });
    };

    next.onmessage = ({ data }: MessageEvent<Response>) => {
      if (data.kind === 'init') {
        setTemplates(data.templates);
        setCatalog(data.catalog);
        setCards(data.cards);
        if (!loaded.current) {
          loaded.current = true;
          void listDrafts()
            .then((rows) => {
              setDrafts(rows);
              if (rows[0]) loadDraft(rows[0]);
              else {
                setBot(clone(data.templates[0]!));
                setBaseline(clone(data.templates[0]!));
              }
              setStatus('Chọn module, chỉnh Brain qua n8n Graph, rồi kiểm tra và thử trận.');
            })
            .catch((error) => {
              setBot(clone(data.templates[0]!));
              setBaseline(clone(data.templates[0]!));
              setStatus(`IndexedDB chưa mở được: ${String(error)}. Sửa và export JSON để giữ bản nháp.`);
            });
        }
        return;
      }

      if (data.id !== active.current?.id) return;

      if (data.kind === 'progress') {
        setStatus(`Thử A/B · ${data.done}/${data.total} legs · cùng scenario, cả hai slot`);
        return;
      }

      setBusy(false);

      if (data.kind === 'error') {
        setDiagnostic(data.diagnostic);
        setStatus(`Kiểm tra/job thất bại: ${data.diagnostic.code}. Sửa theo pointer hoặc thử lại.`);
        return;
      }

      if (data.kind === 'validate') {
        if (data.id === applyId.current && applyBase.current !== json(current.current)) {
          setDiagnostic({
            code: 'STALE_DRAFT',
            pointer: '/',
            message: 'Bot đã đổi trong lúc kiểm tra. JSON và bản đang sửa đều được giữ; áp dụng lại trên bản mới.',
          });
          return;
        }
        if (data.id === applyId.current) {
          change(data.bot);
          setImportDirty(false);
          setRuleDirty(false);
          setShowImport(false);
          setStaged(null);
        }
        if (data.id === applyId.current || (active.current?.kind === 'validate' && active.current.text === json(current.current))) {
          setValidation(data.validation);
          setDiagnostic(null);
          setStatus('Body và Brain hợp lệ cho local. Hash khóa đúng dữ liệu đã kiểm tra.');
        } else {
          setStatus('Kiểm tra thuộc bản cũ. Kiểm tra lại sau khi sửa.');
        }
        return;
      }

      setReplay(data.replay);
      setComparison(data.comparison);
      setDiagnostic(null);
      setStatus(
        data.comparison
          ? 'A/B đã tính. Đọc chênh lệch và trace; chưa có kết luận thống kê.'
          : 'Trận local đã tính — phát lại.'
      );
      setView('Arena');
    };

    next.postMessage({ id: 0, kind: 'init' } satisfies Request);
  };

  useEffect(() => {
    createWorker();
    return () => worker.current?.terminate();
  }, []);

  useEffect(() => {
    if (bot && !importDirty) setImportText(json(bot));
  }, [bot, importDirty]);

  const rule = bot?.brain.states[stateIndex]?.rules[ruleIndex];

  useEffect(() => {
    if (bot && !bot.brain.states[stateIndex]) setStateIndex(0);
    if (bot && !bot.brain.states[stateIndex]?.rules[ruleIndex]) setRuleIndex(0);
  }, [bot, stateIndex, ruleIndex]);

  useEffect(() => {
    if (!ruleDirty) setRuleText(json(rule ?? {}));
  }, [rule, ruleDirty]);

  useEffect(() => {
    void revisions(draftId).then(setHistory).catch(() => setHistory([]));
  }, [draftId, revision]);

  const dirty =
    !!bot &&
    (json({ bot, hypothesis, weakness, parentHash }) !== stored || importDirty || ruleDirty);
  const pending = importDirty || ruleDirty;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches('input,textarea,select')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [past, future, bot]);

  const send = (request: Request, apply = false) => {
    if (busy) return;
    active.current = request;
    applyId.current = apply ? request.id : 0;
    applyBase.current = json(current.current);
    setBusy(true);
    setDiagnostic(null);
    setStatus(
      request.kind === 'validate' || request.kind === 'rule'
        ? 'Đang kiểm tra Body và biên dịch Brain…'
        : 'Đang tính trong worker. Có thể hủy; draft vẫn giữ.'
    );
    worker.current?.postMessage(request);
  };

  const save = async (fork = false) => {
    if (!bot || saving) return;
    if (pending) {
      setStatus('Còn JSON chưa áp dụng. Áp dụng hoặc bỏ JSON trước khi lưu revision.');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveDraft(
        {
          id: fork ? crypto.randomUUID() : draftId,
          definition: clone(bot),
          hypothesis,
          weakness,
          parentHash,
        },
        fork ? 0 : revision
      );
      setDraftId(saved.id);
      setRevision(saved.revision);
      setStored(json({ bot, hypothesis, weakness, parentHash }));
      setDrafts(await listDrafts());
      setStatus(`Đã lưu revision ${saved.revision} trên máy này · local/unofficial.`);
      setDiagnostic(null);
    } catch (error) {
      setStatus(String(error));
      setDiagnostic({ code: 'DRAFT_SAVE_FAILED', pointer: '', message: String(error) });
    } finally {
      setSaving(false);
    }
  };

  if (!bot) {
    return (
      <main className="loading">
        <p className="eyebrow">PROMPT CHIẾN / CYBER RETRO</p>
        <h1>Mở xưởng trí tuệ</h1>
        <p role="status">{status}</p>
        {diagnostic && <button onClick={createWorker}>Thử mở lại</button>}
      </main>
    );
  }

  const selectedModule =
    bot.body.modules.find((m) => m.id === selected) ??
    bot.body.modules.find(
      (m) =>
        cell.x >= m.cell.x &&
        cell.x < m.cell.x + (m.catalogId === 'core' ? 2 : 1) &&
        cell.y >= m.cell.y &&
        cell.y < m.cell.y + (m.catalogId === 'core' ? 2 : 1)
    );
  const cost = bot.body.modules.reduce(
    (sum, m) => sum + (catalog.find((c) => c.id === m.catalogId)?.cost ?? 0),
    0
  );
  const mass = bot.body.modules.reduce(
    (sum, m) => sum + (catalog.find((c) => c.id === m.catalogId)?.mass ?? 0),
    0
  );
  const warnings = occlusions(bot);
  const card = cards.find((c) => bot.name.startsWith(c.name));

  const chooseTemplate = (template: BotDefinition, play = false) => {
    if (busy || pending) return;
    const next = clone(template), info = cards.find(c => c.name === template.name);
    change(next);
    setDraftId(crypto.randomUUID());
    setRevision(0);
    setStored('');
    setParentHash(null);
    setBaseline(clone(next));
    setHypothesis(info?.goal ?? 'Thử lối đánh của bot mẫu.');
    setWeakness(info?.weakness ?? 'Đánh thử để tìm điểm yếu.');
    setStateIndex(0);
    setRuleIndex(0);
    setSelected('');
    setReplay(null);
    setComparison(null);
    setView(play ? 'Arena' : 'Workshop');
    setStatus(`Đã chọn ${template.name}. Đây là bản mới để bạn chơi và chỉnh sửa.`);
    if (play) send({ id: ++seq.current, kind: 'practice', text: json(next), opponent });
  };

  const addLibraryNode = (node: LibraryNode) => {
    if (busy || pending) return;
    const added = insertLibraryNode(bot, stateIndex, node);
    change(added.bot);
    setRuleIndex(added.ruleIndex);
    setShowNodeLibrary(false);
    send({ id: ++seq.current, kind: 'validate', text: json(added.bot) });
  };

  const pickCell = (x: number, y: number) => {
    setCell({ x, y });
    const m = bot.body.modules.find(
      (m) =>
        x >= m.cell.x &&
        x < m.cell.x + (m.catalogId === 'core' ? 2 : 1) &&
        y >= m.cell.y &&
        y < m.cell.y + (m.catalogId === 'core' ? 2 : 1)
    );
    setSelected(m?.id ?? '');
  };

  const moveCell = (dx: number, dy: number) => {
    const x = Math.max(0, Math.min(11, cell.x + dx));
    const y = Math.max(0, Math.min(11, cell.y + dy));
    pickCell(x, y);
    rootCell.current?.querySelector<HTMLButtonElement>(`[data-cell="${x},${y}"]`)?.focus();
  };

  const addState = () => {
    const next = clone(bot);
    let n = 1;
    while (next.brain.states.some((s) => s.id === `state${n}`)) n++;
    next.brain.states.push({ id: `state${n}`, rules: [] });
    change(next);
    setStateIndex(next.brain.states.length - 1);
    setRuleIndex(0);
  };

  const addRule = () => {
    const next = clone(bot);
    const state = next.brain.states[stateIndex]!;
    let n = 1;
    while (state.rules.some((r) => r.id === `rule${n}`)) n++;
    state.rules.push({
      id: `rule${n}`,
      when: { kind: 'bool', value: true },
      intent: {
        thrust: { forward: { kind: 'const', value: 0 }, strafe: { kind: 'const', value: 0 } },
        turn: { kind: 'const', value: 0 },
        modules: [],
      },
    });
    change(next);
    setRuleIndex(state.rules.length - 1);
  };

  const adjust = (field: 'forward' | 'strafe' | 'threshold', value: number) => {
    if (!rule || !('intent' in rule) || !Number.isInteger(value)) return;
    const next = clone(bot);
    const r = next.brain.states[stateIndex]!.rules[ruleIndex]! as { id: string } & InlineRule;
    if (field === 'threshold' && r.when.kind === 'compare' && r.when.right.kind === 'const') {
      r.when.right.value = value;
    } else if (field !== 'threshold') {
      r.intent.thrust[field] = { kind: 'const', value };
    }
    change(next);
  };

  const adjustRuleName = (newName: string) => {
    if (!rule) return;
    const next = clone(bot);
    next.brain.states[stateIndex]!.rules[ruleIndex]!.id = newName;
    change(next);
  };

  const adjustTurn = (value: number) => {
    if (!rule || !('intent' in rule) || !Number.isInteger(value)) return;
    const next = clone(bot);
    const r = next.brain.states[stateIndex]!.rules[ruleIndex]! as { id: string } & InlineRule;
    r.intent.turn = { kind: 'const', value };
    change(next);
  };

  const adjustNextState = (targetState: string) => {
    if (!rule) return;
    const next = clone(bot);
    const r = next.brain.states[stateIndex]!.rules[ruleIndex]! as { id: string } & InlineRule;
    if (targetState === '') {
      delete r.nextState;
    } else {
      r.nextState = targetState;
    }
    change(next);
  };

  const makeHypothesis = (event: CombatEvent) => {
    setHypothesis(`Giả thuyết từ tick ${event.tick}: ${event.kind} ở đội ${event.actor}. Đổi một điều kiện Brain rồi so A/B.`);
    setParentHash(replay!.manifest.packageHashes.A);
    setBaseline(clone(replay!.source));
    setView('Brain Lab');
  };

  return (
    <div className="app-shell">
      <a className="skip" href="#workspace">
        Đến vùng làm việc
      </a>

      <aside className="navigation">
        <a className="brand" href="#">
          <span className="brand-mark">P</span>
          <span>
            PROMPT
            <br />
            <b>CHIẾN</b>
          </span>
        </a>
        <p className="brand-caption">
          Xây trí tuệ.
          <br />
          Chứng minh trên đấu trường.
        </p>

        <nav aria-label="Điều hướng chính">
          {['Workshop', 'Brain Lab', 'Arena', 'Bot mẫu', 'My Synths'].map((name, i) => (
            <button
              key={name}
              aria-current={view === name ? 'page' : undefined}
              onClick={() => setView(name)}
            >
              <span className="nav-number" aria-hidden="true">
                0{i + 1}
              </span>
              {name}
            </button>
          ))}
        </nav>

        <div className="nav-foot">
          <span className="dot" /> CYBER BLUE WORKSPACE
          <p>alpha-0 · Blade / Burst / Shield</p>
          <p>n8n Workflow Engine</p>
        </div>
      </aside>

      <div className="workspace-shell">
        <header className="topbar">
          <div>
            <span className="eyebrow">PIXEL ART / CYBER COBALT & ELECTRIC CYAN</span>
            <h1>{view}</h1>
          </div>
          <div className="local-badge">◉ n8n Workflow · Local</div>
          {['Workshop', 'Arena', 'My Synths'].includes(view) && (
            <label className="presentation-control">
              Chế độ trình bày{' '}
              <select aria-label="Chế độ trình bày" value={presentation} onChange={(e) => {
                const mode = e.target.value === '3d' ? '3d' : '2d';
                window.history.replaceState(window.history.state, '', presentationUrl(window.location.href, mode));
                setPresentation(mode);
              }}>
                <option value="2d">2D</option>
                <option value="3d">3D · đang phát triển</option>
              </select>
            </label>
          )}
        </header>

        <main id="workspace">
          {presentation === '3d' && ['Workshop', 'Arena', 'My Synths'].includes(view) && (
            <p className="status-strip" role="note">Cảnh 3D chưa sẵn sàng ở U3D-00. Đang dùng 2D; bản đang sửa được giữ.</p>
          )}
          {view !== 'Bot mẫu' && <section className="synth-header">
            <div>
              <label htmlFor="synth-name" className="eyebrow">
                SYNTH / REVISION {revision || 'CHƯA LƯU'}
                {dirty ? ' · ĐANG SỬA' : ''}
              </label>
              <input
                id="synth-name"
                className="synth-name"
                value={bot.name}
                maxLength={64}
                onChange={(e) => change({ ...bot, name: e.target.value })}
              />
              <p className="subtle">{card?.goal ?? 'Một cơ thể. Một giả thuyết. Đọc trace rồi thử lại.'}</p>
            </div>
            <div className="actions">
              <button onClick={() => setView('Bot mẫu')}>Chọn bot mẫu</button>
              <button onClick={() => void save()} disabled={saving}>
                Lưu revision
              </button>
              <button
                className="primary"
                disabled={busy || pending}
                onClick={() => send({ id: ++seq.current, kind: 'validate', text: json(bot) })}
              >
                Kiểm tra bot
              </button>
              <button
                disabled={busy || pending}
                onClick={() => send({ id: ++seq.current, kind: 'practice', text: json(bot), opponent })}
              >
                Thử trận
              </button>
            </div>
          </section>}

          <div className="status-strip" role="status">
            <span>{status}</span>
            {busy && (
              <button
                onClick={() => {
                  createWorker();
                  setBusy(false);
                  setStatus('Đã hủy job local. Draft và replay trước vẫn giữ.');
                }}
              >
                Hủy job
              </button>
            )}
            {diagnostic?.code === 'WORKER_CRASH' && (
              <button
                onClick={() => {
                  const request = active.current;
                  createWorker();
                  if (request) send({ ...request, id: ++seq.current });
                }}
              >
                Thử lại cùng đầu vào
              </button>
            )}
          </div>

          {diagnostic && (
            <div className="error" role="alert">
              <b>{diagnostic.code}</b> <code>{diagnostic.pointer || '/'}</code>
              <p>{diagnostic.message}</p>
            </div>
          )}

          {pending && (
            <div className="notice">
              JSON đang gõ chưa áp dụng; chuyển tab giữ nguyên. Kiểm tra/thử trận chờ áp dụng hoặc bỏ JSON.
              <button
                onClick={() => {
                  setRuleDirty(false);
                  setImportDirty(false);
                  setStaged(null);
                }}
              >
                Bỏ JSON đang sửa
              </button>
            </div>
          )}

          {view === 'Workshop' && (
            <div className="workshop-grid">
              <aside className="palette panel">
                <p className="eyebrow">01 / MODULE LIBRARY</p>
                <h2>Lắp cơ thể</h2>
                <p className="subtle">Chọn module → ô trống → Đặt.</p>
                {catalog
                  .filter((c) => c.enabled)
                  .map((c) => (
                    <button
                      key={c.id}
                      className="module-choice"
                      aria-pressed={palette === c.id}
                      onClick={() => setPalette(c.id)}
                    >
                      <img src={`/assets/${c.id}.svg`} alt="" />
                      <span>
                        {labels[c.id]}
                        <small>
                          {c.cost} điểm · {c.mass} mass
                        </small>
                      </span>
                    </button>
                  ))}
                <p className="subtle" style={{ marginTop: '14px', borderTop: '2px dashed var(--line-quiet)', paddingTop: '10px' }}>
                  Lance / Breaker mở ở G4.
                </p>
              </aside>

              <section className="build-stage">
                <div className="stage-heading">
                  <span className="eyebrow">02 / BODY · 12 × 12 PIXEL GRID</span>
                  <span>+X → phía trước · +Y ↑ bên trái</span>
                </div>

                <div className="blueprint">
                  <div
                    className="cell-grid"
                    ref={rootCell}
                    role="group"
                    aria-label="Lưới cơ thể 12 nhân 12"
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        moveCell(-1, 0);
                      }
                      if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        moveCell(1, 0);
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        moveCell(0, 1);
                      }
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        moveCell(0, -1);
                      }
                    }}
                  >
                    {Array.from({ length: 144 }, (_, i) => {
                      const x = i % 12;
                      const y = 11 - Math.floor(i / 12);
                      const m = bot.body.modules.find(
                        (m) =>
                          x >= m.cell.x &&
                          x < m.cell.x + (m.catalogId === 'core' ? 2 : 1) &&
                          y >= m.cell.y &&
                          y < m.cell.y + (m.catalogId === 'core' ? 2 : 1)
                      );
                      return (
                        <button
                          key={i}
                          data-cell={`${x},${y}`}
                          tabIndex={cell.x === x && cell.y === y ? 0 : -1}
                          aria-label={`Ô ${x},${y}${m ? ` · ${labels[m.catalogId]} ${m.id}` : ' · trống'}`}
                          aria-pressed={cell.x === x && cell.y === y}
                          onClick={() => pickCell(x, y)}
                        />
                      );
                    })}

                    <div className="module-layer" aria-hidden="true">
                      {bot.body.modules.map((m) => {
                        const size = m.catalogId === 'core' ? 2 : 1;
                        return (
                          <img
                            key={m.id}
                            className={m.id === selected ? 'selected-plate' : ''}
                            src={`/assets/${m.catalogId}.svg`}
                            alt=""
                            style={{
                              left: `${(m.cell.x / 12) * 100}%`,
                              bottom: `${(m.cell.y / 12) * 100}%`,
                              width: `${(size / 12) * 100}%`,
                              height: `${(size / 12) * 100}%`,
                              transform: `rotate(${-m.orientation * 90}deg)`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="axis">
                    CYBER CHASSIS / ELECTRIC CORE
                    <span>12×12 PIXEL MATRIX</span>
                  </div>
                </div>

                <div className="controls">
                  <button disabled={!past.length || pending} onClick={undo}>
                    Hoàn tác
                  </button>
                  <button disabled={!future.length || pending} onClick={redo}>
                    Làm lại
                  </button>
                  <button
                    className="primary"
                    disabled={pending}
                    onClick={() => {
                      change(newModule(bot, palette, cell.x, cell.y));
                      setSelected('');
                    }}
                  >
                    Đặt {labels[palette]} ({cell.x},{cell.y})
                  </button>
                </div>

                <p className="subtle desktop-help">
                  ← ↑ ↓ → chọn ô · Enter chọn · Ctrl+Z / Ctrl+Shift+Z hoàn tác / làm lại.
                </p>

                <div className="mobile-note">
                  Điện thoại ưu tiên xem trận, debrief và sửa Brain. Dùng tablet/desktop để lắp hình học; danh sách module
                  vẫn xem được bên dưới.
                </div>

                <details>
                  <summary>Danh sách module — truy cập bằng bàn phím ({bot.body.modules.length})</summary>
                  <ul className="module-list">
                    {bot.body.modules.map((m) => (
                      <li key={m.id}>
                        <button
                          onClick={() => {
                            setSelected(m.id);
                            setCell(m.cell);
                          }}
                        >
                          {labels[m.catalogId]} · {m.id} · ({m.cell.x},{m.cell.y}) · hướng {m.orientation}
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              </section>

              <aside className="panel inspector">
                <p className="eyebrow">03 / BUILD DIAGNOSTICS</p>
                <div className="budget">
                  <strong>
                    {cost}
                    <small>/ 100</small>
                  </strong>
                  <span>BUILD POINTS</span>
                </div>
                <meter min="0" max="100" value={cost} />

                <dl>
                  <div>
                    <dt>Module</dt>
                    <dd>{bot.body.modules.length} / 24</dd>
                  </div>
                  <div>
                    <dt>Mass khóa</dt>
                    <dd>{mass}</dd>
                  </div>
                  <div>
                    <dt>Bán kính</dt>
                    <dd>{validation ? `${validation.radius.toFixed(0)} / 6500` : 'Cần kiểm tra'}</dd>
                  </div>
                  <div>
                    <dt>Brain</dt>
                    <dd>{validation ? `${validation.compiled.nodeCount} IR nodes` : 'Cần kiểm tra'}</dd>
                  </div>
                </dl>

                {warnings.length > 0 && (
                  <p className="notice">Burst bị che theo hướng thẳng: {warnings.join(', ')}. Kiểm tra aim trong trace.</p>
                )}

                <hr />
                <h3>
                  {selectedModule
                    ? `${labels[selectedModule.catalogId]} / ${selectedModule.id}`
                    : `Ô trống (${cell.x},${cell.y})`}
                </h3>

                {selectedModule && (
                  <>
                    <div className="xy">
                      <label>
                        X
                        <input
                          type="number"
                          min="0"
                          max="11"
                          value={selectedModule.cell.x}
                          disabled={pending}
                          onChange={(e) => {
                            const n = e.target.valueAsNumber;
                            if (Number.isInteger(n))
                              change(editModule(bot, selectedModule.id, { cell: { ...selectedModule.cell, x: n } }));
                          }}
                        />
                      </label>
                      <label>
                        Y
                        <input
                          type="number"
                          min="0"
                          max="11"
                          value={selectedModule.cell.y}
                          disabled={pending}
                          onChange={(e) => {
                            const n = e.target.valueAsNumber;
                            if (Number.isInteger(n))
                              change(editModule(bot, selectedModule.id, { cell: { ...selectedModule.cell, y: n } }));
                          }}
                        />
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        disabled={pending}
                        onClick={() =>
                          change(
                            editModule(bot, selectedModule.id, {
                              orientation: ((selectedModule.orientation + 1) % 4) as 0 | 1 | 2 | 3,
                            })
                          )
                        }
                      >
                        Xoay 90°
                      </button>
                      <button
                        disabled={pending}
                        style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                        onClick={() => {
                          change(editModule(bot, selectedModule.id, null));
                          setSelected('');
                        }}
                      >
                        Xóa module
                      </button>
                    </div>
                  </>
                )}

                <hr />
                <label>
                  Mẫu khởi đầu
                  <select
                    disabled={busy || pending}
                    defaultValue=""
                    onChange={(e) => {
                      const template = templates[Number(e.target.value)];
                      if (template) chooseTemplate(template);
                    }}
                  >
                    <option value="" disabled>
                      Chọn mẫu để chơi hoặc chỉnh sửa
                    </option>
                    {templates.map((t, i) => (
                      <option key={t.name} value={i}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>

                <button style={{ width: '100%', marginTop: '12px' }} onClick={() => setShowImport(!showImport)}>
                  Import / export JSON
                </button>
              </aside>
            </div>
          )}

          {showImport && (
            <section className="panel import-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h2>Import / export</h2>
                <button
                  style={{ minHeight: '32px', padding: '4px 10px', fontSize: '12px' }}
                  onClick={() => setShowImport(false)}
                >
                  ✕ Đóng
                </button>
              </div>
              <p>JSON đang gõ giữ riêng khỏi bot đã áp dụng. Áp dụng có thể hoàn tác.</p>
              {staged && <p className="notice">{diffSummary(bot, staged)}</p>}

              <label>
                File BotDefinition
                <input
                  type="file"
                  disabled={pending || busy}
                  accept=".json,application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 262144) {
                      setDiagnostic({ code: 'BYTE_CAP', pointer: '/', message: 'File vượt 256 KiB.' });
                      return;
                    }
                    void file.text().then((text) => {
                      setImportText(text);
                      setImportDirty(true);
                    });
                  }}
                />
              </label>

              <label>
                Bot JSON
                <textarea
                  disabled={ruleDirty || busy}
                  value={importText}
                  spellCheck={false}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    setImportDirty(true);
                  }}
                />
              </label>

              <div className="controls" style={{ marginTop: '14px' }}>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => send({ id: ++seq.current, kind: 'validate', text: importText }, true)}
                >
                  Kiểm tra và áp dụng JSON
                </button>
                <button onClick={() => download(`${bot.name}.bot.json`, bot)}>Export bot đã áp dụng</button>
                <button
                  onClick={() => {
                    setImportDirty(false);
                    setStaged(null);
                    setShowImport(false);
                  }}
                >
                  Giữ bot hiện tại
                </button>
              </div>
            </section>
          )}

          {/* ========================================================= */}
          {/* BRAIN LAB: N8N WORKFLOW GRAPH & NODE INSPECTOR            */}
          {/* ========================================================= */}
          {view === 'Bot mẫu' && (
            <section className="bot-library" aria-labelledby="bot-library-heading">
              <div className="library-heading"><div><p className="eyebrow">CHỌN PHONG CÁCH / VÀO ĐẤU TRƯỜNG</p><h2 id="bot-library-heading">Bot mẫu sẵn sàng chơi</h2></div><span>{templates.length} bot</span></div>
              <p>Chọn một bot để chỉnh sửa hoặc chơi ngay. Bot tự chiến đấu; bạn xem trận và khám phá cách nó quyết định.</p>
              <label className="library-opponent">Đối thủ khi chơi ngay<select value={opponent} disabled={busy} onChange={e=>setOpponent(Number(e.target.value))}>{templates.map((t,i)=><option key={t.name} value={i}>{t.name}</option>)}</select></label>
              <div className="bot-library-grid">{templates.map(template=>{
                const info=cards.find(c=>c.name===template.name);
                const points=template.body.modules.reduce((sum,m)=>sum+(catalog.find(c=>c.id===m.catalogId)?.cost??0),0);
                const minX=Math.min(...template.body.modules.map(m=>m.cell.x)),minY=Math.min(...template.body.modules.map(m=>m.cell.y));
                const cols=Math.max(...template.body.modules.map(m=>m.cell.x+(m.catalogId==='core'?2:1)))-minX,rows=Math.max(...template.body.modules.map(m=>m.cell.y+(m.catalogId==='core'?2:1)))-minY;
                return <article className="bot-library-card panel" key={template.name}>
                  <div className="bot-library-preview" aria-hidden="true" style={{gridTemplateColumns:`repeat(${cols}, 28px)`,gridTemplateRows:`repeat(${rows}, 28px)`}}>{template.body.modules.map(m=><img key={m.id} src={`/assets/${m.catalogId}.svg`} alt="" style={{gridColumn:`${m.cell.x-minX+1} / span ${m.catalogId==='core'?2:1}`,gridRow:`${m.cell.y-minY+1} / span ${m.catalogId==='core'?2:1}`,transform:`rotate(${m.orientation*90}deg)`}}/>)}</div>
                  <p className="eyebrow">{points}/100 điểm · {template.body.modules.length} bộ phận</p><h3>{template.name}</h3><p>{info?.goal}</p>
                  <details><summary>Điểm yếu & cách khắc chế</summary><p>{info?.weakness}</p></details>
                  <div className="controls"><button disabled={busy||pending} onClick={()=>chooseTemplate(template)} aria-label={`Chọn bot ${template.name}`}>Chọn bot</button><button className="primary" disabled={busy||pending} onClick={()=>chooseTemplate(template,true)} aria-label={`Chơi ngay với ${template.name}`}>Chơi ngay</button></div>
                </article>;
              })}</div>
            </section>
          )}

          {view === 'Brain Lab' && (
            <>
            <div className="library-heading brain-library-heading"><div><p className="eyebrow">LẮP Ý TƯỞNG THÀNH HÀNH VI</p><p>Tìm mẫu di chuyển, chiến đấu và bộ nhớ để thử trên bot của bạn.</p></div><button aria-expanded={showNodeLibrary} aria-controls="brain-node-library" onClick={()=>setShowNodeLibrary(!showNodeLibrary)}>Thư viện node · {nodeLibrary.length}</button></div>
            {showNodeLibrary&&<div id="brain-node-library"><NodeLibrary bot={bot} stateIndex={stateIndex} disabled={busy||pending} onAdd={addLibraryNode}/></div>}
            <section className="brain-layout">
              {/* Left Canvas: n8n Node-Based Workflow */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--cyan)' }}>START:</span>
                    <select
                      value={bot.brain.initialState}
                      disabled={pending}
                      style={{ width: 'auto', minHeight: '34px', padding: '4px 8px' }}
                      onChange={(e) =>
                        change({ ...bot, brain: { ...bot.brain, initialState: e.target.value } })
                      }
                    >
                      {bot.brain.states.map((s) => (
                        <option key={s.id}>{s.id}</option>
                      ))}
                    </select>
                  </label>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {bot.brain.states.map((state, i) => (
                      <button
                        key={state.id}
                        disabled={ruleDirty}
                        aria-pressed={stateIndex === i}
                        style={{ minHeight: '34px', padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => {
                          setStateIndex(i);
                          setRuleIndex(0);
                        }}
                      >
                        {state.id} ({state.rules.length})
                      </button>
                    ))}
                  </div>

                  <button
                    disabled={pending}
                    style={{ minHeight: '34px', padding: '4px 10px', fontSize: '12px', marginLeft: 'auto' }}
                    onClick={addState}
                  >
                    + Thêm state
                  </button>
                  <button
                    disabled={pending}
                    style={{ minHeight: '34px', padding: '4px 10px', fontSize: '12px' }}
                    onClick={addRule}
                  >
                    + Thêm luật idle
                  </button>
                  <button
                    style={{ minHeight: '34px', padding: '4px 10px', fontSize: '12px' }}
                    onClick={() => setShowImport(true)}
                  >
                    Mở Bot JSON
                  </button>
                </div>

                {/* The n8n Interactive Canvas */}
                <N8nCanvas
                  bot={bot}
                  stateIndex={stateIndex}
                  ruleIndex={ruleIndex}
                  onSelectState={setStateIndex}
                  onSelectRule={setRuleIndex}
                />
              </div>

              {/* Right Sidebar: n8n Node Inspector */}
              <aside className="n8n-inspector">
                <p className="eyebrow">NODE INSPECTOR / {rule?.id ?? 'CHƯA CHỌN'}</p>
                <h2>Cấu hình Node n8n</h2>

                {rule && (
                  <div style={{ marginBottom: '14px' }}>
                    <label>
                      Tên / ID của Quy tắc
                      <input
                        type="text"
                        disabled={pending}
                        value={rule.id}
                        onChange={(e) => adjustRuleName(e.target.value)}
                      />
                    </label>
                  </div>
                )}

                {rule && 'intent' in rule && (
                  <>
                    <h3 style={{ borderBottom: '1px solid var(--line-quiet)', paddingBottom: '4px' }}>
                      🔷 Cảm biến Sensor
                    </h3>
                    {rule.when.kind === 'compare' && rule.when.right.kind === 'const' ? (
                      <label>
                        Ngưỡng so sánh {rule.when.left.kind === 'sensor' ? rule.when.left.name : ''}
                        <input
                          disabled={pending}
                          type="number"
                          value={rule.when.right.value}
                          onChange={(e) => adjust('threshold', e.target.valueAsNumber)}
                        />
                      </label>
                    ) : (
                      <p className="subtle">Điều kiện: {conditionSummary(rule.when)}</p>
                    )}

                    <h3 style={{ borderBottom: '1px solid var(--line-quiet)', paddingBottom: '4px', marginTop: '16px' }}>
                      🟠 Động cơ & Lực đẩy
                    </h3>
                    <div className="xy">
                      {(['forward', 'strafe'] as const).map((field) => {
                        const expr = rule.intent.thrust[field];
                        return expr.kind === 'const' ? (
                          <label key={field}>
                            {field === 'forward' ? 'Tiến/lùi (−1000…1000)' : 'Lách ngang (−1000…1000)'}
                            <input
                              disabled={pending}
                              type="number"
                              min="-1000"
                              max="1000"
                              value={expr.value}
                              onChange={(e) => adjust(field, e.target.valueAsNumber)}
                            />
                          </label>
                        ) : (
                          <p key={field} className="subtle">
                            {field}: biểu thức — sửa JSON
                          </p>
                        );
                      })}
                    </div>

                    <label>
                      Xoay thân turn (−1000…1000)
                      <input
                        disabled={pending}
                        type="number"
                        min="-1000"
                        max="1000"
                        value={rule.intent.turn.kind === 'const' ? rule.intent.turn.value : 0}
                        onChange={(e) => adjustTurn(e.target.valueAsNumber)}
                      />
                    </label>

                    <h3 style={{ borderBottom: '1px solid var(--line-quiet)', paddingBottom: '4px', marginTop: '16px' }}>
                      🟣 Chuyển State (nextState)
                    </h3>
                    <label>
                      Đích đến FSM
                      <select
                        disabled={pending}
                        value={typeof rule.nextState === 'string' ? rule.nextState : ''}
                        onChange={(e) => adjustNextState(e.target.value)}
                      >
                        <option value="">Giữ nguyên State hiện tại</option>
                        {bot.brain.states.map((s) => (
                          <option key={s.id} value={s.id}>
                            → Chuyển sang [{s.id}]
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                <h3 style={{ borderBottom: '1px solid var(--line-quiet)', paddingBottom: '4px', marginTop: '16px' }}>
                  Rule JSON Editor
                </h3>
                <label>
                  Rule JSON · condition / intent / set / nextState
                  <textarea
                    disabled={importDirty || busy}
                    spellCheck={false}
                    value={ruleText}
                    onChange={(e) => {
                      setRuleText(e.target.value);
                      setRuleDirty(true);
                    }}
                  />
                </label>

                <div className="controls" style={{ marginTop: '12px' }}>
                  <button
                    className="primary"
                    disabled={busy || !rule}
                    onClick={() =>
                      send(
                        {
                          id: ++seq.current,
                          kind: 'rule',
                          text: json(bot),
                          ruleText,
                          state: stateIndex,
                          rule: ruleIndex,
                        },
                        true
                      )
                    }
                  >
                    Kiểm tra và áp dụng luật
                  </button>
                  <button onClick={() => setRuleDirty(false)}>Bỏ JSON đang gõ</button>
                  <button
                    disabled={pending || !rule}
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    onClick={() => {
                      const next = clone(bot);
                      next.brain.states[stateIndex]!.rules.splice(ruleIndex, 1);
                      change(next);
                      setRuleIndex(0);
                    }}
                  >
                    Xóa luật
                  </button>
                  {ruleIndex > 0 && (
                    <button
                      disabled={pending}
                      onClick={() => {
                        const next = clone(bot);
                        const rs = next.brain.states[stateIndex]!.rules;
                        [rs[ruleIndex - 1], rs[ruleIndex]] = [rs[ruleIndex]!, rs[ruleIndex - 1]!];
                        change(next);
                        setRuleIndex(ruleIndex - 1);
                      }}
                    >
                      Tăng ưu tiên
                    </button>
                  )}
                </div>

                <hr style={{ margin: '20px 0' }} />
                <aside className="behavior-card" style={{ padding: 0, border: 0, background: 'transparent' }}>
                  <p className="eyebrow">BEHAVIOR CARD / TÁC GIẢ</p>
                  <h2>Giả thuyết của bạn</h2>
                  <label>
                    Mục tiêu / tấn công / mất bộ phận
                    <textarea
                      className="short"
                      value={hypothesis}
                      onChange={(e) => setHypothesis(e.target.value)}
                      maxLength={2000}
                    />
                  </label>
                  <label>
                    Điểm yếu dự kiến
                    <textarea
                      className="short"
                      value={weakness}
                      onChange={(e) => setWeakness(e.target.value)}
                      maxLength={1000}
                    />
                  </label>
                  <p className="subtle" style={{ fontStyle: 'italic', margin: '8px 0' }}>
                    {card?.weakness}
                  </p>
                  {parentHash && <p className="mono wrap" style={{ color: 'var(--cyan)' }}>Parent package {parentHash}</p>}
                </aside>
              </aside>
            </section>
            </>
          )}

          {view === 'Arena' &&
            (replay ? (
              <>
                <div className="notice">
                  {json(replay.source) !== json(bot)
                    ? 'Replay thuộc bản trước; draft hiện tại đã đổi. '
                    : 'Replay của snapshot đã tính. '}
                  Scenario {replay.manifest.scenarioId} · chỉ trace A thuộc chủ bot.
                </div>
                <Suspense fallback={<p role="status" className="loading">Đang tải viewer…</p>}>
                  <Arena key={replay.publicReplayHash} replay={replay} onHypothesis={makeHypothesis} />
                </Suspense>
              </>
            ) : (
              <section className="empty panel">
                <p className="eyebrow">ARENA / LOCAL PRACTICE</p>
                <h2>Cơ thể đã có. Giờ xem nó quyết định.</h2>
                <p>Chọn đối thủ, bấm Thử trận. Engine tính xong rồi viewer phát lại.</p>
                <button
                  className="primary"
                  disabled={busy || pending}
                  onClick={() => send({ id: ++seq.current, kind: 'practice', text: json(bot), opponent })}
                >
                  Thử trận đầu tiên
                </button>
              </section>
            ))}

          {view === 'My Synths' && (
            <section className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <p className="eyebrow">BLUEPRINT ARCHIVE</p>
                  <h2>Những phiên bản trên máy này</h2>
                </div>
                <button className="primary" disabled={saving} onClick={() => void save(true)}>
                  Lưu thành Synth mới
                </button>
              </div>

              <p className="subtle">Draft local/unofficial trong IndexedDB. Lưu hoặc export trước khi tải bản khác.</p>

              {drafts.length === 0 && <p className="subtle">Chưa có bản lưu. Bấm Lưu revision.</p>}

              {drafts.map((d) => (
                <div className="draft-row" key={d.id}>
                  <span>
                    <b style={{ color: 'var(--cyan)', fontSize: '14px' }}>{d.definition.name}</b> · r{d.revision}
                    <small>
                      {new Date(d.savedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                    </small>
                  </span>
                  <button
                    disabled={dirty}
                    title={dirty ? 'Lưu hoặc export bản đang sửa trước' : ''}
                    onClick={() => {
                      loadDraft(d);
                      setView('Workshop');
                    }}
                  >
                    Tải bản mới
                  </button>
                </div>
              ))}

              <hr style={{ margin: '24px 0' }} />
              <h3>Lineage / lịch sử revision của Synth hiện tại</h3>
              {history.map((d) => (
                <div className="draft-row" key={d.revision}>
                  <span>
                    <b style={{ color: 'var(--cyan-lit)' }}>r{d.revision}</b> · {d.hypothesis}
                  </span>
                  <button
                    disabled={pending}
                    onClick={() => {
                      change(d.definition);
                      setHypothesis(d.hypothesis);
                      setWeakness(d.weakness);
                      setParentHash(d.parentHash);
                      setStatus(`Khôi phục nội dung r${d.revision}; lưu sẽ tạo revision mới.`);
                      setView('Workshop');
                    }}
                  >
                    Khôi phục nội dung
                  </button>
                </div>
              ))}
            </section>
          )}

          <section className="experiment panel">
            <div>
              <p className="eyebrow">LOCAL EXPERIMENT / PAIRED A → B</p>
              <h2>Đổi một điều. Đo một khác biệt.</h2>
              <p>Cùng đối thủ, scenario, cả hai slot. Khám phá · chưa tính confidence.</p>
            </div>

            <div className="experiment-controls">
              <label>
                Đối thủ
                <select value={opponent} disabled={busy} onChange={(e) => setOpponent(Number(e.target.value))}>
                  {templates.map((t, i) => (
                    <option key={t.name} value={i}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Scenario
                <select
                  value={count}
                  disabled={busy}
                  onChange={(e) => setCount(Number(e.target.value) as 1 | 3 | 10)}
                >
                  <option value="1">1 · 4 legs</option>
                  <option value="3">3 · 12 legs</option>
                  <option value="10">10 · 40 legs</option>
                </select>
              </label>

              <button
                disabled={pending}
                onClick={() => {
                  setBaseline(clone(bot));
                  setStatus('Đã khóa baseline trong bộ nhớ. Sửa candidate rồi chạy A/B.');
                }}
              >
                Khóa baseline hiện tại
              </button>

              <button
                className="primary"
                disabled={busy || pending || !baseline}
                onClick={() =>
                  send({
                    id: ++seq.current,
                    kind: 'experiment',
                    text: json(bot),
                    baseline: json(baseline),
                    opponent,
                    count,
                  })
                }
              >
                Chạy A/B ({count * 4} legs)
              </button>
            </div>

            {comparison && (
              <div className="comparison">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>Chênh lệch mean leg score: {(comparison.meanDelta * 100).toFixed(1)} điểm %</h3>
                  <div
                    style={{
                      padding: '4px 10px',
                      fontWeight: 700,
                      background: comparison.meanDelta > 0 ? 'rgba(0,255,136,0.15)' : comparison.meanDelta < 0 ? 'rgba(255,51,102,0.15)' : 'rgba(255,255,255,0.06)',
                      color: comparison.meanDelta > 0 ? 'var(--neon-green)' : comparison.meanDelta < 0 ? 'var(--neon-red)' : 'var(--text-muted)',
                      border: '2px solid var(--line)',
                    }}
                  >
                    Δ {(comparison.meanDelta * 100).toFixed(1)}%
                  </div>
                </div>

                <p>
                  Win=1 / hòa=0.5 / thua=0; trung bình hai slot. {comparison.rows.length} scenario · chưa đủ kết luận cải tiến.
                </p>

                <table>
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>Baseline</th>
                      <th>Candidate</th>
                      <th>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.rows.map((r) => (
                      <tr key={r.scenarioId}>
                        <td className="mono">{r.scenarioId}</td>
                        <td className="mono">{r.baseline / 1000}</td>
                        <td className="mono">{r.candidate / 1000}</td>
                        <td
                          className="mono"
                          style={{
                            color:
                              r.candidate > r.baseline
                                ? 'var(--neon-green)'
                                : r.candidate < r.baseline
                                ? 'var(--neon-red)'
                                : 'var(--text-muted)',
                            fontWeight: 700,
                          }}
                        >
                          {(r.candidate - r.baseline) / 1000}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p className="mono wrap" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Baseline {comparison.baselineHash}
                  <br />
                  Candidate {comparison.candidateHash}
                  <br />
                  Seeds {comparison.seedSetDigest}
                </p>

                <button onClick={() => download('local-comparison.json', comparison)}>
                  Export kết quả A/B
                </button>
              </div>
            )}
          </section>

          <footer>
            <div className="controls">
              <label className="check" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={uiSound} onChange={(e) => setUiSound(e.target.checked)} />
                Âm UI
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                Âm lượng UI
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={uiVolume}
                  onChange={(e) => setUiVolume(Number(e.target.value))}
                />
              </label>
            </div>
            G2 local vertical slice · n8n Brain Lab · Cyber Blue Theme
          </footer>
        </main>
      </div>
    </div>
  );
}
