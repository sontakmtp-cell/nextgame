import React, { useState } from 'react';
import { BotDefinition, BrainSource, BrainState, Rule } from '../../types/game';
import { StateGraphCanvas } from './StateGraphCanvas';
import { RuleEditor } from './RuleEditor';
import { SourceCodeEditor } from './SourceCodeEditor';
import { TraceStrip } from './TraceStrip';
import { Cpu, Code, BookOpen, Sparkles, Plus, Check } from 'lucide-react';

interface BrainLabViewProps {
  currentBot: BotDefinition;
  onChangeBot: (updated: BotDefinition) => void;
}

export const BrainLabView: React.FC<BrainLabViewProps> = ({
  currentBot,
  onChangeBot,
}) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'source'>('visual');
  const [activeStateId, setActiveStateId] = useState<string>(
    currentBot.brain.initialState || currentBot.brain.states[0]?.id || 'engage'
  );

  const brain = currentBot.brain;

  // Selected state object
  const currentState = brain.states.find(s => s.id === activeStateId) || brain.states[0];

  const handleUpdateRules = (updatedRules: Rule[]) => {
    const updatedStates = brain.states.map(s => {
      if (s.id === currentState.id) {
        return { ...s, rules: updatedRules };
      }
      return s;
    });

    onChangeBot({
      ...currentBot,
      brain: {
        ...brain,
        states: updatedStates,
      },
    });
  };

  const handleAddState = () => {
    const newStateId = `state_${Date.now().toString().slice(-4)}`;
    const newState: BrainState = {
      id: newStateId,
      name: 'Trạng thái mới',
      description: 'Quy tắc hành vi tùy chỉnh',
      rules: [
        {
          id: `rule_default`,
          description: 'Hành động mặc định',
          when: { kind: 'bool', value: true },
          intent: {
            thrust: { forward: { kind: 'const', value: 500 }, strafe: { kind: 'const', value: 0 } },
            turn: { kind: 'sensor', name: 'enemy.bearing' },
            modules: [],
          },
        },
      ],
    };

    onChangeBot({
      ...currentBot,
      brain: {
        ...brain,
        states: [...brain.states, newState],
      },
    });
    setActiveStateId(newStateId);
  };

  const handleSaveBrainSource = (newBrain: BrainSource) => {
    onChangeBot({
      ...currentBot,
      brain: newBrain,
    });
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1700px] mx-auto animate-fadeIn space-y-5">
      {/* Page Title & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#293640]">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-[#F4F1E8] tracking-tight flex items-center gap-2">
            <Cpu className="w-6 h-6 text-[#F1C86B]" />
            <span>Phòng Thí Nghiệm Trí Tuệ (Brain Lab)</span>
          </h1>
          <p className="text-xs text-[#94A1AB]">
            Lập trình trí tuệ máy trạng thái FSM • Nhịp quyết định 10 Hz • Cảm biến & Ý định
          </p>
        </div>

        {/* Tab switch between Visual Graph and JSON Source */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#141C24] border border-[#293640]">
          <button
            onClick={() => setActiveTab('visual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'visual'
                ? 'bg-[#25323D] text-[#F1EADC] border border-[#8193A0]/40 shadow-sm'
                : 'text-[#94A1AB] hover:text-[#F4F1E8]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-[#F1C86B]" />
            <span>Đồ Thị & Quy Tắc</span>
          </button>

          <button
            onClick={() => setActiveTab('source')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'source'
                ? 'bg-[#25323D] text-[#F1EADC] border border-[#8193A0]/40 shadow-sm'
                : 'text-[#94A1AB] hover:text-[#F4F1E8]'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-[#65C8D4]" />
            <span>Mã Nguồn JSON</span>
          </button>
        </div>
      </div>

      {/* Behavior Card Bar */}
      <div className="bg-[#141C24] rounded-xl border border-[#293640] p-3.5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[#F1C86B] font-bold">
          <BookOpen className="w-4 h-4" />
          <span>Thẻ Hành Vi (Behavior Card):</span>
        </div>
        <p className="text-[#B9C2C9] italic flex-1">
          "{currentBot.behaviorCard.hypothesis}"
        </p>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1B2630] text-[#94A1AB] border border-[#293640]">
          Khắc chế: {currentBot.behaviorCard.knownWeaknesses}
        </span>
      </div>

      {/* Main Content Area */}
      {activeTab === 'visual' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: State Flow Graph (6 cols) */}
          <div className="lg:col-span-6">
            <StateGraphCanvas
              brain={brain}
              activeStateId={activeStateId}
              onSelectState={setActiveStateId}
              onAddState={handleAddState}
            />
          </div>

          {/* Right: Rule Inspector for active state (6 cols) */}
          <div className="lg:col-span-6">
            {currentState && (
              <RuleEditor
                state={currentState}
                onUpdateRules={handleUpdateRules}
                availableStateIds={brain.states.map(s => s.id)}
              />
            )}
          </div>
        </div>
      ) : (
        <SourceCodeEditor
          brain={brain}
          onSaveBrain={handleSaveBrainSource}
        />
      )}

      {/* Bottom Trace Strip */}
      <TraceStrip brain={brain} activeStateId={activeStateId} />
    </div>
  );
};
