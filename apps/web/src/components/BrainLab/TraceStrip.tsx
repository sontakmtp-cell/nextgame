import React, { useState } from 'react';
import { BrainSource } from '../../types/game';
import { Gauge, Activity, Zap, Flame, Crosshair } from 'lucide-react';

interface TraceStripProps {
  brain: BrainSource;
  activeStateId: string;
}

export const TraceStrip: React.FC<TraceStripProps> = ({ brain, activeStateId }) => {
  // Mock sensors sandbox inputs
  const [enemyDist, setEnemyDist] = useState(1500); // milli-units
  const [enemyTelegraph, setEnemyTelegraph] = useState(0); // 0 or 1
  const [selfHeat, setSelfHeat] = useState(400); // 0..1000
  const [selfEnergy, setSelfEnergy] = useState(850); // 0..1000

  // Calculate matching rule
  const currentState = brain.states.find(s => s.id === activeStateId);
  let activeRuleId: string | null = null;
  let activeIntentDesc = 'Đứng im (Không có quy tắc khớp)';

  if (currentState) {
    for (const rule of currentState.rules) {
      let matched = false;
      if (rule.when.kind === 'bool') {
        matched = rule.when.value;
      } else if (rule.when.kind === 'compare') {
        const comp = rule.when;
        let leftVal = 0;
        if (comp.left.kind === 'sensor') {
          if (comp.left.name === 'enemy.distance') leftVal = enemyDist;
          if (comp.left.name === 'enemy.telegraph') leftVal = enemyTelegraph;
          if (comp.left.name === 'self.heat') leftVal = selfHeat;
          if (comp.left.name === 'self.energy') leftVal = selfEnergy;
        }
        const rightVal = comp.right.kind === 'const' ? comp.right.value : 0;
        if (comp.op === 'lt') matched = leftVal < rightVal;
        if (comp.op === 'lte') matched = leftVal <= rightVal;
        if (comp.op === 'gt') matched = leftVal > rightVal;
        if (comp.op === 'gte') matched = leftVal >= rightVal;
        if (comp.op === 'eq') matched = leftVal === rightVal;
      }

      if (matched) {
        activeRuleId = rule.id;
        const fwd = rule.intent.thrust.forward.kind === 'const' ? rule.intent.thrust.forward.value : 0;
        const str = rule.intent.thrust.strafe.kind === 'const' ? rule.intent.thrust.strafe.value : 0;
        const mods = rule.intent.modules.map(m => m.moduleId).join(', ') || 'Di chuyển';
        activeIntentDesc = `Tiến: ${fwd}, Trôi: ${str} | Module: ${mods}`;
        break;
      }
    }
  }

  return (
    <div className="bg-[#141C24] rounded-xl border border-[#293640] p-3.5 shadow-xl">
      <div className="flex items-center justify-between pb-2 border-b border-[#293640] mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#55C58A]" />
          <h4 className="text-xs font-bold text-[#F4F1E8]">Mô Phỏng Cảm Biến Thời Gian Thực (10 Hz Decision Trace)</h4>
        </div>
        <span className="text-[10px] font-mono text-[#94A1AB]">Gas: 18 / 4096</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs mb-3">
        {/* Sensor 1: Enemy Distance */}
        <div className="p-2.5 rounded bg-[#0E141A] border border-[#293640] space-y-1">
          <div className="flex justify-between font-mono text-[11px]">
            <span className="text-[#94A1AB]">enemy.distance</span>
            <strong className="text-[#F1EADC]">{(enemyDist / 1000).toFixed(1)} u</strong>
          </div>
          <input
            type="range"
            min={500}
            max={8000}
            step={100}
            value={enemyDist}
            onChange={e => setEnemyDist(Number(e.target.value))}
            className="w-full accent-[#F1C86B] cursor-pointer"
          />
        </div>

        {/* Sensor 2: Enemy Telegraph */}
        <div className="p-2.5 rounded bg-[#0E141A] border border-[#293640] space-y-1">
          <div className="flex justify-between font-mono text-[11px]">
            <span className="text-[#94A1AB]">enemy.telegraph</span>
            <strong className={enemyTelegraph ? 'text-[#EC6A68]' : 'text-[#55C58A]'}>
              {enemyTelegraph ? '1 (Đang vung đòn)' : '0 (An toàn)'}
            </strong>
          </div>
          <button
            onClick={() => setEnemyTelegraph(enemyTelegraph ? 0 : 1)}
            className={`w-full py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer border ${
              enemyTelegraph
                ? 'bg-[#EC6A68]/20 border-[#EC6A68] text-[#EC6A68]'
                : 'bg-[#1B2630] border-[#293640] text-[#8193A0]'
            }`}
          >
            {enemyTelegraph ? 'Đang bật Telegraph' : 'Bật giả lập Telegraph'}
          </button>
        </div>

        {/* Sensor 3: Self Heat */}
        <div className="p-2.5 rounded bg-[#0E141A] border border-[#293640] space-y-1">
          <div className="flex justify-between font-mono text-[11px]">
            <span className="text-[#94A1AB]">self.heat</span>
            <strong className={selfHeat > 700 ? 'text-[#EC6A68]' : 'text-[#F0B85B]'}>
              {selfHeat} / 1000
            </strong>
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            step={50}
            value={selfHeat}
            onChange={e => setSelfHeat(Number(e.target.value))}
            className="w-full accent-[#F0B85B] cursor-pointer"
          />
        </div>

        {/* Sensor 4: Self Energy */}
        <div className="p-2.5 rounded bg-[#0E141A] border border-[#293640] space-y-1">
          <div className="flex justify-between font-mono text-[11px]">
            <span className="text-[#94A1AB]">self.energy</span>
            <strong className="text-[#7EBBE8]">{selfEnergy} / 1000</strong>
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            step={50}
            value={selfEnergy}
            onChange={e => setSelfEnergy(Number(e.target.value))}
            className="w-full accent-[#7EBBE8] cursor-pointer"
          />
        </div>
      </div>

      {/* Decision Output Result */}
      <div className="p-2.5 rounded-lg bg-[#1B2630] border border-[#F1C86B]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-[#94A1AB]">Rule khớp:</span>
          <span className="px-2 py-0.5 rounded bg-[#25323D] text-[#F1C86B] font-bold border border-[#F1C86B]/40">
            {activeRuleId || 'None'}
          </span>
        </div>

        <div className="text-[#F1EADC] truncate">
          <span className="text-[#94A1AB]">Ý định (Intent):</span> {activeIntentDesc}
        </div>
      </div>
    </div>
  );
};
