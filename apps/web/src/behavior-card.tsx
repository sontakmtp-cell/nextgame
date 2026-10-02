import React, { useState, useEffect } from 'react';
import type { DraftBot, RevisionRecord, BehaviorCard as IBehaviorCard } from './types.js';
import { Button, Card, Badge, TextArea, Input, Modal } from './design-system.js';
import { freezeRevision, getRevisions } from './storage.js';

interface BehaviorCardProps {
  draft: DraftBot;
  onChange: (updated: DraftBot) => void;
}

export const BehaviorCard: React.FC<BehaviorCardProps> = ({ draft, onChange }) => {
  const [card, setCard] = useState<IBehaviorCard>(draft.behaviorCard);
  const [revisions, setRevisions] = useState<RevisionRecord[]>([]);
  const [freezeSummary, setFreezeSummary] = useState('');
  const [isFreezeModalOpen, setIsFreezeModalOpen] = useState(false);
  const [compareRev, setCompareRev] = useState<RevisionRecord | null>(null);

  useEffect(() => {
    setCard(draft.behaviorCard);
    void getRevisions(draft.id).then(setRevisions);
  }, [draft]);

  const updateCardField = (field: keyof IBehaviorCard, value: string) => {
    const updated = { ...card, [field]: value };
    setCard(updated);
    onChange({ ...draft, behaviorCard: updated });
  };

  const handleFreeze = async () => {
    if (!freezeSummary.trim()) return;
    const rev = await freezeRevision(draft, freezeSummary.trim());
    setRevisions([rev, ...revisions]);
    onChange({
      ...draft,
      revision: rev.revision,
      parentRevision: draft.revision,
    });
    setFreezeSummary('');
    setIsFreezeModalOpen(false);
  };

  const handleRestore = (rev: RevisionRecord) => {
    onChange({
      ...draft,
      definition: structuredClone(rev.definition),
      behaviorCard: structuredClone(rev.behaviorCard),
    });
    setCompareRev(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="panel-title">Behavior Card & Lịch sử Lineage</h2>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Mô tả chiến thuật và theo dõi sự tiến hóa của Synth qua các phiên bản (Revision CAS).
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Badge variant="core">Bản nháp hiện tại: v{draft.revision}</Badge>
          <Button variant="primary" onClick={() => setIsFreezeModalOpen(true)}>
            🔒 Khóa Revision mới
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
        {/* Left: Behavior Card Editor */}
        <Card variant="surface1">
          <div className="panel-title" style={{ marginBottom: 16 }}>Behavior Card (Thẻ bản sắc hành vi)</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <TextArea
                label="Giả thuyết chiến thuật (Tactical Hypothesis)"
                rows={3}
                value={card.hypothesis}
                onChange={e => updateCardField('hypothesis', e.target.value)}
                placeholder="VD: Nhử đối thủ đánh trước, né cú chém bằng strafe rồi phản công bằng Blade..."
              />
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Giả thuyết mà bạn và AI muốn kiểm chứng trên đấu trường.
              </div>
            </div>

            <div>
              <TextArea
                label="Điều kiện tấn công (Attack Conditions)"
                rows={2}
                value={card.attackConditions}
                onChange={e => updateCardField('attackConditions', e.target.value)}
                placeholder="VD: Khi khoảng cách < 5000 và đối thủ vừa kết thúc đòn tấn công..."
              />
            </div>

            <div>
              <TextArea
                label="Chiến thuật khi mất bộ phận (Part-Loss Tactics)"
                rows={2}
                value={card.partLossTactics}
                onChange={e => updateCardField('partLossTactics', e.target.value)}
                placeholder="VD: Khi mất vũ khí chính, lui về giữ tâm sân để tính điểm kiểm soát..."
              />
            </div>

            <div>
              <TextArea
                label="Điểm yếu dự kiến (Expected Weaknesses)"
                rows={2}
                value={card.expectedWeaknesses}
                onChange={e => updateCardField('expectedWeaknesses', e.target.value)}
                placeholder="VD: Dễ bị Burst thả diều ở góc mở; tiêu hao nhiều năng lượng khi bật khiên..."
              />
            </div>
          </div>
        </Card>

        {/* Right: Lineage Revisions List */}
        <Card variant="surface1">
          <div className="panel-title" style={{ marginBottom: 16 }}>Lịch sử Revisions ({revisions.length})</div>

          {revisions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 500, overflowY: 'auto' }}>
              {revisions.map(rev => (
                <div
                  key={rev.revision}
                  style={{
                    backgroundColor: 'var(--color-surface2)',
                    border: '1px solid var(--color-line-quiet)',
                    borderRadius: 'var(--radius-field)',
                    padding: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Badge variant="teamA">v{rev.revision}</Badge>
                      <strong style={{ fontSize: 13 }}>{rev.summary}</strong>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                    {new Date(rev.timestamp).toLocaleString()} · {rev.definition.body.modules.length} modules
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button size="sm" variant="secondary" onClick={() => setCompareRev(rev)}>
                      So sánh (Diff)
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleRestore(rev)}>
                      Khôi phục
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              Chưa có revision nào được khóa. Bấm "Khóa Revision mới" để lưu mốc snapshot.
            </div>
          )}
        </Card>
      </div>

      {/* Freeze Revision Modal */}
      <Modal
        isOpen={isFreezeModalOpen}
        title={`Khóa Revision v${draft.revision} thành mốc bất biến`}
        onClose={() => setIsFreezeModalOpen(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setIsFreezeModalOpen(false)}>Hủy</Button>
            <Button variant="primary" onClick={handleFreeze} disabled={!freezeSummary.trim()}>
              Xác nhận khóa mốc
            </Button>
          </>
        }
      >
        <div>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Việc khóa revision sẽ tạo một bản ghi bất biến trong IndexedDB (Local Unofficial), ghi lại toàn bộ Body, Brain, và Behavior Card tại thời điểm này.
          </p>
          <Input
            label="Ghi chú tóm tắt thay đổi của Revision này"
            placeholder="VD: Thêm module khiên phòng thủ và rule né telegraph..."
            value={freezeSummary}
            onChange={e => setFreezeSummary(e.target.value)}
          />
        </div>
      </Modal>

      {/* Diff Modal */}
      <Modal
        isOpen={compareRev !== null}
        title={`So sánh: Nháp hiện tại (v${draft.revision}) vs Revision v${compareRev?.revision}`}
        onClose={() => setCompareRev(null)}
        actions={
          <Button variant="primary" onClick={() => setCompareRev(null)}>
            Đóng
          </Button>
        }
      >
        {compareRev && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 650, fontSize: 14, marginBottom: 6 }}>Khác biệt cấu trúc Body (Modules):</div>
              <div style={{ fontSize: 13, background: 'var(--color-void)', padding: 12, borderRadius: 6 }}>
                <div>Số lượng modules: <strong>{draft.definition.body.modules.length}</strong> (hiện tại) vs <strong>{compareRev.definition.body.modules.length}</strong> (v{compareRev.revision})</div>
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 650, fontSize: 14, marginBottom: 6 }}>Khác biệt Giả thuyết (Hypothesis Diff):</div>
              <div style={{ fontSize: 13, background: 'var(--color-void)', padding: 12, borderRadius: 6 }}>
                <div style={{ color: 'var(--color-danger)', marginBottom: 4 }}>
                  - v{compareRev.revision}: {compareRev.behaviorCard.hypothesis}
                </div>
                <div style={{ color: 'var(--color-success)' }}>
                  + Hiện tại: {draft.behaviorCard.hypothesis}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
