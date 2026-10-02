import React, { useState, useEffect, useCallback } from 'react';
import type { BotDefinition, Placement } from '@prompt-chien/contracts';
import { Button, Card, Badge, Modal, TextArea } from './design-system.js';
import { CATALOG_ENTRIES, validateBotStructure, parseJsonWithPointer } from './validation.js';
import { MANTIS_BOT, BASTION_LITE_BOT, KESTREL_BOT } from './presets.js';

interface WorkshopProps {
  bot: BotDefinition;
  onChange: (updated: BotDefinition) => void;
  onValidate: () => void;
  isValidating?: boolean;
}

export const Workshop: React.FC<WorkshopProps> = ({
  bot,
  onChange,
  onValidate,
  isValidating = false,
}) => {
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('armor');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);

  // Undo / Redo history stack
  const [history, setHistory] = useState<Placement[][]>([bot.body.modules]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Import / Export modal
  const [modalMode, setModalMode] = useState<'import' | 'export' | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<{ error: string; pointer?: string | undefined } | null>(null);

  const modules = bot.body.modules;
  const diagnostics = validateBotStructure(bot);

  const selectedModule = modules.find(m => m.id === selectedModuleId);

  const pushModules = useCallback((newModules: Placement[]) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(newModules);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    onChange({
      ...bot,
      body: {
        ...bot.body,
        modules: newModules,
      },
    });
  }, [bot, history, historyIndex, onChange]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1]!;
      setHistoryIndex(historyIndex - 1);
      onChange({ ...bot, body: { ...bot.body, modules: prev } });
    }
  }, [bot, history, historyIndex, onChange]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1]!;
      setHistoryIndex(historyIndex + 1);
      onChange({ ...bot, body: { ...bot.body, modules: next } });
    }
  }, [bot, history, historyIndex, onChange]);

  // Keyboard controls: R to rotate, Delete/Backspace to remove, D to duplicate, Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (!selectedModule) return;

      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        const newOrientation = ((selectedModule.orientation + 1) % 4) as 0 | 1 | 2 | 3;
        const updated = modules.map(m => m.id === selectedModule.id ? { ...m, orientation: newOrientation } : m);
        pushModules(updated);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedModule.catalogId === 'core') return;
        e.preventDefault();
        pushModules(modules.filter(m => m.id !== selectedModule.id));
        setSelectedModuleId(null);
      } else if (e.key.toLowerCase() === 'd') {
        if (selectedModule.catalogId === 'core') return;
        e.preventDefault();
        const nextCell = { x: Math.min(11, selectedModule.cell.x + 1), y: selectedModule.cell.y };
        const dupId = `mod_${Date.now() % 10000}`;
        pushModules([...modules, { ...selectedModule, id: dupId, cell: nextCell }]);
        setSelectedModuleId(dupId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedModule, modules, pushModules, handleUndo, handleRedo]);

  const getOccupantAt = (x: number, y: number): Placement | undefined => {
    return modules.find(m => {
      const footprint = m.catalogId === 'core' ? 2 : 1;
      return x >= m.cell.x && x < m.cell.x + footprint && y >= m.cell.y && y < m.cell.y + footprint;
    });
  };

  const handleCellClick = (x: number, y: number) => {
    const existing = getOccupantAt(x, y);
    if (existing) {
      setSelectedModuleId(existing.id);
      return;
    }

    const entry = CATALOG_ENTRIES.find(c => c.id === selectedCatalogId);
    if (!entry || !entry.enabled) return;

    if (entry.id === 'core') {
      if (modules.some(m => m.catalogId === 'core')) return;
    }

    const newId = `${selectedCatalogId}_${Date.now() % 10000}`;
    const newModule: Placement = {
      id: newId,
      catalogId: selectedCatalogId,
      cell: { x, y },
      orientation: 0,
    };

    pushModules([...modules, newModule]);
    setSelectedModuleId(newId);
  };

  const openImportModal = () => {
    setJsonText('');
    setJsonError(null);
    setModalMode('import');
  };

  const openExportModal = () => {
    setJsonText(JSON.stringify(bot, null, 2));
    setJsonError(null);
    setModalMode('export');
  };

  const handleImportSubmit = () => {
    const parsed = parseJsonWithPointer(jsonText);
    if (parsed.error) {
      setJsonError({ error: parsed.error, pointer: parsed.pointer ?? undefined });
      return;
    }
    const data = parsed.data as BotDefinition;
    if (!data || typeof data !== 'object' || data.schemaVersion !== '2.0' || !data.body || !data.brain) {
      setJsonError({ error: 'Định dạng BotDefinition không đúng chuẩn v2.0 (cần schemaVersion 2.0, body, brain)', pointer: '/schemaVersion' });
      return;
    }

    pushModules(data.body.modules);
    onChange(data);
    setModalMode(null);
  };

  const glyphMap: Record<string, string> = {
    core: 'C',
    thruster: 'T',
    armor: 'A',
    blade: 'B',
    burst: 'U',
    shield: 'S',
    radiator: 'R',
    capacitor: 'E',
    lance: 'L',
    breaker: 'K',
  };

  return (
    <div>
      {/* Mobile summary warning banner */}
      <div className="mobile-banner">
        <span>ℹ️</span>
        <div>
          <strong>Chế độ Workshop:</strong> Trình dựng lưới 12×12 tối ưu cho Desktop/Tablet. Bạn có thể chọn ô để xem chỉ số, đổi hướng (R), xóa (Del), hoặc nạp các mẫu sẵn.
        </div>
      </div>

      <div className="workshop-container">
        {/* Left: Palette */}
        <div>
          <Card variant="surface1">
            <div className="panel-title" style={{ marginBottom: 12 }}>Bảng Module</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {CATALOG_ENTRIES.map(entry => {
                const count = modules.filter(m => m.catalogId === entry.id).length;
                const isSelected = selectedCatalogId === entry.id;
                return (
                  <button
                    key={entry.id}
                    disabled={!entry.enabled}
                    onClick={() => setSelectedCatalogId(entry.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-field)',
                      backgroundColor: isSelected ? 'var(--color-surface3)' : 'var(--color-surface2)',
                      border: `1px solid ${isSelected ? 'var(--color-core)' : 'var(--color-line-quiet)'}`,
                      cursor: entry.enabled ? 'pointer' : 'not-allowed',
                      opacity: entry.enabled ? 1 : 0.45,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          backgroundColor: entry.id === 'core' ? 'var(--color-core)' : 'var(--color-ceramic)',
                          color: 'var(--color-void)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {glyphMap[entry.id]}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{entry.id}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {entry.cost} điểm · {entry.mass} kg
                        </div>
                      </div>
                    </div>
                    <Badge variant={count > 0 ? 'info' : 'neutral'}>
                      {count}/{entry.max}
                    </Badge>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 16, borderTop: '1px solid var(--color-line-quiet)', paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>Mẫu Synth nhanh:</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="sm" variant="ghost" onClick={() => { pushModules(MANTIS_BOT.body.modules); onChange({ ...bot, body: MANTIS_BOT.body }); }}>
                  Mantis
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { pushModules(BASTION_LITE_BOT.body.modules); onChange({ ...bot, body: BASTION_LITE_BOT.body }); }}>
                  Bastion
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { pushModules(KESTREL_BOT.body.modules); onChange({ ...bot, body: KESTREL_BOT.body }); }}>
                  Kestrel
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Center: 12x12 Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid-board-outer">
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 470, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="sm" variant="secondary" onClick={handleUndo} disabled={historyIndex === 0} title="Hoàn tác (Ctrl+Z)">
                  ↶ Undo
                </Button>
                <Button size="sm" variant="secondary" onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="Làm lại (Ctrl+Y)">
                  ↷ Redo
                </Button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="sm" variant="ghost" onClick={openImportModal}>
                  Import JSON
                </Button>
                <Button size="sm" variant="ghost" onClick={openExportModal}>
                  Export JSON
                </Button>
              </div>
            </div>

            {/* 12x12 Grid Board */}
            <div
              className="grid-12x12"
              onMouseLeave={() => setHoverCell(null)}
              role="grid"
              aria-label="Lưới lắp ghép Synth 12x12"
            >
              {Array.from({ length: 12 }).map((_, y) => (
                <React.Fragment key={y}>
                  {Array.from({ length: 12 }).map((__, x) => {
                    const occ = getOccupantAt(x, y);
                    const isSelected = occ && occ.id === selectedModuleId;
                    const isCore = occ && occ.catalogId === 'core';
                    const isDisconnected = diagnostics.disconnectedCells.includes(`${x},${y}`);
                    const isOccluded = diagnostics.occlusions.some(o => o.cell.x === x && o.cell.y === y);

                    const isHover = hoverCell?.x === x && hoverCell?.y === y;
                    let cellClass = 'grid-cell';
                    if (occ) {
                      cellClass += isCore ? ' cell-core' : ' cell-module';
                      if (isSelected) cellClass += ' cell-selected';
                      if (isDisconnected) cellClass += ' cell-disconnected';
                      else if (isOccluded) cellClass += ' cell-occluded';
                    } else if (isHover) {
                      cellClass += ' cell-ghost';
                    }

                    return (
                      <div
                        key={`${x},${y}`}
                        className={cellClass}
                        onMouseEnter={() => setHoverCell({ x, y })}
                        onClick={() => handleCellClick(x, y)}
                        role="gridcell"
                        aria-label={`Ô (${x}, ${y}) ${occ ? occ.id : 'trống'}`}
                      >
                        {occ && (
                          <span style={{ transform: `rotate(${occ.orientation * 90}deg)` }}>
                            {glyphMap[occ.catalogId] ?? '?'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
              Phím tắt: <strong>R</strong> xoay module · <strong>Del</strong> xóa · <strong>D</strong> nhân bản · <strong>Ctrl+Z</strong> hoàn tác
            </div>
          </div>

          {/* Occlusion & Validation Diagnostics List */}
          {diagnostics.occlusions.length > 0 && (
            <Card variant="surface2">
              <div style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: 6 }}>
                ⚠️ Cảnh báo che khuất (Occlusion Diagnostics):
              </div>
              <ul style={{ paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {diagnostics.occlusions.map((occ, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>{occ.warning}</li>
                ))}
              </ul>
            </Card>
          )}

          {diagnostics.errors.length > 0 && (
            <Card variant="surface2" style={{ borderColor: 'var(--color-danger)' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: 6 }}>
                ❌ Lỗi cấu trúc hợp lệ (Structure Diagnostics):
              </div>
              <ul style={{ paddingLeft: 18, fontSize: 13, color: 'var(--color-text-primary)' }}>
                {diagnostics.errors.map((err, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>
                    {err.message} {err.pointer && <code className="error-pointer-code">{err.pointer}</code>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Right: Inspector */}
        <div>
          <Card variant="surface1">
            <div className="panel-title" style={{ marginBottom: 16 }}>Chẩn đoán & Ngân sách</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>Số module (Cap 24):</span>
                  <strong style={{ color: modules.length > 24 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                    {modules.length} / 24
                  </strong>
                </div>
                <div style={{ height: 6, backgroundColor: 'var(--color-void)', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, (modules.length / 24) * 100)}%`,
                      height: '100%',
                      backgroundColor: modules.length > 24 ? 'var(--color-danger)' : 'var(--color-core)',
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>Điểm Build (Max 100):</span>
                  <strong style={{ color: diagnostics.pointCost > 100 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                    {diagnostics.pointCost} / 100
                  </strong>
                </div>
                <div style={{ height: 6, backgroundColor: 'var(--color-void)', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, (diagnostics.pointCost / 100) * 100)}%`,
                      height: '100%',
                      backgroundColor: diagnostics.pointCost > 100 ? 'var(--color-danger)' : 'var(--color-primary-action)',
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>Vũ khí tấn công (Max 3):</span>
                  <strong style={{ color: diagnostics.weaponsCount > 3 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                    {diagnostics.weaponsCount} / 3
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Tổng khối lượng:</span>
                <strong>{diagnostics.mass} kg</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, alignItems: 'center' }}>
                <span>Độ liền mạch (Connectivity):</span>
                <Badge variant={diagnostics.connected ? 'success' : 'danger'}>
                  {diagnostics.connected ? 'Đã nối toàn bộ' : 'Có module rời rạc'}
                </Badge>
              </div>
            </div>

            {/* Selected Module Detail */}
            {selectedModule ? (
              <div style={{ borderTop: '1px solid var(--color-line-quiet)', paddingTop: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
                  Module đang chọn: <code style={{ color: 'var(--color-core)' }}>{selectedModule.id}</code>
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  <div>Loại: <strong style={{ textTransform: 'capitalize' }}>{selectedModule.catalogId}</strong></div>
                  <div>Tọa độ cell: ({selectedModule.cell.x}, {selectedModule.cell.y})</div>
                  <div>Góc xoay: {selectedModule.orientation * 90}° ({selectedModule.orientation})</div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const newOrientation = ((selectedModule.orientation + 1) % 4) as 0 | 1 | 2 | 3;
                      pushModules(modules.map(m => m.id === selectedModule.id ? { ...m, orientation: newOrientation } : m));
                    }}
                  >
                    Xoay (R)
                  </Button>
                  {selectedModule.catalogId !== 'core' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        pushModules(modules.filter(m => m.id !== selectedModule.id));
                        setSelectedModuleId(null);
                      }}
                    >
                      Xóa (Del)
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ borderTop: '1px solid var(--color-line-quiet)', paddingTop: 16, fontSize: 13, color: 'var(--color-text-muted)' }}>
                Bấm vào một module trên lưới để xem chi tiết hoặc xoay/xóa.
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <Button
                variant="primary"
                style={{ width: '100%' }}
                onClick={onValidate}
                disabled={isValidating}
              >
                {isValidating ? 'Đang kiểm tra…' : 'Kiểm tra với Worker'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Import / Export Modal */}
      <Modal
        isOpen={modalMode !== null}
        title={modalMode === 'import' ? 'Nhập BotDefinition JSON' : 'Xuất BotDefinition JSON'}
        onClose={() => setModalMode(null)}
        actions={
          modalMode === 'import' ? (
            <>
              <Button variant="ghost" onClick={() => setModalMode(null)}>Hủy</Button>
              <Button variant="primary" onClick={handleImportSubmit}>Nhập và áp dụng</Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => { void navigator.clipboard?.writeText(jsonText); setModalMode(null); }}>
              Sao chép & Đóng
            </Button>
          )
        }
      >
        <div>
          <TextArea
            label="Nội dung JSON"
            rows={14}
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
            readOnly={modalMode === 'export'}
          />
          {jsonError && (
            <div className="error-pointer-box" role="alert">
              <div><strong>Lỗi JSON:</strong> {jsonError.error}</div>
              {jsonError.pointer && (
                <div style={{ marginTop: 4 }}>
                  Vị trí (JSON pointer): <code className="error-pointer-code">{jsonError.pointer}</code>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
