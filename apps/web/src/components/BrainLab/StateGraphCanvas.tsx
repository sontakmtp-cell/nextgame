import React from 'react';
import { BrainSource, BrainState } from '../../types/game';
import { ArrowRight, Cpu, Plus, Sparkles, CheckCircle2 } from 'lucide-react';

interface StateGraphCanvasProps {
  brain: BrainSource;
  activeStateId: string;
  onSelectState: (stateId: string) => void;
  onAddState: () => void;
}

export const StateGraphCanvas: React.FC<StateGraphCanvasProps> = ({
  brain,
  activeStateId,
  onSelectState,
  onAddState,
}) => {
  return (
    <div className="bg-[#141C24] rounded-xl border border-[#293640] p-4 shadow-xl flex flex-col h-full min-h-[460px]">
      <div className="flex items-center justify-between pb-3 border-b border-[#293640] mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#F4F1E8] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#F1C86B]" />
            <span>Sơ Đồ Máy Trạng Thái FSM (State Flow Graph)</span>
          </h3>
          <p className="text-[11px] text-[#94A1AB]">
            Mỗi trạng thái là một cụm quy tắc ứng xử theo chu kỳ quyết định 10 Hz
          </p>
        </div>

        <button
          onClick={onAddState}
          className="px-2.5 py-1.5 rounded-lg bg-[#1B2630] hover:bg-[#25323D] border border-[#8193A0]/30 hover:border-[#F1C86B] text-xs font-semibold text-[#F1EADC] flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-[#F1C86B]" />
          <span>Thêm Trạng Thái</span>
        </button>
      </div>

      {/* Visual State Nodes Container */}
      <div className="flex-1 overflow-auto p-4 flex flex-wrap gap-4 items-center justify-center content-center bg-[#0E141A] rounded-lg border border-[#293640] relative">
        {brain.states.map((state, index) => {
          const isSelected = state.id === activeStateId;
          const isInitial = state.id === brain.initialState;

          // Find transition targets from rules
          const targetStates = Array.from(
            new Set(
              state.rules
                .map(r => r.nextState)
                .filter((s): s is string => Boolean(s) && s !== state.id)
            )
          );

          return (
            <div key={state.id} className="flex items-center gap-4">
              <div
                onClick={() => onSelectState(state.id)}
                className={`w-64 p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 relative ${
                  isSelected
                    ? 'bg-[#1B2630] border-[#F1C86B] shadow-[0_0_16px_rgba(241,200,107,0.2)] ring-1 ring-[#F1C86B]'
                    : 'bg-[#141C24] border-[#293640] hover:border-[#8193A0]/60 hover:bg-[#1B2630]'
                }`}
              >
                {/* State Tag & Initial Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#F1EADC]">
                      {state.id}
                    </span>
                    {isInitial && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#F1C86B]/20 text-[#F1C86B] border border-[#F1C86B]/40">
                        Khởi Đầu
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-[#94A1AB]">
                    {state.rules.length} rules
                  </span>
                </div>

                <div className="text-xs font-semibold text-[#F4F1E8]">
                  {state.name || state.id}
                </div>

                <p className="text-[11px] text-[#B9C2C9] leading-snug line-clamp-2">
                  {state.description || 'Chưa có mô tả chi tiết.'}
                </p>

                {/* Rules Summary Badge */}
                <div className="pt-2 border-t border-[#293640] flex items-center justify-between text-[10px] font-mono text-[#94A1AB]">
                  <span>Ưu tiên: 1..{state.rules.length}</span>
                  {targetStates.length > 0 && (
                    <span className="text-[#65C8D4] flex items-center gap-1">
                      <span>chuyển →</span>
                      <strong>{targetStates.join(', ')}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Transition arrow to next state */}
              {index < brain.states.length - 1 && (
                <div className="hidden md:flex flex-col items-center text-[#8193A0]">
                  <ArrowRight className="w-5 h-5 text-[#8193A0]" />
                  <span className="text-[9px] font-mono text-[#94A1AB]">tick transition</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
