import React, { useState } from 'react';
import { BotDefinition } from '../../types/game';
import { PRESET_SYNTHS } from '../../data/presets';
import { stepSimulation, createInitialSimulation } from '../../simulation/miniEngine';
import { Trophy, Swords, ShieldCheck, ArrowRight, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface RankedViewProps {
  currentBot: BotDefinition;
}

interface LeaderboardEntry {
  rank: number;
  creator: string;
  synthName: string;
  archetype: string;
  rating: number;
  record: { wins: number; draws: number; losses: number };
  isPlayer?: boolean;
}

const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, creator: 'Commander Sontak', synthName: 'Mantis Prime', archetype: 'Mantis', rating: 2140, record: { wins: 48, draws: 4, losses: 8 }, isPlayer: true },
  { rank: 2, creator: 'NexusCore', synthName: 'Bastion Fortress', archetype: 'Bastion', rating: 2095, record: { wins: 42, draws: 9, losses: 9 } },
  { rank: 3, creator: 'ZephyrV', synthName: 'Kestrel Strike', archetype: 'Kestrel', rating: 2040, record: { wins: 39, draws: 6, losses: 15 } },
  { rank: 4, creator: 'TitanForge', synthName: 'Ram Dreadnought', archetype: 'Ram', rating: 1985, record: { wins: 36, draws: 3, losses: 17 } },
  { rank: 5, creator: 'GhostHacker', synthName: 'Wisp Heatwave', archetype: 'Wisp', rating: 1920, record: { wins: 33, draws: 8, losses: 19 } },
  { rank: 6, creator: 'BioMech', synthName: 'Chimera Apex', archetype: 'Chimera', rating: 1890, record: { wins: 31, draws: 5, losses: 22 } },
  { rank: 7, creator: 'VortexAI', synthName: 'Aero Blade', archetype: 'Mantis', rating: 1825, record: { wins: 28, draws: 4, losses: 26 } },
  { rank: 8, creator: 'IronWill', synthName: 'Bulwark Alpha', archetype: 'Bastion', rating: 1790, record: { wins: 25, draws: 7, losses: 28 } },
];

export const RankedView: React.FC<RankedViewProps> = ({ currentBot }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(INITIAL_LEADERBOARD);
  const [isSimulatingSeries, setIsSimulatingSeries] = useState(false);
  const [seriesResult, setSeriesResult] = useState<{
    opponent: BotDefinition;
    leg1Winner: 'A' | 'B' | 'Draw';
    leg2Winner: 'A' | 'B' | 'Draw';
    seriesPointsA: number;
    seriesPointsB: number;
    eloDelta: number;
  } | null>(null);

  // Run official BO2 series
  const handleQueueRanked = () => {
    setIsSimulatingSeries(true);
    setSeriesResult(null);

    // Pick a random meta opponent from presets
    const opponents = PRESET_SYNTHS.filter(b => b.id !== currentBot.id);
    const opponent = opponents[Math.floor(Math.random() * opponents.length)];

    setTimeout(() => {
      // Fast headless simulation of Leg 1 (Left vs Right)
      let simLeg1 = createInitialSimulation(currentBot, opponent, false);
      for (let t = 0; t < 5400; t++) {
        simLeg1 = stepSimulation(simLeg1);
        if (simLeg1.isFinished) break;
      }
      const leg1Winner = simLeg1.winner || 'Draw';

      // Fast headless simulation of Leg 2 (Right vs Left - Swapped slots)
      let simLeg2 = createInitialSimulation(currentBot, opponent, true);
      for (let t = 0; t < 5400; t++) {
        simLeg2 = stepSimulation(simLeg2);
        if (simLeg2.isFinished) break;
      }
      const leg2Winner = simLeg2.winner || 'Draw';

      let ptsA = 0;
      let ptsB = 0;
      if (leg1Winner === 'A') ptsA += 1;
      else if (leg1Winner === 'B') ptsB += 1;
      else { ptsA += 0.5; ptsB += 0.5; }

      if (leg2Winner === 'A') ptsA += 1;
      else if (leg2Winner === 'B') ptsB += 1;
      else { ptsA += 0.5; ptsB += 0.5; }

      let eloDelta = 0;
      if (ptsA > ptsB) eloDelta = +26;
      else if (ptsA < ptsB) eloDelta = -20;
      else eloDelta = +4;

      // Update leaderboard
      setLeaderboard(prev =>
        prev.map(item => {
          if (item.isPlayer) {
            return {
              ...item,
              rating: Math.max(1000, item.rating + eloDelta),
              record: {
                wins: item.record.wins + (ptsA > ptsB ? 1 : 0),
                draws: item.record.draws + (ptsA === ptsB ? 1 : 0),
                losses: item.record.losses + (ptsA < ptsB ? 1 : 0),
              },
            };
          }
          return item;
        })
      );

      setSeriesResult({
        opponent,
        leg1Winner,
        leg2Winner,
        seriesPointsA: ptsA,
        seriesPointsB: ptsB,
        eloDelta,
      });

      setIsSimulatingSeries(false);

      if (ptsA > ptsB) {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      }
    }, 1500);
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1700px] mx-auto animate-fadeIn space-y-5">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#293640]">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-[#F4F1E8] tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[#F1C86B]" />
            <span>Đấu Hạng BO2 & Bảng Xếp Hạng (Ranked Series)</span>
          </h1>
          <p className="text-xs text-[#94A1AB]">
            Thể thức BO2 đối trọng đổi slot xuất phát • Hệ thống điểm Elo • Mùa giải Season 1 (Open Alpha)
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-[#94A1AB]">Trạng thái:</span>
          <span className="px-2 py-0.5 rounded bg-[#141C24] text-[#55C58A] border border-[#55C58A]/30">
            Hợp lệ thi đấu
          </span>
        </div>
      </div>

      {/* BO2 Match Queue Card */}
      <div className="bg-[#141C24] rounded-xl border border-[#293640] p-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#F4F1E8]">Synth Thi Đấu Đã Khóa:</span>
              <span className="font-mono text-xs text-[#F1C86B] font-bold px-2 py-0.5 rounded bg-[#1B2630] border border-[#F1C86B]/40">
                {currentBot.name} (Rev {currentBot.revision})
              </span>
            </div>
            <p className="text-xs text-[#B9C2C9]">
              Thể thức BO2: Chạy 2 lượt trận liên tiếp (Leg 1 & Leg 2) hoán đổi vị trí xuất phát để đảm bảo tính công bằng tuyệt đối.
            </p>
          </div>

          <button
            onClick={handleQueueRanked}
            disabled={isSimulatingSeries}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#F1C86B] to-[#E8C56C] hover:opacity-95 text-[#090D11] text-xs font-black flex items-center gap-2 transition-all shadow-[0_4px_16px_rgba(241,200,107,0.3)] cursor-pointer disabled:opacity-50"
          >
            {isSimulatingSeries ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Đang Ghép Trận & Chạy BO2...</span>
              </>
            ) : (
              <>
                <Swords className="w-4 h-4" />
                <span>Vào Hàng Chờ Xếp Hạng (Queue Match)</span>
              </>
            )}
          </button>
        </div>

        {/* Series Results Display */}
        {seriesResult && (
          <div className="mt-4 p-4 rounded-xl bg-[#0E141A] border border-[#F1C86B]/40 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#F1EADC] uppercase font-mono">
                Kết Quả Series BO2 Gần Nhất
              </span>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  seriesResult.eloDelta > 0
                    ? 'bg-[#55C58A]/20 text-[#55C58A] border border-[#55C58A]/40'
                    : 'bg-[#EC6A68]/20 text-[#EC6A68] border border-[#EC6A68]/40'
                }`}
              >
                {seriesResult.eloDelta > 0 ? `+${seriesResult.eloDelta}` : seriesResult.eloDelta} Elo Rating
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              {/* Leg 1 */}
              <div className="p-3 rounded-lg bg-[#141C24] border border-[#293640] space-y-1">
                <span className="text-[#94A1AB] text-[10px] block">LƯỢT 1 (LEG 1/2): Vị trí tiêu chuẩn</span>
                <div className="flex justify-between items-center text-[#F4F1E8]">
                  <span>{currentBot.name} (Trái)</span>
                  <span className="font-bold text-[#F1C86B]">
                    {seriesResult.leg1Winner === 'A' ? 'THẮNG' : seriesResult.leg1Winner === 'B' ? 'THUA' : 'HÒA'}
                  </span>
                  <span>{seriesResult.opponent.name} (Phải)</span>
                </div>
              </div>

              {/* Leg 2 */}
              <div className="p-3 rounded-lg bg-[#141C24] border border-[#293640] space-y-1">
                <span className="text-[#94A1AB] text-[10px] block">LƯỢT 2 (LEG 2/2): Đổi slot đối trọng</span>
                <div className="flex justify-between items-center text-[#F4F1E8]">
                  <span>{currentBot.name} (Phải)</span>
                  <span className="font-bold text-[#F1C86B]">
                    {seriesResult.leg2Winner === 'A' ? 'THẮNG' : seriesResult.leg2Winner === 'B' ? 'THUA' : 'HÒA'}
                  </span>
                  <span>{seriesResult.opponent.name} (Trái)</span>
                </div>
              </div>
            </div>

            <div className="text-center text-xs font-bold text-[#F1EADC]">
              TỔNG SERIES:{' '}
              <span className="text-[#F1C86B] text-sm">
                {seriesResult.seriesPointsA} - {seriesResult.seriesPointsB}
              </span>{' '}
              ({seriesResult.seriesPointsA > seriesResult.seriesPointsB ? 'Chiến thắng' : seriesResult.seriesPointsA < seriesResult.seriesPointsB ? 'Thất bại' : 'Hòa'})
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-[#141C24] rounded-xl border border-[#293640] p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#293640]">
          <div>
            <h3 className="text-sm font-bold text-[#F4F1E8] flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#F1C86B]" />
              <span>Bảng Xếp Hạng Mùa 1 (Season 1 Leaderboard)</span>
            </h3>
            <p className="text-[11px] text-[#94A1AB]">Xếp theo hệ số Elo của các nhà sáng tạo Synth</p>
          </div>

          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1B2630] text-[#94A1AB] border border-[#293640]">
            Cập nhật theo thời gian thực
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#293640] text-[#94A1AB]">
                <th className="py-2 px-3">Hạng</th>
                <th className="py-2 px-3">Nhà Sáng Tạo</th>
                <th className="py-2 px-3">Tên Synth</th>
                <th className="py-2 px-3">Mẫu (Archetype)</th>
                <th className="py-2 px-3 text-right">Elo Rating</th>
                <th className="py-2 px-3 text-right">Thắng / Hòa / Thua</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map(entry => (
                <tr
                  key={entry.rank}
                  className={`border-b border-[#293640]/50 transition-colors ${
                    entry.isPlayer
                      ? 'bg-[#1B2630] text-[#F1EADC] font-semibold border-[#F1C86B]/30'
                      : 'hover:bg-[#1B2630]/60 text-[#B9C2C9]'
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <span
                      className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-xs ${
                        entry.rank === 1
                          ? 'bg-[#F1C86B] text-[#090D11]'
                          : entry.rank === 2
                          ? 'bg-[#D9D4C8] text-[#090D11]'
                          : entry.rank === 3
                          ? 'bg-[#F27B59] text-[#090D11]'
                          : 'text-[#94A1AB]'
                      }`}
                    >
                      {entry.rank}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-sans font-medium text-[#F4F1E8]">
                    {entry.creator} {entry.isPlayer && <span className="text-[10px] text-[#F1C86B]">(Bạn)</span>}
                  </td>
                  <td className="py-2.5 px-3 text-[#F1EADC]">{entry.synthName}</td>
                  <td className="py-2.5 px-3 text-[#94A1AB]">{entry.archetype}</td>
                  <td className="py-2.5 px-3 text-right text-[#F1C86B] font-bold">
                    {entry.rating}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#94A1AB]">
                    <span className="text-[#55C58A]">{entry.record.wins}W</span> -{' '}
                    <span>{entry.record.draws}D</span> -{' '}
                    <span className="text-[#EC6A68]">{entry.record.losses}L</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
