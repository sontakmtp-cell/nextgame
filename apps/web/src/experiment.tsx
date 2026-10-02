import React, { useState } from 'react';
import type { BotDefinition } from '@prompt-chien/contracts';
import { Button, Card, Select } from './design-system.js';
import { workerBridge } from './worker-bridge.js';
import type { ExperimentRunResult, SimulationPayload } from './types.js';
import { BASTION_LITE_BOT, KESTREL_BOT, MANTIS_BOT } from './presets.js';

interface ExperimentProps {
  currentBot: BotDefinition;
  onApplyCandidate: (candidate: BotDefinition) => void;
  onViewReplay: (replay: SimulationPayload) => void;
}

export const Experiment: React.FC<ExperimentProps> = ({
  currentBot,
  onApplyCandidate,
  onViewReplay,
}) => {
  const [opponentName, setOpponentName] = useState<string>('Kestrel');
  const [scenarioCount, setScenarioCount] = useState<number>(5);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<ExperimentRunResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Candidate variation (e.g. modified tuning or defensive variant)
  const [candidateVariant, setCandidateVariant] = useState<string>('adaptive_kiting');

  const opponent =
    opponentName === 'Mantis' ? MANTIS_BOT
    : opponentName === 'Bastion-lite' ? BASTION_LITE_BOT
    : KESTREL_BOT;

  // Build candidate based on variant choice
  const getCandidateBot = (): BotDefinition => {
    if (candidateVariant === 'passive') {
      const firstRule = currentBot.brain.states[0]?.rules[0];
      const modules = firstRule && 'intent' in firstRule ? firstRule.intent.modules : [];
      return {
        ...currentBot,
        name: `${currentBot.name} (Passive)`,
        brain: {
          ...currentBot.brain,
          states: [
            {
              id: 'hunt',
              rules: [
                {
                  id: 'fixedDrive',
                  when: { kind: 'bool', value: true },
                  intent: {
                    thrust: { forward: { kind: 'const', value: 1000 }, strafe: { kind: 'const', value: 0 } },
                    turn: { kind: 'const', value: 0 },
                    modules,
                  },
                },
              ],
            },
          ],
        },
      };
    }
    // Evasive variant
    return {
      ...currentBot,
      name: `${currentBot.name} (Evasive)`,
      brain: {
        ...currentBot.brain,
        states: currentBot.brain.states.map(s => ({
          ...s,
          rules: s.rules.map(r => {
            if (r.id === 'evadeWindup' && 'intent' in r) {
              return {
                ...r,
                intent: {
                  ...r.intent,
                  thrust: { forward: { kind: 'const', value: -400 }, strafe: { kind: 'const', value: 1000 } },
                },
              };
            }
            return r;
          }),
        })),
      },
    };
  };

  const candidateBot = getCandidateBot();

  const handleRunExperiment = async () => {
    setIsRunning(true);
    setProgress({ current: 0, total: scenarioCount });
    setErrorMessage(null);
    try {
      const expResult = await workerBridge.runExperiment(
        currentBot,
        candidateBot,
        opponent,
        scenarioCount,
        (current, total) => setProgress({ current, total })
      );
      setResult(expResult);
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h2 className="panel-title">Thí nghiệm A/B Đối chứng (Paired Local Experiments)</h2>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          So sánh phương án Baseline (Hiện tại) vs Candidate trên cùng bộ seed và đổi vị trí slot xuất phát (Leg 1/2) qua Web Worker.
        </div>
      </div>

      {errorMessage && (
        <Card variant="surface2" style={{ borderColor: 'var(--color-danger)' }}>
          <div style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Lỗi thí nghiệm: {errorMessage}</div>
        </Card>
      )}

      {/* Configuration Card */}
      <Card variant="surface1">
        <div className="panel-title" style={{ fontSize: 16, marginBottom: 16 }}>Cấu hình kịch bản thử nghiệm</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>Bản đối chứng (Baseline):</div>
            <div style={{ fontWeight: 650 }}>{currentBot.name} (Nháp hiện tại)</div>
          </div>

          <div>
            <Select
              label="Biến thể ứng viên (Candidate):"
              value={candidateVariant}
              onChange={e => setCandidateVariant(e.target.value)}
              options={[
                { value: 'adaptive_kiting', label: 'Evasive (Tăng tốc độ né khi telegraph)' },
                { value: 'passive', label: 'Passive (Chỉ lao thẳng, không thích nghi)' },
              ]}
            />
          </div>

          <div>
            <Select
              label="Đối thủ tiêu chuẩn (Benchmark):"
              value={opponentName}
              onChange={e => setOpponentName(e.target.value)}
              options={[
                { value: 'Kestrel', label: 'Kestrel (Burst Kiter tầm xa)' },
                { value: 'Bastion-lite', label: 'Bastion-lite (Khiên & Blade cận chiến)' },
                { value: 'Mantis', label: 'Mantis (Blade cơ động)' },
              ]}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: 220 }}>
            <Select
              label="Số kịch bản đối chứng (Scenarios):"
              value={String(scenarioCount)}
              onChange={e => setScenarioCount(Number(e.target.value))}
              options={[
                { value: '5', label: '5 scenarios (10 legs)' },
                { value: '10', label: '10 scenarios (20 legs)' },
                { value: '20', label: '20 scenarios (40 legs)' },
              ]}
            />
          </div>

          <div>
            <Button
              variant="primary"
              onClick={handleRunExperiment}
              disabled={isRunning}
            >
              {isRunning ? `Đang tính (${progress?.current}/${progress?.total})…` : 'Chạy thí nghiệm A/B'}
            </Button>
          </div>
        </div>

        {isRunning && progress && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span>Tiến độ Worker: {progress.current} / {progress.total} scenarios</span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div style={{ height: 8, backgroundColor: 'var(--color-void)', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                  height: '100%',
                  backgroundColor: 'var(--color-core)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Results Card */}
      {result && (
        <Card variant="surface1">
          <div className="panel-title" style={{ fontSize: 16, marginBottom: 16 }}>Kết quả đối chứng A/B</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            <div style={{ backgroundColor: 'var(--color-surface2)', padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Điểm trung bình Baseline</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 4 }}>
                {result.baselineMeanScore}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--color-surface2)', padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Điểm trung bình Candidate</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 4 }}>
                {result.candidateMeanScore}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--color-surface2)', padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Chênh lệch điểm (Delta)</div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: result.scoreDelta >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                  marginTop: 4,
                }}
              >
                {result.scoreDelta > 0 ? `+${result.scoreDelta}` : result.scoreDelta}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--color-surface2)', padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Tỷ lệ thắng (W / D / L)</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
                <span style={{ color: 'var(--color-success)' }}>{result.candidateWins}W</span> ·{' '}
                <span style={{ color: 'var(--color-text-muted)' }}>{result.draws}D</span> ·{' '}
                <span style={{ color: 'var(--color-danger)' }}>{result.baselineWins}L</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {result.representativeReplay && (
              <Button
                variant="primary"
                onClick={() => onViewReplay(result.representativeReplay!)}
              >
                🎬 Xem Replay trận tiêu biểu (Scenario {result.representativeScenarioIndex + 1})
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => onApplyCandidate(candidateBot)}
            >
              Áp dụng Candidate làm bản chính
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
