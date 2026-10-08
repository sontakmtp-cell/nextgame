import { useEffect, useRef, useState } from 'react';
import type { BotDefinition, CatalogEntry, Diagnostic } from '@prompt-chien/contracts';
import type { Comparison, LocalReplay, Request, Response, Validation } from './protocol.js';
import { clone } from './model.js';
import { listDrafts, revisions, saveDraft } from './drafts.js';
import type { Draft } from './drafts.js';
import { readPresentationMode } from './presentation.js';
const json = (value: unknown) => JSON.stringify(value, null, 2);
// One lifetime for the draft, buffers, undo, worker and storage across all views.
export function useSynthSession() {
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
    setDiagnostic(null);
  };

  const redo = () => {
    if (!bot || !future.length) return;
    setPast((p) => [...p, clone(bot)]);
    setBot(clone(future[0]!));
    setFuture((f) => f.slice(1));
    setValidation(null);
    setDiagnostic(null);
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
        if (data.id !== applyId.current && active.current?.kind === 'validate' && active.current.text !== json(current.current)) {
          setStatus('Kiểm tra thuộc bản cũ. Kiểm tra lại sau khi sửa.');
          return;
        }
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
        if (pending) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [past, future, bot, pending]);

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

  return {
    view, setView, presentation, setPresentation, bot, templates, catalog,
    cards, past, future, selected, setSelected, cell, setCell,
    palette, setPalette, diagnostic, setDiagnostic, validation, busy, setBusy,
    status, setStatus, replay, setReplay, comparison, setComparison, opponent,
    setOpponent, count, setCount, baseline, setBaseline, setDraftId, revision,
    setRevision, drafts, history, setStored, saving, hypothesis, setHypothesis,
    weakness, setWeakness, parentHash, setParentHash, uiSound, setUiSound, uiVolume,
    setUiVolume, importText, setImportText, importDirty, setImportDirty, staged, setStaged,
    showImport, setShowImport, stateIndex, setStateIndex, ruleIndex, setRuleIndex, ruleText,
    setRuleText, ruleDirty, setRuleDirty, showNodeLibrary, setShowNodeLibrary, seq, active,
    current, rootCell, change, undo, redo, loadDraft, createWorker,
    rule, dirty, pending, send, save
  };
}
