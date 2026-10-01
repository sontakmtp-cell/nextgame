import React, { useState, useEffect, useRef } from 'react';
import { BotDefinition } from '../../types/game';
import { PRESET_SYNTHS } from '../../data/presets';
import {
  SimulationState,
  createInitialSimulation,
  stepSimulation,
  generateDebrief,
} from '../../simulation/miniEngine';
import { ArenaCanvas } from './ArenaCanvas';
import { MatchHud } from './MatchHud';
import { TimelineControls } from './TimelineControls';
import { DebriefModal } from './DebriefModal';
import { Swords, RotateCcw, Sparkles, Shield, User, Bot, Volume2, VolumeX } from 'lucide-react';
import { sound } from '../../utils/audio';

interface ArenaViewProps {
  currentBot: BotDefinition;
  onNavigateToWorkshop: () => void;
}

export const ArenaView: React.FC<ArenaViewProps> = ({
  currentBot,
  onNavigateToWorkshop,
}) => {
  // Opponent bot (Team B)
  const [opponentBot, setOpponentBot] = useState<BotDefinition>(
    PRESET_SYNTHS.find(b => b.id !== currentBot.id) || PRESET_SYNTHS[1]
  );

  const [simState, setSimState] = useState<SimulationState>(() =>
    createInitialSimulation(currentBot, opponentBot)
  );

  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [isDebriefOpen, setIsDebriefOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(!sound.enabled);

  // Animation Frame ref
  const animRef = useRef<number | null>(null);
  const lastEventCountRef = useRef(0);

  const toggleMute = () => {
    sound.enabled = !sound.enabled;
    setIsMuted(!sound.enabled);
  };

  // Sound triggers on new combat events
  useEffect(() => {
    if (simState.events.length > lastEventCountRef.current) {
      const newEvents = simState.events.slice(lastEventCountRef.current);
      for (const evt of newEvents) {
        if (evt.type === 'windup') {
          sound.playTelegraph();
        } else if (evt.type === 'hit') {
          if (evt.description.includes('chém') || evt.description.includes('lưỡi dao')) {
            sound.playBladeSlash();
          } else {
            sound.playBurstShot();
          }
        } else if (evt.type === 'shield_block') {
          sound.playShieldBlock();
        } else if (evt.type === 'module_destroyed') {
          sound.playModuleDestroy();
        } else if (evt.type === 'victory') {
          sound.playVictory();
        }
      }
      lastEventCountRef.current = simState.events.length;
    } else if (simState.events.length === 0) {
      lastEventCountRef.current = 0;
    }
  }, [simState.events]);

  // Restart match
  const handleRestart = () => {
    lastEventCountRef.current = 0;
    setSimState(createInitialSimulation(currentBot, opponentBot));
    setIsPlaying(true);
    setIsDebriefOpen(false);
  };

  // Change opponent
  const handleChangeOpponent = (newOpponent: BotDefinition) => {
    lastEventCountRef.current = 0;
    setOpponentBot(newOpponent);
    setSimState(createInitialSimulation(currentBot, newOpponent));
    setIsPlaying(true);
    setIsDebriefOpen(false);
  };

  // Step 6 ticks (1 decision)
  const handleStepForward = () => {
    if (simState.isFinished) return;
    let next = simState;
    for (let i = 0; i < 6; i++) {
      next = stepSimulation(next);
      if (next.isFinished) break;
    }
    setSimState(next);
  };

  // Simulation loop
  useEffect(() => {
    if (!isPlaying || simState.isFinished) {
      if (simState.isFinished && !isDebriefOpen) {
        setIsDebriefOpen(true);
      }
      return;
    }

    let lastTime = performance.now();
    const interval = 1000 / (60 * speed);

    const loop = (time: number) => {
      const delta = time - lastTime;
      if (delta >= interval) {
        lastTime = time - (delta % interval);
        setSimState(prev => {
          if (prev.isFinished) {
            setIsPlaying(false);
            setIsDebriefOpen(true);
            return prev;
          }
          return stepSimulation(prev);
        });
      }
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, speed, simState.isFinished, isDebriefOpen]);

  // Debrief summary
  const debrief = generateDebrief(simState);

  return (
    <div className="p-4 lg:p-6 max-w-[1700px] mx-auto animate-fadeIn space-y-4">
      {/* Top Header & Opponent Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#293640]">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-[#F4F1E8] tracking-tight flex items-center gap-2">
            <Swords className="w-6 h-6 text-[#F1C86B]" />
            <span>Đấu Trường 2D & Phát Lại (Arena & Replay)</span>
          </h1>
          <p className="text-xs text-[#94A1AB]">
            Mô phỏng tất định 60 Hz • Lập trình trí tuệ tự chiến đấu • Vòng bo & Cứ điểm
          </p>
        </div>

        {/* Opponent Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#94A1AB]">Đối thủ (Đội B):</span>
          <select
            value={opponentBot.id}
            onChange={e => {
              const found = PRESET_SYNTHS.find(p => p.id === e.target.value);
              if (found) handleChangeOpponent(found);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-[#141C24] border border-[#293640] text-xs font-semibold text-[#65C8D4] focus:outline-none focus:border-[#65C8D4] cursor-pointer"
          >
            {PRESET_SYNTHS.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={toggleMute}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isMuted
                ? 'bg-[#141C24] border-[#EC6A68]/40 text-[#EC6A68] hover:bg-[#EC6A68]/15'
                : 'bg-[#141C24] border-[#293640] text-[#65C8D4] hover:text-[#F4F1E8]'
            }`}
            title={isMuted ? 'Bật âm thanh hiệu ứng (Web Audio API)' : 'Tắt âm thanh'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={handleRestart}
            className="p-1.5 rounded-lg bg-[#141C24] border border-[#293640] hover:text-[#F4F1E8] text-[#94A1AB] transition-colors cursor-pointer"
            title="Khởi động lại trận"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main HUD */}
      <MatchHud simState={simState} />

      {/* Main Center Area: Arena Canvas + Combat Log (12 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: 2D Battlefield (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <ArenaCanvas simState={simState} />
          <TimelineControls
            currentTick={simState.tick}
            maxTicks={5400}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onStepForward={handleStepForward}
            onRestart={handleRestart}
            speed={speed}
            onChangeSpeed={setSpeed}
          />
        </div>

        {/* Right: Live Combat Event Log (4 cols) */}
        <div className="lg:col-span-4 bg-[#141C24] rounded-xl border border-[#293640] p-3.5 shadow-xl flex flex-col h-[630px]">
          <div className="flex items-center justify-between pb-2 border-b border-[#293640] mb-3">
            <h3 className="text-xs font-bold text-[#F4F1E8] uppercase tracking-wider flex items-center gap-1.5">
              <span>Nhật Ký Chiến Đấu Công Khai</span>
            </h3>
            <span className="text-[10px] font-mono text-[#94A1AB]">
              {simState.events.length} sự kiện
            </span>
          </div>

          {/* Event Stream */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs font-mono">
            {simState.events.length === 0 ? (
              <div className="text-center py-20 text-[#8193A0] italic">
                Hai Synth đang tiến vào vị trí...
              </div>
            ) : (
              [...simState.events].reverse().map(evt => {
                const isTeamA = evt.sourceTeam === 'A';
                return (
                  <div
                    key={evt.id}
                    className={`p-2 rounded border text-[11px] leading-relaxed transition-all ${
                      evt.type === 'victory'
                        ? 'bg-[#F1C86B]/15 border-[#F1C86B] text-[#F1C86B] font-bold'
                        : evt.type === 'module_destroyed'
                        ? 'bg-[#EC6A68]/15 border-[#EC6A68]/40 text-[#EC6A68]'
                        : evt.type === 'shield_block'
                        ? 'bg-[#65C8D4]/15 border-[#65C8D4]/40 text-[#65C8D4]'
                        : evt.type === 'overheat'
                        ? 'bg-[#F0B85B]/15 border-[#F0B85B]/40 text-[#F0B85B]'
                        : isTeamA
                        ? 'bg-[#0E141A] border-[#F27B59]/30 text-[#B9C2C9]'
                        : 'bg-[#0E141A] border-[#65C8D4]/30 text-[#B9C2C9]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#94A1AB] mb-0.5">
                      <span>{evt.timeSec.toFixed(1)}s (tick {evt.tick})</span>
                      <span className={isTeamA ? 'text-[#F27B59]' : 'text-[#65C8D4]'}>
                        Đội {evt.sourceTeam}
                      </span>
                    </div>
                    <div>{evt.description}</div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Button to Open Debrief */}
          {simState.isFinished && (
            <button
              onClick={() => setIsDebriefOpen(true)}
              className="mt-3 w-full py-2 rounded-lg bg-[#E8C56C] hover:bg-[#F1C86B] text-[#090D11] text-xs font-bold transition-all cursor-pointer shadow-md"
            >
              Mở Báo Cáo Tổng Kết (Debrief)
            </button>
          )}
        </div>
      </div>

      {/* Debrief Modal */}
      <DebriefModal
        isOpen={isDebriefOpen}
        onClose={() => setIsDebriefOpen(false)}
        debrief={debrief}
        onRestart={handleRestart}
        onCreateExperiment={() => {
          setIsDebriefOpen(false);
          onNavigateToWorkshop();
        }}
        nameA={currentBot.name}
        nameB={opponentBot.name}
      />
    </div>
  );
};
