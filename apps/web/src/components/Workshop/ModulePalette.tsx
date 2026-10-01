import React from 'react';
import { ModuleCatalogId } from '../../types/game';
import { MODULE_LIST } from '../../data/catalog';
import { Shield, Zap, Flame, Wind, Crosshair, ArrowRight, RotateCw } from 'lucide-react';

interface ModulePaletteProps {
  selectedPaletteId: ModuleCatalogId | null;
  onSelectPaletteId: (id: ModuleCatalogId) => void;
  orientation: 0 | 1 | 2 | 3;
  onChangeOrientation: (ori: 0 | 1 | 2 | 3) => void;
}

export const ModulePalette: React.FC<ModulePaletteProps> = ({
  selectedPaletteId,
  onSelectPaletteId,
  orientation,
  onChangeOrientation,
}) => {
  const orientationLabels = ['+X (Trước)', '+Y (Trái)', '-X (Sau)', '-Y (Phải)'];

  const handleNextOrientation = () => {
    onChangeOrientation(((orientation + 1) % 4) as 0 | 1 | 2 | 3);
  };

  return (
    <div className="flex flex-col bg-[#141C24] rounded-xl border border-[#293640] p-3.5 shadow-xl w-full">
      <div className="flex items-center justify-between pb-3 border-b border-[#293640] mb-3">
        <div>
          <h3 className="text-sm font-bold text-[#F4F1E8]">Thư Viện Module</h3>
          <p className="text-[11px] text-[#94A1AB]">Chọn để đặt vào lưới 12×12</p>
        </div>

        {/* Orientation selector */}
        <button
          onClick={handleNextOrientation}
          className="px-2.5 py-1 rounded bg-[#1B2630] border border-[#8193A0]/30 hover:border-[#F1C86B] text-xs font-mono text-[#F1EADC] flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Xoay hướng module trước khi đặt"
        >
          <RotateCw className="w-3.5 h-3.5 text-[#F1C86B]" />
          <span>{orientationLabels[orientation]}</span>
        </button>
      </div>

      {/* Module Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 overflow-y-auto max-h-[520px] pr-1">
        {MODULE_LIST.map(mod => {
          const isSelected = selectedPaletteId === mod.id;

          return (
            <div
              key={mod.id}
              onClick={() => onSelectPaletteId(mod.id)}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 ${
                isSelected
                  ? 'bg-[#1B2630] border-[#F1C86B] shadow-[0_0_12px_rgba(241,200,107,0.15)] ring-1 ring-[#F1C86B]'
                  : 'bg-[#0E141A] border-[#293640] hover:border-[#8193A0]/50 hover:bg-[#141C24]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${
                      mod.id === 'core'
                        ? 'bg-[#F1C86B]/20 text-[#F1C86B] border border-[#F1C86B]/40'
                        : ['blade', 'lance', 'burst', 'breaker'].includes(mod.id)
                        ? 'bg-[#EC6A68]/20 text-[#EC6A68] border border-[#EC6A68]/40'
                        : mod.id === 'shield'
                        ? 'bg-[#65C8D4]/20 text-[#65C8D4] border border-[#65C8D4]/40'
                        : mod.id === 'thruster'
                        ? 'bg-[#F0B85B]/20 text-[#F0B85B] border border-[#F0B85B]/40'
                        : 'bg-[#D9D4C8]/20 text-[#D9D4C8] border border-[#D9D4C8]/40'
                    }`}
                  >
                    {mod.name.slice(0, 1)}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[#F4F1E8] block leading-tight">
                      {mod.vietnameseName}
                    </span>
                    <span className="text-[10px] font-mono text-[#94A1AB]">
                      {mod.footprint.w}×{mod.footprint.h} ô
                    </span>
                  </div>
                </div>

                {/* Point Cost badge */}
                <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#1B2630] border border-[#293640] text-[#E8C56C]">
                  {mod.cost} pts
                </span>
              </div>

              <p className="text-[11px] text-[#B9C2C9] leading-snug line-clamp-2">
                {mod.role}
              </p>

              {/* Stats badges */}
              <div className="flex items-center gap-2 pt-1 border-t border-[#293640]/60 text-[10px] font-mono text-[#94A1AB]">
                <span>HP: <strong className="text-[#55C58A]">{mod.hp}</strong></span>
                <span>Khối lượng: <strong className="text-[#F1EADC]">{mod.mass}</strong></span>
                {mod.weaponStats && (
                  <span className="text-[#EC6A68]">
                    Dmg: <strong>{mod.weaponStats.damage}</strong>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
