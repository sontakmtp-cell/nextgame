// PROMPT Chiến - Local A/B Experiment Suite (G2 Vertical Slice)
// Runs paired deterministic matches in the browser and displays hypothesis analytics.

import React, { useState } from 'react';
import { BotDefinition as WebBotDef } from '../../types/game';
import { MatchManifest, createCanonicalGameplay } from '@nextgame/contracts';
import { REFERENCE_BOTS, deriveScenarioFromSeed } from '@nextgame/content';
import { MatchSimulation } from '@nextgame/engine';
import { X, Play, RefreshCw, Trophy, Target, Shield, Flame, Activity } from 'lucide-react';

interface LocalExperimentModalProps {
  currentBot: WebBotDef;
  isOpen: boolean;
  onClose: () => void;
}

export const LocalExperimentModal: React.FC<LocalExperimentModalProps> = ({
  currentBot,
  isOpen,
  onClose,
}) => {
  const [selectedOpponentKey, setSelectedOpponentKey] = useState<string>('bastion');
  const [matchCount, setMatchCount] = useState<number>(20);
  const [hypothesis, setHypothesis] = useState<string>('Tăng tốc độ áp sát và sử dụng khiên theo nhịp telegraph sẽ tăng tỷ lệ thắng lên >60%.');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<{
    wins: number;
    losses: number;
    draws: number;
    totalRuns: number;
    avgTicks: number;
    avgDamage: number;
    avgControlTicks: number;
  } | null>(null);

  if (!isOpen) return null;

  const opponentDef = REFERENCE_BOTS[selectedOpponentKey] || REFERENCE_BOTS.bastion;

  const handleRunExperiment = () => {
    setIsRunning(true);

    // Run asynchronously to allow UI render
    setTimeout(() => {
      let wins = 0;
      let losses = 0;
      let draws = 0;
      let totalTicks = 0;
      let totalDamage = 0;
      let totalControl = 0;

      // Adapt currentBot to contracts BotDefinition
      const botAContract = {
        schemaVersion: '2.0' as const,
        name: currentBot.name,
        body: {
          grid: 'square-12-v1' as const,
          modules: currentBot.body.modules.map(m => ({
            id: m.id,
            catalogId: m.catalogId as any,
            cell: m.cell,
            orientation: m.orientation,
          })),
        },
        brain: {
          abiVersion: '2.0' as const,
          initialState: currentBot.brain.initialState || 'engage',
          variables: currentBot.brain.variables.map(v => ({ id: v.id, type: v.type, initial: v.initial })),
          skills: [],
          states: currentBot.brain.states.map(s => ({
            id: s.id,
            rules: s.rules.map(r => ({
              id: r.id,
              when: r.when as any,
              intent: {
                thrust: r.intent.thrust as any,
                turn: r.intent.turn as any,
                modules: r.intent.modules as any,
              },
              nextState: r.nextState,
            })),
          })),
        },
        cosmetic: { skinId: 'default', paletteId: 'red' },
      };

      const botBContract = opponentDef;

      const hashA = createCanonicalGameplay(botAContract).packageHash;
      const hashB = createCanonicalGameplay(botBContract).packageHash;

      for (let i = 0; i < matchCount; i++) {
        const seedBytes = new Uint8Array(16);
        seedBytes[0] = (i + 1) * 17;
        seedBytes[1] = (i + 1) * 41;

        const { scenarioId, preset } = deriveScenarioFromSeed(seedBytes);
        const manifest: MatchManifest = {
          engineDigest: 'sha256:alpha0_engine_v2',
          rulesetDigest: 'sha256:alpha0_ruleset_v2',
          catalogDigest: 'sha256:alpha0_catalog_v2',
          brainAbiVersion: '2.0',
          packageHashA: hashA,
          packageHashB: hashB,
          seed: Array.from(seedBytes).map(b => b.toString(16).padStart(2, '0')).join(''),
          scenarioId,
          presetValues: {
            yLeft: preset.yLeft,
            yRight: preset.yRight,
            jitterLeft: preset.jitterLeft,
            jitterRight: preset.jitterRight,
          },
          spawnSlotAssignment: i % 2 === 0 ? 'leg0_standard' : 'leg1_swapped',
          maxTicks: 5400,
        };

        const sim = new MatchSimulation(manifest, botAContract, botBContract);
        const outcome = sim.runToCompletion();

        totalTicks += sim.tick;
        totalDamage += sim.botA.resources.damageDealt;
        totalControl += sim.objectives.controlTicksA;

        if (outcome.winner === 'botA') wins++;
        else if (outcome.winner === 'botB') losses++;
        else draws++;
      }

      setResults({
        wins,
        losses,
        draws,
        totalRuns: matchCount,
        avgTicks: Math.round(totalTicks / matchCount),
        avgDamage: Math.round(totalDamage / matchCount),
        avgControlTicks: Math.round(totalControl / matchCount),
      });

      setIsRunning(false);
    }, 100);
  };

  const winRate = results ? Math.round((results.wins / results.totalRuns) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#141C24] border border-[#293640] rounded-2xl shadow-2xl p-6 text-[#F4F1E8]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#293640]">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#F1C86B]" />
              <span>Phòng Thử Nghiệm Đối Chứng A/B (Local Experiment)</span>
            </h2>
            <p className="text-xs text-[#94A1AB]">
              Chạy hàng loạt trận đấu tất định 60 Hz để kiểm định giả thuyết chiến thuật
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A1AB] hover:text-[#F4F1E8] hover:bg-[#1B2630] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Experiment Form */}
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-xs font-semibold text-[#B9C2C9] mb-1">
              Giả Thuyết Chiến Thuật (Behavior Hypothesis):
            </label>
            <input
              type="text"
              value={hypothesis}
              onChange={e => setHypothesis(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0E141A] border border-[#293640] text-xs text-[#F4F1E8] focus:border-[#F1C86B] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#B9C2C9] mb-1">
                Đối Thủ So Sánh (Archetype):
              </label>
              <select
                value={selectedOpponentKey}
                onChange={e => setSelectedOpponentKey(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0E141A] border border-[#293640] text-xs text-[#65C8D4] focus:outline-none cursor-pointer"
              >
                {Object.keys(REFERENCE_BOTS).map(key => (
                  <option key={key} value={key}>
                    {REFERENCE_BOTS[key].name} ({key})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#B9C2C9] mb-1">
                Số Lượng Trận (Đổi slot đối xứng):
              </label>
              <select
                value={matchCount}
                onChange={e => setMatchCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[#0E141A] border border-[#293640] text-xs text-[#F4F1E8] focus:outline-none cursor-pointer"
              >
                <option value={10}>10 trận (Nhanh)</option>
                <option value={20}>20 trận (Chuẩn)</option>
                <option value={50}>50 trận (Chi tiết)</option>
              </select>
            </div>
          </div>

          {/* Results Display */}
          {results && (
            <div className="p-4 rounded-xl bg-[#0E141A] border border-[#293640] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#F4F1E8] uppercase tracking-wider">
                  Kết Quả Thí Nghiệm ({results.totalRuns} Trận)
                </span>
                <span
                  className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                    winRate >= 60 ? 'bg-[#55C58A]/20 text-[#55C58A]' : 'bg-[#F0B85B]/20 text-[#F0B85B]'
                  }`}
                >
                  Tỷ lệ thắng: {winRate}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 bg-[#141C24] rounded-full overflow-hidden flex border border-[#293640]">
                <div
                  style={{ width: `${(results.wins / results.totalRuns) * 100}%` }}
                  className="bg-[#55C58A] h-full transition-all"
                  title={`Thắng: ${results.wins}`}
                />
                <div
                  style={{ width: `${(results.draws / results.totalRuns) * 100}%` }}
                  className="bg-[#F0B85B] h-full transition-all"
                  title={`Hòa: ${results.draws}`}
                />
                <div
                  style={{ width: `${(results.losses / results.totalRuns) * 100}%` }}
                  className="bg-[#EC6A68] h-full transition-all"
                  title={`Thua: ${results.losses}`}
                />
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono pt-1">
                <div className="p-2 rounded bg-[#141C24]">
                  <span className="text-[10px] text-[#94A1AB] block">Thắng / Hòa / Thua</span>
                  <span className="font-bold text-[#F4F1E8]">
                    {results.wins} / {results.draws} / {results.losses}
                  </span>
                </div>
                <div className="p-2 rounded bg-[#141C24]">
                  <span className="text-[10px] text-[#94A1AB] block">Thời Lượng TB</span>
                  <span className="font-bold text-[#F4F1E8]">
                    {(results.avgTicks / 60).toFixed(1)}s
                  </span>
                </div>
                <div className="p-2 rounded bg-[#141C24]">
                  <span className="text-[10px] text-[#94A1AB] block">Sát Thương TB</span>
                  <span className="font-bold text-[#F1C86B]">{results.avgDamage}</span>
                </div>
                <div className="p-2 rounded bg-[#141C24]">
                  <span className="text-[10px] text-[#94A1AB] block">Cứ Điểm TB</span>
                  <span className="font-bold text-[#65C8D4]">{results.avgControlTicks} ticks</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#293640]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#1B2630] hover:bg-[#25323D] text-xs font-semibold text-[#B9C2C9] transition-colors cursor-pointer"
          >
            Đóng
          </button>
          <button
            onClick={handleRunExperiment}
            disabled={isRunning}
            className="px-5 py-2 rounded-lg bg-[#E8C56C] hover:bg-[#F1C86B] text-[#090D11] text-xs font-bold flex items-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang Mô Phỏng...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Khởi Chạy Thí Nghiệm</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
