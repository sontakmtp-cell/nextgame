import React, { useState, useEffect, useCallback } from 'react';
import type { BotDefinition, MatchResult, PublicFrame } from '@prompt-chien/contracts';
import { Button, Badge, AlertBanner, Tabs } from './design-system.js';
import { Workshop } from './workshop.js';
import { BrainLab } from './brain-lab.js';
import { Arena } from './arena.js';
import { Experiment } from './experiment.js';
import { Debrief } from './debrief.js';
import { BehaviorCard } from './behavior-card.js';
import { createDraft, listDrafts, saveDraft, ConflictError } from './storage.js';
import { workerBridge } from './worker-bridge.js';
import { KESTREL_BOT, MANTIS_BOT, PRESET_BEHAVIOR_CARDS } from './presets.js';
import type { DraftBot, PrivateTraceStep, SimulationPayload } from './types.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('workshop');
  const [drafts, setDrafts] = useState<DraftBot[]>([]);
  const [currentDraft, setCurrentDraft] = useState<DraftBot | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Simulation & Replay state
  const [simulationFrames, setSimulationFrames] = useState<PublicFrame[]>([]);
  const [simulationResult, setSimulationResult] = useState<MatchResult | undefined>(undefined);
  const [simulationTraces, setSimulationTraces] = useState<PrivateTraceStep[]>([]);

  // Status alerts & notifications
  const [notification, setNotification] = useState<{ type: 'info' | 'warning' | 'danger' | 'success'; title?: string; message: string } | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Load or initialize drafts
  useEffect(() => {
    async function init() {
      const existing = await listDrafts();
      if (existing.length > 0) {
        setDrafts(existing);
        setCurrentDraft(existing[0]!);
      } else {
        const initial = await createDraft('Mantis Mẫu', MANTIS_BOT, PRESET_BEHAVIOR_CARDS.Mantis!);
        setDrafts([initial]);
        setCurrentDraft(initial);
      }
    }
    void init();
  }, []);

  const handleBotChange = (updatedBot: BotDefinition) => {
    if (!currentDraft) return;
    setCurrentDraft({
      ...currentDraft,
      definition: updatedBot,
    });
    setHasUnsavedChanges(true);
  };

  const handleSaveDraft = useCallback(async () => {
    if (!currentDraft) return;
    try {
      const saved = await saveDraft(currentDraft, currentDraft.revision);
      setCurrentDraft(saved);
      setHasUnsavedChanges(false);
      setDrafts(prev => prev.map(d => d.id === saved.id ? saved : d));
      setNotification({
        type: 'success',
        title: 'Đã lưu nháp',
        message: `Bản nháp ${saved.name} đã được lưu thành công ở Revision v${saved.revision}.`,
      });
    } catch (err) {
      if (err instanceof ConflictError) {
        setNotification({
          type: 'danger',
          title: 'Xung đột phiên bản (409)',
          message: err.message,
        });
      } else {
        setNotification({
          type: 'danger',
          title: 'Lỗi lưu nháp',
          message: String(err),
        });
      }
    }
  }, [currentDraft]);

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSaveDraft();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveDraft]);

  const handleValidate = async () => {
    if (!currentDraft) return;
    setIsValidating(true);
    try {
      const res = await workerBridge.validateBot(currentDraft.definition);
      if (res.valid) {
        setNotification({
          type: 'success',
          title: 'Kiểm tra thành công (Valid)',
          message: `Synth hoàn toàn hợp lệ. Package hash: ${res.packageHash?.slice(0, 16)}...`,
        });
      } else {
        setNotification({
          type: 'danger',
          title: 'Kiểm tra thất bại (Invalid)',
          message: `${res.error} ${res.pointer ? `tại ${res.pointer}` : ''}`,
        });
      }
    } catch (err) {
      setNotification({
        type: 'danger',
        title: 'Lỗi kiểm tra',
        message: String(err),
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handlePracticeMatch = async () => {
    if (!currentDraft) return;
    setIsSimulating(true);
    try {
      const payload = await workerBridge.simulateMatch(currentDraft.definition, KESTREL_BOT);
      setSimulationFrames(payload.frames);
      setSimulationResult(payload.result);
      setSimulationTraces(payload.traces);
      setActiveTab('arena');
      setNotification({
        type: 'info',
        title: 'Thử đấu hoàn tất',
        message: `Đã mô phỏng xong trận đối đầu với Kestrel. Kết quả: ${payload.result.winner === 'A' ? 'Thắng' : payload.result.winner === 'B' ? 'Thua' : 'Hòa'}.`,
      });
    } catch (err) {
      setNotification({
        type: 'danger',
        title: 'Lỗi mô phỏng',
        message: String(err),
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleViewReplay = (payload: SimulationPayload) => {
    setSimulationFrames(payload.frames);
    setSimulationResult(payload.result);
    setSimulationTraces(payload.traces);
    setActiveTab('arena');
  };

  const handleCreateNewDraft = async () => {
    const name = `Synth ${drafts.length + 1}`;
    const newDraft = await createDraft(name);
    setDrafts([...drafts, newDraft]);
    setCurrentDraft(newDraft);
    setHasUnsavedChanges(false);
    setNotification({
      type: 'info',
      title: 'Tạo Synth mới',
      message: `Đã khởi tạo nháp "${name}".`,
    });
  };

  const handleSeekFromDebrief = (_tick: number) => {
    setActiveTab('arena');
  };

  const handleCreateHypothesisFromDebrief = (hypothesis: string) => {
    if (!currentDraft) return;
    setCurrentDraft({
      ...currentDraft,
      behaviorCard: {
        ...currentDraft.behaviorCard,
        hypothesis,
      },
    });
    setHasUnsavedChanges(true);
    setActiveTab('experiment');
    setNotification({
      type: 'info',
      title: 'Giả thuyết mới',
      message: 'Đã cập nhật giả thuyết chiến thuật vào Behavior Card. Sẵn sàng chạy thí nghiệm A/B.',
    });
  };

  return (
    <div>
      {/* App Header */}
      <header className="app-header">
        <div className="brand-section">
          <div>
            <div className="brand-title">PROMPT CHIẾN</div>
            <div className="brand-subtitle">Build Intelligence · Prove It in Battle</div>
          </div>
        </div>

        {/* Center Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tabs
            tabs={[
              { id: 'workshop', label: '🛠️ Workshop' },
              { id: 'brain', label: '🧠 Brain Lab' },
              { id: 'arena', label: '⚔️ Arena' },
              { id: 'experiment', label: '📊 Thí nghiệm A/B' },
              { id: 'debrief', label: '📋 Debrief' },
              { id: 'behavior', label: '📜 Lineage & Card' },
            ]}
            activeId={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* Right Actions */}
        <div className="header-actions">
          {currentDraft && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                value={currentDraft.id}
                onChange={e => {
                  const target = drafts.find(d => d.id === e.target.value);
                  if (target) {
                    setCurrentDraft(target);
                    setHasUnsavedChanges(false);
                  }
                }}
                style={{
                  backgroundColor: 'var(--color-surface2)',
                  border: '1px solid var(--color-line-quiet)',
                  borderRadius: 'var(--radius-field)',
                  padding: '6px 10px',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {drafts.map(d => (
                  <option key={d.id} value={d.id}>{d.name} (v{d.revision})</option>
                ))}
              </select>

              <Badge variant={hasUnsavedChanges ? 'warning' : 'success'}>
                {hasUnsavedChanges ? 'Chưa lưu' : `Đã lưu (v${currentDraft.revision})`}
              </Badge>

              <Button size="sm" variant="secondary" onClick={() => void handleSaveDraft()} title="Lưu nháp (Ctrl+S)">
                💾 Lưu
              </Button>
              <Button size="sm" variant="primary" onClick={handlePracticeMatch} disabled={isSimulating}>
                {isSimulating ? 'Đang chạy…' : 'Thử đấu'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCreateNewDraft} title="Tạo Synth mới">
                + Mới
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="app-main">
        {/* Notifications */}
        {notification && (
          <AlertBanner
            variant={notification.type}
            title={notification.title}
            onClose={() => setNotification(null)}
          >
            {notification.message}
          </AlertBanner>
        )}

        {/* Worker crash alert if active */}
        {workerBridge.getCrashStatus() && (
          <AlertBanner
            variant="danger"
            title="Sự cố Worker (Worker Crash Handled)"
            onClose={() => workerBridge.clearCrashStatus()}
          >
            Worker gặp sự cố: {workerBridge.getCrashStatus()}. Hệ thống đã tự động khôi phục Worker sạch, bạn có thể thực hiện lại thao tác mà không mất dữ liệu.
          </AlertBanner>
        )}

        {/* View Switcher */}
        {currentDraft ? (
          <div>
            {activeTab === 'workshop' && (
              <Workshop
                bot={currentDraft.definition}
                onChange={handleBotChange}
                onValidate={handleValidate}
                isValidating={isValidating}
              />
            )}

            {activeTab === 'brain' && (
              <BrainLab
                bot={currentDraft.definition}
                onChange={handleBotChange}
                traces={simulationTraces}
              />
            )}

            {activeTab === 'arena' && (
              <Arena
                frames={simulationFrames}
                result={simulationResult}
                traces={simulationTraces}
              />
            )}

            {activeTab === 'experiment' && (
              <Experiment
                currentBot={currentDraft.definition}
                onApplyCandidate={handleBotChange}
                onViewReplay={handleViewReplay}
              />
            )}

            {activeTab === 'debrief' && (
              <Debrief
                result={simulationResult}
                frames={simulationFrames}
                onSeekTick={handleSeekFromDebrief}
                onCreateHypothesis={handleCreateHypothesisFromDebrief}
              />
            )}

            {activeTab === 'behavior' && (
              <BehaviorCard
                draft={currentDraft}
                onChange={updated => {
                  setCurrentDraft(updated);
                  setHasUnsavedChanges(true);
                }}
              />
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
            Đang tải dữ liệu Synth…
          </div>
        )}
      </main>
    </div>
  );
};
