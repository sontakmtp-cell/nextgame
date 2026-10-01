import React from 'react';
import { SimulationState } from '../../simulation/miniEngine';
import { Flame, Zap, Shield, Heart, AlertTriangle, Trophy } from 'lucide-react';

interface MatchHudProps {
  simState: SimulationState;
}

export const MatchHud: React.FC<MatchHudProps> = ({ simState }) => {
  const { botA, botB, elapsedSec, tick, isFinished, winner } = simState;

  // Format time mm:ss
  const mins = Math.floor(elapsedSec / 60);
  const secs = Math.floor(elapsedSec % 60);
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="w-full bg-[#141C24] rounded-xl border border-[#293640] p-3 shadow-xl">
      {/* Top Center Match Timer & Status */}
      <div className="flex items-center justify-between pb-2.5 border-b border-[#293640] mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#1B2630] text-[#55C58A] border border-[#55C58A]/30">
            Practice Sandbox
          </span>
          {simState.ringWarning && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#EC6A68]/20 text-[#EC6A68] border border-[#EC6A68]/40 animate-pulse flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>Vòng bo đang thu hẹp (R: {simState.ringRadius.toFixed(1)}u)</span>
            </span>
          )}
        </div>

        {/* Big Timer */}
        <div className="flex items-center gap-2 font-mono">
          <span className="text-lg lg:text-xl font-black text-[#F4F1E8] tracking-widest">
            {timeFormatted}
          </span>
          <span className="text-[11px] text-[#94A1AB]">/ 01:30 (Tick {tick})</span>
        </div>

        {/* Winner Tag */}
        {isFinished && (
          <div className="px-2.5 py-0.5 rounded bg-[#F1C86B]/20 border border-[#F1C86B] text-xs font-bold text-[#F1C86B] flex items-center gap-1.5 animate-fadeIn">
            <Trophy className="w-3.5 h-3.5" />
            <span>
              {winner === 'Draw' ? 'KẾT QUẢ HÒA' : `ĐỘI ${winner} CHIẾN THẮNG!`}
            </span>
          </div>
        )}
      </div>

      {/* Two Teams Resource HUD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team A Card (Coral #F27B59) */}
        <div className="p-3 rounded-lg bg-[#0E141A] border border-[#F27B59]/40 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#F27B59] flex items-center justify-center font-bold text-[10px] text-[#090D11]">
                A
              </div>
              <span className="font-bold text-xs text-[#F4F1E8]">{botA.botName}</span>
              <span className="text-[10px] font-mono text-[#F1C86B] px-1.5 py-0.2 rounded bg-[#1B2630]">
                {botA.currentBrainState}
              </span>
            </div>

            <span className="text-[11px] font-mono text-[#94A1AB]">
              Control: <strong className="text-[#F1EADC]">{botA.controlTicks}</strong> ticks
            </span>
          </div>

          {/* Core HP Bar */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono text-[#94A1AB]">
              <span className="flex items-center gap-1 text-[#F27B59]">
                <Heart className="w-3 h-3" /> Core HP
              </span>
              <span>{botA.coreHp} / 800</span>
            </div>
            <div className="w-full h-2 rounded bg-[#1B2630] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#F27B59] to-[#EC6A68] transition-all"
                style={{ width: `${Math.max(0, (botA.coreHp / 800) * 100)}%` }}
              />
            </div>
          </div>

          {/* Energy & Heat Bars */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            {/* Energy */}
            <div>
              <div className="flex justify-between text-[#7EBBE8]">
                <span className="flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" /> Energy</span>
                <span>{botA.energy}</span>
              </div>
              <div className="w-full h-1.5 rounded bg-[#1B2630] overflow-hidden">
                <div
                  className="h-full bg-[#7EBBE8] transition-all"
                  style={{ width: `${Math.max(0, (botA.energy / botA.maxEnergy) * 100)}%` }}
                />
              </div>
            </div>

            {/* Heat */}
            <div>
              <div className="flex justify-between text-[#F0B85B]">
                <span className="flex items-center gap-0.5"><Flame className="w-2.5 h-2.5" /> Heat</span>
                <span>{botA.heat} {botA.isOverheated && '⚠️'}</span>
              </div>
              <div className="w-full h-1.5 rounded bg-[#1B2630] overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    botA.isOverheated ? 'bg-[#EC6A68] animate-pulse' : 'bg-[#F0B85B]'
                  }`}
                  style={{ width: `${Math.max(0, (botA.heat / botA.maxHeat) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Team B Card (Cyan #65C8D4) */}
        <div className="p-3 rounded-lg bg-[#0E141A] border border-[#65C8D4]/40 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-[#65C8D4] flex items-center justify-center font-bold text-[10px] text-[#090D11]">
                B
              </div>
              <span className="font-bold text-xs text-[#F4F1E8]">{botB.botName}</span>
              <span className="text-[10px] font-mono text-[#F1C86B] px-1.5 py-0.2 rounded bg-[#1B2630]">
                {botB.currentBrainState}
              </span>
            </div>

            <span className="text-[11px] font-mono text-[#94A1AB]">
              Control: <strong className="text-[#F1EADC]">{botB.controlTicks}</strong> ticks
            </span>
          </div>

          {/* Core HP Bar */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono text-[#94A1AB]">
              <span className="flex items-center gap-1 text-[#65C8D4]">
                <Heart className="w-3 h-3" /> Core HP
              </span>
              <span>{botB.coreHp} / 800</span>
            </div>
            <div className="w-full h-2 rounded bg-[#1B2630] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#65C8D4] to-[#55C58A] transition-all"
                style={{ width: `${Math.max(0, (botB.coreHp / 800) * 100)}%` }}
              />
            </div>
          </div>

          {/* Energy & Heat Bars */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            {/* Energy */}
            <div>
              <div className="flex justify-between text-[#7EBBE8]">
                <span className="flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" /> Energy</span>
                <span>{botB.energy}</span>
              </div>
              <div className="w-full h-1.5 rounded bg-[#1B2630] overflow-hidden">
                <div
                  className="h-full bg-[#7EBBE8] transition-all"
                  style={{ width: `${Math.max(0, (botB.energy / botB.maxEnergy) * 100)}%` }}
                />
              </div>
            </div>

            {/* Heat */}
            <div>
              <div className="flex justify-between text-[#F0B85B]">
                <span className="flex items-center gap-0.5"><Flame className="w-2.5 h-2.5" /> Heat</span>
                <span>{botB.heat} {botB.isOverheated && '⚠️'}</span>
              </div>
              <div className="w-full h-1.5 rounded bg-[#1B2630] overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    botB.isOverheated ? 'bg-[#EC6A68] animate-pulse' : 'bg-[#F0B85B]'
                  }`}
                  style={{ width: `${Math.max(0, (botB.heat / botB.maxHeat) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
