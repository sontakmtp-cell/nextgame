import React from 'react';
import { BotDefinition, PlacedModule, ValidationReport } from '../../types/game';
import { MODULE_CATALOG } from '../../data/catalog';
import { PRESET_SYNTHS } from '../../data/presets';
import { createCanonicalGameplay } from '@nextgame/contracts';
import { Cpu, Zap, Flame, Gauge, AlertCircle, CheckCircle2, Sparkles, Swords, RefreshCw, Activity, Hash } from 'lucide-react';

interface InspectorPanelProps {
  bot: BotDefinition;
  validationReport: ValidationReport;
  selectedModule: PlacedModule | null;
  onLoadPreset: (preset: BotDefinition) => void;
  onOpenAiCollaborator: () => void;
  onTestInArena: () => void;
  onResetBody: () => void;
  onOpenExperiment: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  bot,
  validationReport,
  selectedModule,
  onLoadPreset,
  onOpenAiCollaborator,
  onTestInArena,
  onResetBody,
  onOpenExperiment,
}) => {
  const selectedCat = selectedModule ? MODULE_CATALOG[selectedModule.catalogId] : null;

  let packageHash = '';
  try {
    const contractBot = {
      schemaVersion: '2.0' as const,
      name: bot.name,
      body: {
        grid: 'square-12-v1' as const,
        modules: bot.body.modules.map(m => ({ id: m.id, catalogId: m.catalogId as any, cell: m.cell, orientation: m.orientation })),
      },
      brain: {
        abiVersion: '2.0' as const,
        initialState: bot.brain.initialState || 'engage',
        variables: bot.brain.variables.map(v => ({ id: v.id, type: v.type, initial: v.initial })),
        skills: [],
        states: bot.brain.states.map(s => ({
          id: s.id,
          rules: s.rules.map(r => ({
            id: r.id,
            when: r.when as any,
            intent: { thrust: r.intent.thrust as any, turn: r.intent.turn as any, modules: r.intent.modules as any },
            nextState: r.nextState,
          })),
        })),
      },
      cosmetic: { skinId: 'default', paletteId: 'red' },
    };
    packageHash = createCanonicalGameplay(contractBot).packageHash;
  } catch {
    packageHash = 'pending_valid_geometry';
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Bot Header Card & Archetype Selector */}
      <div className="bg-[#141C24] rounded-xl border border-[#293640] p-3.5 shadow-xl">
        <div className="flex items-center justify-between pb-2.5 border-b border-[#293640] mb-3">
          <div>
            <h2 className="text-base font-bold text-[#F4F1E8] flex items-center gap-2">
              <span>{bot.name}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1B2630] text-[#F1C86B] border border-[#F1C86B]/30">
                rev {bot.revision}
              </span>
            </h2>
            <p className="text-[11px] text-[#94A1AB] font-mono">Tác giả: {bot.author}</p>
          </div>

          <button
            onClick={onOpenAiCollaborator}
            className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#F1C86B]/20 to-[#E8C56C]/30 hover:from-[#F1C86B]/30 hover:to-[#E8C56C]/40 border border-[#F1C86B]/60 text-xs font-semibold text-[#F1C86B] flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(241,200,107,0.15)] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Đề xuất</span>
          </button>
        </div>

        {/* Load Preset Selector */}
        <div className="flex flex-col gap-1.5 mb-3">
          <label className="text-[11px] font-medium text-[#B9C2C9]">Nạp Bộ Mẫu (6 Archetypes v2):</label>
          <div className="grid grid-cols-3 gap-1.5">
            {PRESET_SYNTHS.map(preset => (
              <button
                key={preset.id}
                onClick={() => onLoadPreset(preset)}
                className={`px-2 py-1.5 rounded text-[11px] font-medium transition-all text-left truncate cursor-pointer border ${
                  bot.id === preset.id
                    ? 'bg-[#1B2630] border-[#F1C86B] text-[#F1C86B]'
                    : 'bg-[#0E141A] border-[#293640] text-[#B9C2C9] hover:bg-[#1B2630] hover:text-[#F4F1E8]'
                }`}
                title={preset.name}
              >
                {preset.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Real-time Synth Specifications */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#293640] text-xs font-mono">
          <div className="p-2 rounded bg-[#0E141A] border border-[#293640]">
            <span className="text-[10px] text-[#94A1AB] block">Số Module</span>
            <span className={`font-bold text-sm ${validationReport.totalModules > 24 ? 'text-[#EC6A68]' : 'text-[#F4F1E8]'}`}>
              {validationReport.totalModules} <span className="text-[#94A1AB] font-normal text-xs">/ 24</span>
            </span>
          </div>

          <div className="p-2 rounded bg-[#0E141A] border border-[#293640]">
            <span className="text-[10px] text-[#94A1AB] block">Điểm Ngân Sách</span>
            <span className={`font-bold text-sm ${validationReport.totalCost > 100 ? 'text-[#EC6A68]' : 'text-[#E8C56C]'}`}>
              {validationReport.totalCost} <span className="text-[#94A1AB] font-normal text-xs">/ 100</span>
            </span>
          </div>

          <div className="p-2 rounded bg-[#0E141A] border border-[#293640]">
            <span className="text-[10px] text-[#94A1AB] block">Tốc Độ vMax</span>
            <span className="font-bold text-sm text-[#55C58A]">
              {validationReport.vMax} <span className="text-[10px] font-normal text-[#94A1AB]">m-unit/s</span>
            </span>
          </div>

          <div className="p-2 rounded bg-[#0E141A] border border-[#293640]">
            <span className="text-[10px] text-[#94A1AB] block">Quay wMax</span>
            <span className="font-bold text-sm text-[#7EBBE8]">
              {validationReport.wMax.toFixed(2)} <span className="text-[10px] font-normal text-[#94A1AB]">rad/s</span>
            </span>
          </div>

          <div className="p-2 rounded bg-[#0E141A] border border-[#293640]">
            <span className="text-[10px] text-[#94A1AB] block">Dung Lượng Năng Lượng</span>
            <span className="font-bold text-sm text-[#F1C86B]">
              {validationReport.energyCap} <span className="text-[10px] font-normal text-[#94A1AB]">(+120/s)</span>
            </span>
          </div>

          <div className="p-2 rounded bg-[#0E141A] border border-[#293640]">
            <span className="text-[10px] text-[#94A1AB] block">Tản Nhiệt Động Cơ</span>
            <span className="font-bold text-sm text-[#65C8D4]">
              {validationReport.heatDissipation} <span className="text-[10px] font-normal text-[#94A1AB]">/s</span>
            </span>
          </div>
        </div>
      </div>

      {/* Validation Status Card */}
      <div className={`p-3 rounded-xl border shadow-lg ${
        validationReport.isValid
          ? 'bg-[#141C24] border-[#55C58A]/40'
          : 'bg-[#141C24] border-[#EC6A68]/40'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          {validationReport.isValid ? (
            <CheckCircle2 className="w-4 h-4 text-[#55C58A]" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[#EC6A68]" />
          )}
          <span className="text-xs font-bold text-[#F4F1E8]">
            {validationReport.isValid ? 'Cấu Trúc Hợp Lệ (Ranked Ready)' : 'Cần Chỉnh Sửa'}
          </span>
          <span className="text-[10px] font-mono text-[#94A1AB] ml-auto">
            Bán kính: {(validationReport.boundingRadiusMilli / 1000).toFixed(2)} / 6.5u
          </span>
        </div>

        {validationReport.errors.length > 0 ? (
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
            {validationReport.errors.map((err, i) => (
              <div
                key={i}
                className={`text-[11px] p-1.5 rounded flex items-start gap-1.5 leading-snug ${
                  err.type === 'error'
                    ? 'bg-[#EC6A68]/15 text-[#EC6A68] border border-[#EC6A68]/30'
                    : 'bg-[#F0B85B]/15 text-[#F0B85B] border border-[#F0B85B]/30'
                }`}
              >
                <span>•</span>
                <span>{err.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[#55C58A]">
            Tất cả tiêu chuẩn Giao tranh & Ranked đều đạt chuẩn. Đầy đủ liên kết Core, vũ khí và động cơ.
          </p>
        )}

        {validationReport.isValid && (
          <div className="mt-2 pt-2 border-t border-[#293640] flex items-center justify-between text-[10px] font-mono text-[#94A1AB]">
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3 text-[#F1C86B]" />
              <span>Package Hash:</span>
            </span>
            <span className="text-[#F1C86B] truncate max-w-[200px]" title={packageHash}>
              {packageHash.slice(0, 16)}...
            </span>
          </div>
        )}
      </div>

      {/* Selected Module Detail Inspector */}
      {selectedModule && selectedCat && (
        <div className="bg-[#141C24] rounded-xl border border-[#293640] p-3 shadow-xl">
          <h4 className="text-xs font-bold text-[#F1EADC] uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Chi Tiết Module Được Chọn</span>
            <span className="font-mono text-[#F1C86B] text-[11px]">{selectedCat.vietnameseName}</span>
          </h4>

          <div className="space-y-1.5 text-xs">
            <p className="text-[11px] text-[#B9C2C9]">{selectedCat.description}</p>

            <div className="grid grid-cols-2 gap-1.5 pt-2 text-[11px] font-mono border-t border-[#293640]">
              <span className="text-[#94A1AB]">Độ bền HP: <strong className="text-[#55C58A]">{selectedCat.hp}</strong></span>
              <span className="text-[#94A1AB]">Khối lượng: <strong className="text-[#F4F1E8]">{selectedCat.mass}</strong></span>
              <span className="text-[#94A1AB]">Chi phí điểm: <strong className="text-[#E8C56C]">{selectedCat.cost} pts</strong></span>
              <span className="text-[#94A1AB]">Tọa độ: <strong className="text-[#F1C86B]">({selectedModule.cell.x}, {selectedModule.cell.y})</strong></span>
            </div>

            {selectedCat.weaponStats && (
              <div className="p-2 rounded bg-[#0E141A] border border-[#293640] mt-2 space-y-1 text-[11px] font-mono">
                <div className="flex justify-between text-[#EC6A68]">
                  <span>Sát thương: <strong>{selectedCat.weaponStats.damage}</strong></span>
                  <span>Tầm quét: <strong>{selectedCat.weaponStats.reachOrRange}u</strong></span>
                </div>
                <div className="flex justify-between text-[#94A1AB]">
                  <span>Nhịp: <strong>{selectedCat.weaponStats.windup}/{selectedCat.weaponStats.active}/{selectedCat.weaponStats.recovery} ticks</strong></span>
                </div>
                <div className="flex justify-between text-[#F0B85B]">
                  <span>Tiêu thụ: <strong>{selectedCat.weaponStats.energyCost} Energy</strong></span>
                  <span>Nhiệt: <strong>+{selectedCat.weaponStats.heatCost} Heat</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action CTA Bar */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={onOpenExperiment}
          className="py-2.5 px-3 rounded-xl bg-[#1B2630] hover:bg-[#25323D] border border-[#F1C86B]/40 hover:border-[#F1C86B] text-xs font-bold text-[#F1C86B] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          title="Chạy thử nghiệm đối chứng A/B đa kịch bản"
        >
          <Activity className="w-4 h-4 text-[#F1C86B]" />
          <span>Thí Nghiệm A/B</span>
        </button>

        <button
          onClick={onTestInArena}
          className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#F1C86B] to-[#E8C56C] hover:opacity-95 text-[#090D11] text-xs font-extrabold flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(241,200,107,0.3)] transition-all cursor-pointer"
        >
          <Swords className="w-4 h-4" />
          <span>Vào Đấu Trường</span>
        </button>

        <button
          onClick={onResetBody}
          className="p-2.5 rounded-xl bg-[#1B2630] hover:bg-[#25323D] border border-[#293640] text-[#94A1AB] hover:text-[#EC6A68] transition-colors cursor-pointer"
          title="Xóa trắng để lắp ráp lại từ đầu"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
