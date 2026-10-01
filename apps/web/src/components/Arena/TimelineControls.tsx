import React from 'react';
import { Play, Pause, StepForward, RotateCcw, FastForward } from 'lucide-react';

interface TimelineControlsProps {
  currentTick: number;
  maxTicks?: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onRestart: () => void;
  speed: number;
  onChangeSpeed: (speed: number) => void;
}

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  currentTick,
  maxTicks = 5400,
  isPlaying,
  onTogglePlay,
  onStepForward,
  onRestart,
  speed,
  onChangeSpeed,
}) => {
  const progressPercent = Math.min(100, (currentTick / maxTicks) * 100);

  return (
    <div className="w-full bg-[#141C24] rounded-xl border border-[#293640] p-3 shadow-xl flex flex-col gap-2">
      {/* Timeline Scrubber Bar with event indicators */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] font-mono text-[#94A1AB]">
          <span>00:00 (Khởi đầu)</span>
          <span className="text-[#F1C86B]">Tick {currentTick} / {maxTicks}</span>
          <span>01:30 (Hết giờ 5400 ticks)</span>
        </div>

        <div className="relative w-full h-2 rounded bg-[#0E141A] border border-[#293640] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#55C58A] via-[#F1C86B] to-[#EC6A68] transition-all"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Marker at tick 600 (Control Circle active) */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[#65C8D4]"
            style={{ left: `${(600 / maxTicks) * 100}%` }}
            title="Tick 600: Bắt đầu tính điểm Control Objective"
          />

          {/* Marker at tick 3600 (Ring shrink) */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[#EC6A68]"
            style={{ left: `${(3600 / maxTicks) * 100}%` }}
            title="Tick 3600: Bắt đầu thu Vòng bo"
          />
        </div>
      </div>

      {/* Playback Buttons Toolbar */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={onTogglePlay}
            className="px-3.5 py-1.5 rounded-lg bg-[#E8C56C] hover:bg-[#F1C86B] text-[#090D11] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Tạm dừng</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Tiếp tục</span>
              </>
            )}
          </button>

          {/* Step 1 Decision (6 ticks) */}
          <button
            onClick={onStepForward}
            disabled={isPlaying}
            className="px-2.5 py-1.5 rounded-lg bg-[#1B2630] hover:bg-[#25323D] border border-[#293640] text-xs font-mono text-[#F1EADC] flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
            title="Tới 1 chu kỳ quyết định (6 ticks / 10 Hz)"
          >
            <StepForward className="w-3.5 h-3.5" />
            <span>+6 ticks</span>
          </button>

          {/* Restart */}
          <button
            onClick={onRestart}
            className="p-1.5 rounded-lg bg-[#1B2630] hover:bg-[#25323D] border border-[#293640] text-[#94A1AB] hover:text-[#F4F1E8] transition-colors cursor-pointer"
            title="Chạy lại trận đấu từ đầu"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 bg-[#0E141A] p-0.5 rounded-lg border border-[#293640]">
          {[0.5, 1, 2, 4].map(s => (
            <button
              key={s}
              onClick={() => onChangeSpeed(s)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                speed === s
                  ? 'bg-[#25323D] text-[#F1C86B] border border-[#8193A0]/30'
                  : 'text-[#94A1AB] hover:text-[#F4F1E8]'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
