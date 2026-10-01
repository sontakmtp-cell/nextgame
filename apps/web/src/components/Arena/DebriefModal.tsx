import React, { useEffect } from 'react';
import { MatchDebrief } from '../../types/game';
import { Trophy, Clock, Swords, ShieldAlert, Sparkles, X, RotateCcw, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';

interface DebriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  debrief: MatchDebrief;
  onRestart: () => void;
  onCreateExperiment: () => void;
  nameA: string;
  nameB: string;
}

export const DebriefModal: React.FC<DebriefModalProps> = ({
  isOpen,
  onClose,
  debrief,
  onRestart,
  onCreateExperiment,
  nameA,
  nameB,
}) => {
  useEffect(() => {
    if (isOpen && debrief.winner !== 'Draw') {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: debrief.winner === 'A' ? ['#F27B59', '#F1C86B', '#D9D4C8'] : ['#65C8D4', '#55C58A', '#D9D4C8'],
      });
    }
  }, [isOpen, debrief.winner]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#090D11]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#141C24] border border-[#293640] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-[#1B2630] border-b border-[#293640] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F1C86B]/20 border border-[#F1C86B]/40 flex items-center justify-center text-[#F1C86B]">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#F4F1E8]">Báo Cáo Tổng Kết Trận Đấu (Debrief)</h3>
              <p className="text-[11px] text-[#94A1AB]">Official Decision Record • Deterministic Result</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#25323D] text-[#8193A0] hover:text-[#F4F1E8] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Winner Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-[#1B2630] to-[#0E141A] border border-[#F1C86B]/40 text-center space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#94A1AB]">
              Kết Quả Trận
            </span>
            <h2 className="text-xl font-black text-[#F1EADC]">
              {debrief.winner === 'Draw'
                ? 'HÒA BẤT PHÂN THẮNG BẠI'
                : `CHIẾN THẮNG: [ĐỘI ${debrief.winner}] ${debrief.winner === 'A' ? nameA : nameB}`}
            </h2>
            <p className="text-[11px] text-[#F1C86B] font-mono">
              Lý do: {debrief.reason === 'core_destroyed' ? 'Phá huỷ Lõi Core đối phương' : 'Tính điểm Timeout 5C + 3D + 2H'}
            </p>
          </div>

          {/* Telemetry Comparison Table */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            {/* Team A */}
            <div className="p-3 rounded-lg bg-[#0E141A] border border-[#F27B59]/40 space-y-1.5">
              <span className="font-bold text-xs text-[#F27B59] block">[Đội A] {nameA}</span>
              <div className="flex justify-between text-[#B9C2C9]">
                <span>Sát thương gây ra:</span>
                <strong className="text-[#F1EADC]">{debrief.statsA.damageDealt}</strong>
              </div>
              <div className="flex justify-between text-[#B9C2C9]">
                <span>Module bị mất:</span>
                <strong className="text-[#EC6A68]">{debrief.statsA.modulesLost}</strong>
              </div>
              <div className="flex justify-between text-[#B9C2C9]">
                <span>Kiểm soát vòng tâm:</span>
                <strong className="text-[#55C58A]">{debrief.statsA.controlShare}%</strong>
              </div>
              <div className="flex justify-between text-[#B9C2C9]">
                <span>Đỉnh nhiệt độ:</span>
                <strong className="text-[#F0B85B]">{debrief.statsA.peakHeat} / 1000</strong>
              </div>
              <div className="pt-1 border-t border-[#293640] flex justify-between text-[#E8C56C] font-bold">
                <span>Điểm tổng (Score):</span>
                <span>{debrief.scoreA} pts</span>
              </div>
            </div>

            {/* Team B */}
            <div className="p-3 rounded-lg bg-[#0E141A] border border-[#65C8D4]/40 space-y-1.5">
              <span className="font-bold text-xs text-[#65C8D4] block">[Đội B] {nameB}</span>
              <div className="flex justify-between text-[#B9C2C9]">
                <span>Sát thương gây ra:</span>
                <strong className="text-[#F1EADC]">{debrief.statsB.damageDealt}</strong>
              </div>
              <div className="flex justify-between text-[#B9C2C9]">
                <span>Module bị mất:</span>
                <strong className="text-[#EC6A68]">{debrief.statsB.modulesLost}</strong>
              </div>
              <div className="flex justify-between text-[#B9C2C9]">
                <span>Kiểm soát vòng tâm:</span>
                <strong className="text-[#55C58A]">{debrief.statsB.controlShare}%</strong>
              </div>
              <div className="flex justify-between text-[#B9C2C9]">
                <span>Đỉnh nhiệt độ:</span>
                <strong className="text-[#F0B85B]">{debrief.statsB.peakHeat} / 1000</strong>
              </div>
              <div className="pt-1 border-t border-[#293640] flex justify-between text-[#E8C56C] font-bold">
                <span>Điểm tổng (Score):</span>
                <span>{debrief.scoreB} pts</span>
              </div>
            </div>
          </div>

          {/* Key Turning Points */}
          <div className="space-y-2 pt-2 border-t border-[#293640]">
            <span className="text-[11px] font-bold text-[#F1EADC] block uppercase tracking-wider">
              Các Bước Ngoặt Trận Đấu (Turning Points):
            </span>
            <div className="space-y-1.5">
              {debrief.turningPoints.map((tp, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-[#0E141A] border border-[#293640] flex items-start gap-2.5"
                >
                  <span className="px-1.5 py-0.5 rounded bg-[#1B2630] text-[#F1C86B] font-mono text-[10px] font-bold">
                    {tp.timeSec.toFixed(1)}s
                  </span>
                  <div className="flex-1">
                    <strong className="text-[#F4F1E8] block text-[11px]">{tp.title}</strong>
                    <p className="text-[11px] text-[#B9C2C9]">{tp.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#1B2630] border-t border-[#293640] flex items-center justify-between">
          <button
            onClick={onRestart}
            className="px-3.5 py-2 rounded-lg bg-[#25323D] hover:bg-[#39434C] text-[#B9C2C9] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Phát Lại</span>
          </button>

          <button
            onClick={onCreateExperiment}
            className="px-4 py-2 rounded-lg bg-[#E8C56C] hover:bg-[#F1C86B] text-[#090D11] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tạo Thí Nghiệm Từ Bước Ngoặt Này</span>
          </button>
        </div>
      </div>
    </div>
  );
};
