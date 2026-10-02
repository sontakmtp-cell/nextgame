import React, { useState } from 'react';
import type { MatchResult, PublicFrame } from '@prompt-chien/contracts';
import { Button, Card, Badge, Modal, TextArea } from './design-system.js';
import type { TurningPoint } from './types.js';

interface DebriefProps {
  result?: MatchResult | undefined;
  frames?: PublicFrame[] | undefined;
  onSeekTick: (tick: number) => void;
  onCreateHypothesis: (hypothesis: string) => void;
}

export const Debrief: React.FC<DebriefProps> = ({
  result,
  frames = [],
  onSeekTick,
  onCreateHypothesis,
}) => {
  const [selectedPoint, setSelectedPoint] = useState<TurningPoint | null>(null);
  const [hypothesisText, setHypothesisText] = useState('');

  // Extract 3 key turning points from match frames & events
  const extractTurningPoints = (): TurningPoint[] => {
    const points: TurningPoint[] = [];

    // Search events across frames
    for (const frame of frames) {
      for (const evt of frame.events) {
        if (points.length === 0 && evt.kind === 'activation') {
          points.push({
            tick: evt.tick,
            title: 'Kích hoạt đòn tấn công đầu tiên',
            description: `Đội ${evt.actor} kích hoạt vũ khí m${evt.module} tại tick ${evt.tick} (${(evt.tick / 60).toFixed(1)}s)`,
            kind: 'windup',
            event: evt,
          });
        }
        if (points.length < 2 && evt.kind === 'destroyed') {
          points.push({
            tick: evt.tick,
            title: 'Module đầu tiên bị phá huỷ',
            description: `Module m${evt.module} của Đội ${evt.actor} bị phá hủy tại tick ${evt.tick}`,
            kind: 'module_broken',
            event: evt,
          });
        }
        if (points.length < 3 && (evt.kind === 'ringDamage' || evt.kind === 'result')) {
          points.push({
            tick: evt.tick,
            title: evt.kind === 'ringDamage' ? 'Sát thương từ vòng bo arena' : 'Kết thúc trận đấu',
            description: `Sự kiện định đoạt kết quả tại tick ${evt.tick} (${(evt.tick / 60).toFixed(1)}s)`,
            kind: evt.kind === 'ringDamage' ? 'ring' : 'core_critical',
            event: evt,
          });
        }
        if (points.length >= 3) break;
      }
      if (points.length >= 3) break;
    }

    // Fallbacks if events are sparse
    if (points.length === 0 && frames.length > 0) {
      points.push({
        tick: 0,
        title: 'Bắt đầu trận',
        description: 'Hai Synth xuất phát từ hai slot đối xứng',
        kind: 'windup',
      });
      if (frames.length > 600) {
        points.push({
          tick: 600,
          title: 'Điểm kiểm soát trung tâm kích hoạt',
          description: 'Tick 600: Objective trung tâm bắt đầu tích điểm',
          kind: 'hit',
        });
      }
      points.push({
        tick: frames.length - 1,
        title: 'Trận đấu kết thúc',
        description: `Thời gian trôi qua: ${(frames.length / 60).toFixed(1)}s`,
        kind: 'core_critical',
      });
    }

    return points;
  };

  const turningPoints = extractTurningPoints();

  const handleOpenHypothesisModal = (pt: TurningPoint) => {
    setSelectedPoint(pt);
    setHypothesisText(`Sau khi quan sát bước ngoặt tại ${(pt.tick / 60).toFixed(1)}s (${pt.title}): Cần điều chỉnh hành vi né tránh sớm hơn 12 tick để không bị trúng đòn...`);
  };

  const handleSubmitHypothesis = () => {
    onCreateHypothesis(hypothesisText);
    setSelectedPoint(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h2 className="panel-title">Phân tích Trận đấu (Match Debrief)</h2>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Xem lại kết quả, 3 bước ngoặt lớn trong trận và biến quan sát thành giả thuyết cải tiến mới.
        </div>
      </div>

      {result ? (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
          {/* Left: Result Summary */}
          <Card variant="surface1">
            <div className="panel-title" style={{ fontSize: 16, marginBottom: 16 }}>Tổng kết Kết quả</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>Kết quả chung cuộc:</span>
                <Badge variant={result.winner === 'A' ? 'teamA' : result.winner === 'B' ? 'teamB' : 'neutral'}>
                  {result.winner === 'A' ? 'Đội A Thắng' : result.winner === 'B' ? 'Đội B Thắng' : 'Hòa'}
                </Badge>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Nguyên nhân kết thúc:</span>
                <code>{result.cause}</code>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Thời gian thi đấu:</span>
                <strong>{(result.elapsedTicks / 60).toFixed(2)} giây</strong>
              </div>

              <div style={{ borderTop: '1px solid var(--color-line-quiet)', paddingTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Điểm số chi tiết (Scores):</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-team-a)' }}>
                  <span>Đội A (Ta):</span>
                  <strong>{result.scores.A} điểm</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-team-b)', marginTop: 4 }}>
                  <span>Đội B (Đối thủ):</span>
                  <strong>{result.scores.B} điểm</strong>
                </div>
              </div>
            </div>
          </Card>

          {/* Right: 3 Key Turning Points */}
          <Card variant="surface1">
            <div className="panel-title" style={{ fontSize: 16, marginBottom: 16 }}>
              3 Bước ngoặt Chiến thuật (Key Turning Points)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {turningPoints.map((pt, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'var(--color-surface2)',
                    border: '1px solid var(--color-line-quiet)',
                    borderRadius: 'var(--radius-field)',
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge variant="core">Bước ngoặt #{idx + 1}</Badge>
                      <strong style={{ fontSize: 14 }}>{pt.title}</strong>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {(pt.tick / 60).toFixed(1)}s (Tick {pt.tick})
                    </span>
                  </div>

                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                    {pt.description}
                  </p>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onSeekTick(pt.tick)}
                    >
                      ⏱ Tua Arena tới tick này
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleOpenHypothesisModal(pt)}
                    >
                      💡 Tạo giả thuyết từ bước ngoặt này
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <Card variant="surface1" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
          Chưa có dữ liệu trận đấu. Hãy chạy một trận đấu (Practice) hoặc thí nghiệm A/B để xem phân tích debrief.
        </Card>
      )}

      {/* Hypothesis Creation Modal */}
      <Modal
        isOpen={selectedPoint !== null}
        title="Biến bước ngoặt thành Giả thuyết Cải tiến"
        onClose={() => setSelectedPoint(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setSelectedPoint(null)}>Hủy</Button>
            <Button variant="primary" onClick={handleSubmitHypothesis} disabled={!hypothesisText.trim()}>
              Lưu vào Behavior Card & Chuyển sang Thí nghiệm A/B
            </Button>
          </>
        }
      >
        <div>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
            Bước ngoặt: <strong>{selectedPoint?.title}</strong> tại tick {selectedPoint?.tick} ({(Number(selectedPoint?.tick ?? 0) / 60).toFixed(1)}s)
          </p>
          <TextArea
            label="Nội dung giả thuyết chiến thuật mới:"
            rows={4}
            value={hypothesisText}
            onChange={e => setHypothesisText(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};
