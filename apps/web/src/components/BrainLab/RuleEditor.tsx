import React from 'react';
import { BrainState, Rule } from '../../types/game';
import { Plus, Trash2, ArrowUp, ArrowDown, GitBranch, Shield, Zap, Sparkles } from 'lucide-react';

interface RuleEditorProps {
  state: BrainState;
  onUpdateRules: (updatedRules: Rule[]) => void;
  availableStateIds: string[];
}

export const RuleEditor: React.FC<RuleEditorProps> = ({
  state,
  onUpdateRules,
  availableStateIds,
}) => {
  const handleAddRule = () => {
    const newRule: Rule = {
      id: `rule_${Date.now().toString().slice(-4)}`,
      description: 'Quy tắc phản ứng mới',
      when: { kind: 'bool', value: true },
      intent: {
        thrust: { forward: { kind: 'const', value: 600 }, strafe: { kind: 'const', value: 0 } },
        turn: { kind: 'sensor', name: 'enemy.bearing' },
        modules: [],
      },
    };
    onUpdateRules([...state.rules, newRule]);
  };

  const handleDeleteRule = (ruleIndex: number) => {
    const updated = state.rules.filter((_, i) => i !== ruleIndex);
    onUpdateRules(updated);
  };

  return (
    <div className="bg-[#141C24] rounded-xl border border-[#293640] p-4 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-[#293640] mb-3">
        <div>
          <h3 className="text-sm font-bold text-[#F4F1E8] flex items-center gap-2">
            <span>Danh Sách Quy Tắc (Rules Inspector)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1B2630] text-[#F1C86B] border border-[#F1C86B]/30">
              Trạng thái: {state.id}
            </span>
          </h3>
          <p className="text-[11px] text-[#94A1AB]">
            Ưu tiên từ trên xuống dưới • Quy tắc đầu tiên thỏa mãn điều kiện sẽ được thi hành
          </p>
        </div>

        <button
          onClick={handleAddRule}
          className="px-2.5 py-1.5 rounded-lg bg-[#25323D] hover:bg-[#39434C] border border-[#8193A0]/30 text-xs font-semibold text-[#F1EADC] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-[#55C58A]" />
          <span>Thêm Rule</span>
        </button>
      </div>

      {/* Rules list */}
      <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
        {state.rules.map((rule, index) => {
          return (
            <div
              key={rule.id}
              className="p-3 rounded-lg bg-[#0E141A] border border-[#293640] hover:border-[#8193A0]/40 transition-all flex flex-col gap-2.5 text-xs"
            >
              {/* Rule Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#1B2630] border border-[#8193A0]/40 flex items-center justify-center font-mono font-bold text-[10px] text-[#F1C86B]">
                    #{index + 1}
                  </span>
                  <span className="font-mono font-bold text-[#F4F1E8]">{rule.id}</span>
                </div>

                <button
                  onClick={() => handleDeleteRule(index)}
                  className="p-1 rounded text-[#94A1AB] hover:text-[#EC6A68] hover:bg-[#1B2630] transition-colors cursor-pointer"
                  title="Xóa rule này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Description */}
              {rule.description && (
                <p className="text-[11px] text-[#B9C2C9]">{rule.description}</p>
              )}

              {/* Condition (WHEN) */}
              <div className="p-2 rounded bg-[#141C24] border border-[#293640] space-y-1">
                <span className="text-[10px] font-mono font-bold text-[#65C8D4] block">
                  ĐIỀU KIỆN (WHEN):
                </span>
                <div className="font-mono text-[11px] text-[#F1EADC]">
                  {rule.when.kind === 'bool' ? (
                    <span className="text-[#55C58A]">{rule.when.value ? 'true (luôn kích hoạt nếu đến lượt)' : 'false'}</span>
                  ) : rule.when.kind === 'compare' ? (
                    <span className="text-[#E8C56C]">
                      {rule.when.left.kind === 'sensor' ? rule.when.left.name : 'expr'}{' '}
                      <strong>{rule.when.op}</strong>{' '}
                      {rule.when.right.kind === 'const' ? rule.when.right.value : 'val'}
                    </span>
                  ) : (
                    <span>Biểu thức logic phức tạp</span>
                  )}
                </div>
              </div>

              {/* Actions & Intent (THEN) */}
              <div className="p-2 rounded bg-[#141C24] border border-[#293640] space-y-1">
                <span className="text-[10px] font-mono font-bold text-[#55C58A] block">
                  HÀNH ĐỘNG (INTENT):
                </span>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-[#B9C2C9]">
                  <div>
                    Tiến/Lùi:{' '}
                    <strong className="text-[#F1EADC]">
                      {rule.intent.thrust.forward.kind === 'const' ? rule.intent.thrust.forward.value : 'auto'}
                    </strong>
                  </div>
                  <div>
                    Trôi ngang (Strafe):{' '}
                    <strong className="text-[#F1EADC]">
                      {rule.intent.thrust.strafe.kind === 'const' ? rule.intent.thrust.strafe.value : 'auto'}
                    </strong>
                  </div>
                  <div>
                    Xoay góc:{' '}
                    <strong className="text-[#F1EADC]">
                      {rule.intent.turn.kind === 'sensor' ? rule.intent.turn.name : '0'}
                    </strong>
                  </div>
                  <div>
                    Vũ khí/Khiên:{' '}
                    <strong className="text-[#F1C86B]">
                      {rule.intent.modules.length > 0
                        ? rule.intent.modules.map(m => `${m.moduleId} (${m.action})`).join(', ')
                        : 'Không'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Next State Transition */}
              {rule.nextState && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#F1C86B]">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Chuyển sang trạng thái kế tiếp:</span>
                  <strong className="underline">{rule.nextState}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
