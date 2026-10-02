import React, { useState } from 'react';
import type { BotDefinition, BrainSource, InlineRule } from '@prompt-chien/contracts';
import { Button, Card, Badge, TextArea, Tabs } from './design-system.js';
import { parseJsonWithPointer, validateBotStructure } from './validation.js';
import type { PrivateTraceStep } from './types.js';

interface BrainLabProps {
  bot: BotDefinition;
  onChange: (updated: BotDefinition) => void;
  traces?: PrivateTraceStep[];
}

export const BrainLab: React.FC<BrainLabProps> = ({
  bot,
  onChange,
  traces = [],
}) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'source' | 'trace'>('visual');
  const [selectedStateId, setSelectedStateId] = useState<string>(bot.brain.initialState);
  const [, setSelectedRuleId] = useState<string | null>(null);

  // JSON source editing
  const [sourceText, setSourceText] = useState(JSON.stringify(bot.brain, null, 2));
  const [sourceError, setSourceError] = useState<{ error: string; pointer?: string | undefined } | null>(null);

  // Trace scrubber
  const [traceIndex, setTraceIndex] = useState(0);

  const brain = bot.brain;
  const diagnostics = validateBotStructure(bot);

  const currentState = brain.states.find(s => s.id === selectedStateId) ?? brain.states[0];

  const updateBrain = (newBrain: BrainSource) => {
    onChange({ ...bot, brain: newBrain });
    setSourceText(JSON.stringify(newBrain, null, 2));
  };

  const handleApplySource = () => {
    const parsed = parseJsonWithPointer(sourceText);
    if (parsed.error) {
      setSourceError({ error: parsed.error, pointer: parsed.pointer ?? undefined });
      return;
    }
    const data = parsed.data as BrainSource;
    if (!data || typeof data !== 'object' || data.abiVersion !== '2.0' || !data.states || !data.initialState) {
      setSourceError({ error: 'BrainSource không hợp lệ (cần abiVersion 2.0, states, initialState)', pointer: '/abiVersion' });
      return;
    }
    setSourceError(null);
    updateBrain(data);
  };

  const handleAddState = () => {
    const newStateId = `state_${brain.states.length + 1}`;
    const newBrain: BrainSource = {
      ...brain,
      states: [
        ...brain.states,
        {
          id: newStateId,
          rules: [
            {
              id: 'defaultRule',
              when: { kind: 'bool', value: true },
              intent: {
                thrust: { forward: { kind: 'const', value: 0 }, strafe: { kind: 'const', value: 0 } },
                turn: { kind: 'const', value: 0 },
                modules: [],
              },
            },
          ],
        },
      ],
    };
    updateBrain(newBrain);
    setSelectedStateId(newStateId);
  };

  const handleDeleteState = (stateId: string) => {
    if (brain.states.length <= 1) return;
    const remaining = brain.states.filter(s => s.id !== stateId);
    const newInitial = brain.initialState === stateId ? remaining[0]!.id : brain.initialState;
    updateBrain({
      ...brain,
      initialState: newInitial,
      states: remaining,
    });
    setSelectedStateId(remaining[0]!.id);
  };

  const handleAddRule = () => {
    if (!currentState) return;
    const newRuleId = `rule_${currentState.rules.length + 1}`;
    const newRule: InlineRule & { id: string } = {
      id: newRuleId,
      when: { kind: 'bool', value: true },
      intent: {
        thrust: { forward: { kind: 'const', value: 500 }, strafe: { kind: 'const', value: 0 } },
        turn: { kind: 'const', value: 0 },
        modules: [],
      },
    };
    const updatedStates = brain.states.map(s => {
      if (s.id !== currentState.id) return s;
      return { ...s, rules: [...s.rules, newRule] };
    });
    updateBrain({ ...brain, states: updatedStates });
    setSelectedRuleId(newRuleId);
  };

  const handleMoveRule = (ruleIdx: number, direction: 'up' | 'down') => {
    if (!currentState) return;
    const newRules = [...currentState.rules];
    const targetIdx = direction === 'up' ? ruleIdx - 1 : ruleIdx + 1;
    if (targetIdx < 0 || targetIdx >= newRules.length) return;
    const temp = newRules[ruleIdx]!;
    newRules[ruleIdx] = newRules[targetIdx]!;
    newRules[targetIdx] = temp;

    const updatedStates = brain.states.map(s => (s.id === currentState.id ? { ...s, rules: newRules } : s));
    updateBrain({ ...brain, states: updatedStates });
  };

  const handleDeleteRule = (ruleIdx: number) => {
    if (!currentState || currentState.rules.length <= 1) return;
    const newRules = currentState.rules.filter((_, idx) => idx !== ruleIdx);
    const updatedStates = brain.states.map(s => (s.id === currentState.id ? { ...s, rules: newRules } : s));
    updateBrain({ ...brain, states: updatedStates });
    setSelectedRuleId(null);
  };

  const currentTrace = traces[traceIndex];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Bar Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tabs
          tabs={[
            { id: 'visual', label: 'Trình biên tập FSM & Rules' },
            { id: 'source', label: 'Nguồn JSON (Source ABI)' },
            { id: 'trace', label: `Decision Trace (${traces.length} steps)` },
          ]}
          activeId={activeTab}
          onChange={id => setActiveTab(id as 'visual' | 'source' | 'trace')}
        />
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          ABI Version: <strong>2.0</strong> · Gas Budget: <strong>4096 / decision</strong>
        </div>
      </div>

      {activeTab === 'visual' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
          {/* Left: States list */}
          <div>
            <Card variant="surface1">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="panel-title" style={{ fontSize: 16 }}>Danh sách States</span>
                <Button size="sm" variant="secondary" onClick={handleAddState}>+ Thêm State</Button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {brain.states.map(s => {
                  const isInitial = s.id === brain.initialState;
                  const isSelected = s.id === selectedStateId;
                  const isUnreachable = diagnostics.unreachableStates.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => { setSelectedStateId(s.id); setSelectedRuleId(null); }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-field)',
                        backgroundColor: isSelected ? 'var(--color-surface3)' : 'var(--color-surface2)',
                        border: `1px solid ${isSelected ? 'var(--color-core)' : 'var(--color-line-quiet)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{s.id}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {s.rules.length} rules
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {isInitial && <Badge variant="core">Bắt đầu</Badge>}
                        {isUnreachable && !isInitial && <Badge variant="warning">Chưa gọi</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {currentState && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--color-line-quiet)', paddingTop: 12 }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateBrain({ ...brain, initialState: currentState.id })}
                    disabled={currentState.id === brain.initialState}
                    style={{ width: '100%', marginBottom: 6 }}
                  >
                    Đặt làm Initial State
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDeleteState(currentState.id)}
                    disabled={brain.states.length <= 1}
                    style={{ width: '100%' }}
                  >
                    Xóa State này
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Right: Rules Editor for Selected State */}
          <div>
            <Card variant="surface1">
              {currentState ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h2 className="panel-title">Quy tắc trong State: <code style={{ color: 'var(--color-core)' }}>{currentState.id}</code></h2>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        Quy tắc khớp đầu tiên từ trên xuống sẽ được thực thi (Priority 1..N).
                      </div>
                    </div>
                    <Button size="sm" variant="primary" onClick={handleAddRule}>+ Thêm Quy tắc (Rule)</Button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {currentState.rules.map((rule, idx) => {
                      const isDead = diagnostics.deadRules.some(d => d.stateId === currentState.id && d.ruleId === rule.id);
                      const isInline = 'intent' in rule && 'when' in rule;
                      const nextStateStr = isInline && rule.nextState ? (typeof rule.nextState === 'string' ? rule.nextState : rule.nextState.parameter) : undefined;
                      return (
                        <div
                          key={rule.id}
                          style={{
                            border: `1px solid ${isDead ? 'var(--color-danger)' : 'var(--color-line-quiet)'}`,
                            borderRadius: 'var(--radius-field)',
                            padding: 16,
                            backgroundColor: 'var(--color-surface2)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Badge variant="neutral">#{idx + 1}</Badge>
                              <strong style={{ fontFamily: 'var(--font-mono)' }}>{rule.id}</strong>
                              {isDead && <Badge variant="danger">Quy tắc chết (Dead rule)</Badge>}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Button size="sm" variant="ghost" onClick={() => handleMoveRule(idx, 'up')} disabled={idx === 0} title="Đẩy lên">
                                ↑
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleMoveRule(idx, 'down')} disabled={idx === currentState.rules.length - 1} title="Hạ xuống">
                                ↓
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => handleDeleteRule(idx)} disabled={currentState.rules.length <= 1} title="Xóa rule">
                                ✕
                              </Button>
                            </div>
                          </div>

                          {/* Quick Summary of Condition & Intent */}
                          {isInline ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                              <div>
                                <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Điều kiện (When):</div>
                                <code style={{ background: 'var(--color-void)', padding: '4px 8px', borderRadius: 4, display: 'block' }}>
                                  {JSON.stringify(rule.when)}
                                </code>
                              </div>
                              <div>
                                <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Hành vi (Intent):</div>
                                <code style={{ background: 'var(--color-void)', padding: '4px 8px', borderRadius: 4, display: 'block' }}>
                                  thrust: {JSON.stringify(rule.intent.thrust)} | turn: {JSON.stringify(rule.intent.turn)}
                                  {rule.intent.modules.length > 0 && ` | modules: ${rule.intent.modules.length}`}
                                </code>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 13 }}>
                              <code style={{ background: 'var(--color-void)', padding: '4px 8px', borderRadius: 4 }}>
                                Call skill: {(rule as { useSkill: string }).useSkill}
                              </code>
                            </div>
                          )}

                          {nextStateStr && (
                            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-info)' }}>
                              ↳ Chuyển sang State: <strong>{nextStateStr}</strong>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>Chọn một state để xem quy tắc.</div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* JSON Source ABI Tab */}
      {activeTab === 'source' && (
        <Card variant="surface1">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="panel-title">Nguồn JSON của Brain (ABI 2.0)</div>
            <Button variant="primary" onClick={handleApplySource}>Áp dụng thay đổi</Button>
          </div>
          <TextArea
            rows={20}
            value={sourceText}
            onChange={e => setSourceText(e.target.value)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
          {sourceError && (
            <div className="error-pointer-box" role="alert">
              <div><strong>Lỗi JSON:</strong> {sourceError.error}</div>
              {sourceError.pointer && (
                <div style={{ marginTop: 4 }}>
                  Vị trí (JSON pointer): <code className="error-pointer-code">{sourceError.pointer}</code>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Decision Trace Viewer Tab */}
      {activeTab === 'trace' && (
        <Card variant="surface1">
          <div className="panel-title" style={{ marginBottom: 12 }}>Decision Trace (Nhịp quyết định 10 Hz)</div>
          {traces.length > 0 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <Button size="sm" variant="secondary" onClick={() => setTraceIndex(Math.max(0, traceIndex - 1))} disabled={traceIndex === 0}>
                  ◀ Tick trước
                </Button>
                <div style={{ flex: 1 }}>
                  <input
                    type="range"
                    min={0}
                    max={traces.length - 1}
                    value={traceIndex}
                    onChange={e => setTraceIndex(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--color-core)' }}
                  />
                </div>
                <Button size="sm" variant="secondary" onClick={() => setTraceIndex(Math.min(traces.length - 1, traceIndex + 1))} disabled={traceIndex >= traces.length - 1}>
                  Tick sau ▶
                </Button>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  Tick: {currentTrace?.tick} (Step {traceIndex + 1}/{traces.length})
                </span>
              </div>

              {currentTrace && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  <Card variant="surface2">
                    <div style={{ fontWeight: 650, marginBottom: 6 }}>Trạng thái & Quy tắc</div>
                    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div>State: <strong style={{ color: 'var(--color-core)' }}>{currentTrace.stateId}</strong></div>
                      <div>Winning Rule: <code>{currentTrace.ruleId}</code></div>
                      <div>Gas tiêu thụ: <strong>{currentTrace.gas} / 4096</strong></div>
                      <div>Fault: {currentTrace.fault ? <Badge variant="danger">FAULT</Badge> : <Badge variant="success">OK</Badge>}</div>
                    </div>
                  </Card>

                  <Card variant="surface2">
                    <div style={{ fontWeight: 650, marginBottom: 6 }}>Cảm biến quan sát (Sensors)</div>
                    <div style={{ maxHeight: 150, overflowY: 'auto', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      {currentTrace.observationsUsed.length > 0 ? (
                        currentTrace.observationsUsed.map((sensor, i) => (
                          <div key={i}>{sensor}</div>
                        ))
                      ) : (
                        <div style={{ color: 'var(--color-text-muted)' }}>Không có cảm biến được đọc</div>
                      )}
                    </div>
                  </Card>

                  <Card variant="surface2">
                    <div style={{ fontWeight: 650, marginBottom: 6 }}>Biến thay đổi (Variable Diff)</div>
                    <div style={{ maxHeight: 150, overflowY: 'auto', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      {Object.keys(currentTrace.varDiff).length > 0 ? (
                        Object.entries(currentTrace.varDiff).map(([k, v]) => (
                          <div key={k}>{k}: {String(v)}</div>
                        ))
                      ) : (
                        <div style={{ color: 'var(--color-text-muted)' }}>Không có biến thay đổi</div>
                      )}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-muted)', padding: '24px 0', textAlign: 'center' }}>
              Chưa có dữ liệu Decision Trace. Hãy chạy một trận thử đấu (Practice) hoặc thí nghiệm để thu thập trace.
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
