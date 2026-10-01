import React from 'react';
import { BotDefinition } from '../../types/game';
import { PRESET_SYNTHS } from '../../data/presets';
import { Bot, CheckCircle2, Copy, Download, Upload, Trash2, ArrowRight } from 'lucide-react';

interface MySynthsViewProps {
  synths: BotDefinition[];
  activeSynthId: string;
  onSelectSynth: (bot: BotDefinition) => void;
  onCloneSynth: (bot: BotDefinition) => void;
  onExportJson: (bot: BotDefinition) => void;
  onImportJson: () => void;
  onNavigateToWorkshop: () => void;
}

export const MySynthsView: React.FC<MySynthsViewProps> = ({
  synths,
  activeSynthId,
  onSelectSynth,
  onCloneSynth,
  onExportJson,
  onImportJson,
  onNavigateToWorkshop,
}) => {
  return (
    <div className="p-4 lg:p-6 max-w-[1700px] mx-auto animate-fadeIn space-y-5">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#293640]">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-[#F4F1E8] tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#F1C86B]" />
            <span>Kho Lưu Trữ Synth (My Synths)</span>
          </h1>
          <p className="text-xs text-[#94A1AB]">
            Quản lý các sinh thể cơ khí đã lắp ráp, phả hệ phiên bản và thẻ hành vi Behavior Card
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onImportJson}
            className="px-3 py-1.5 rounded-lg bg-[#141C24] hover:bg-[#1B2630] border border-[#293640] text-xs font-medium text-[#B9C2C9] hover:text-[#F4F1E8] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#7EBBE8]" />
            <span>Nhập File .bot.json</span>
          </button>
        </div>
      </div>

      {/* Grid of Synth Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {synths.map(bot => {
          const isActive = bot.id === activeSynthId;

          return (
            <div
              key={bot.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                isActive
                  ? 'bg-[#1B2630] border-[#F1C86B] shadow-[0_0_16px_rgba(241,200,107,0.15)] ring-1 ring-[#F1C86B]'
                  : 'bg-[#141C24] border-[#293640] hover:border-[#8193A0]/50'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#F4F1E8]">{bot.name}</h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0E141A] text-[#F1C86B] border border-[#293640]">
                      rev {bot.revision}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-[#55C58A] px-2 py-0.5 rounded bg-[#55C58A]/10 border border-[#55C58A]/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Ranked Ready</span>
                  </span>
                </div>

                <div className="text-[11px] font-mono text-[#94A1AB] flex items-center gap-3">
                  <span>Modules: <strong className="text-[#F1EADC]">{bot.body.modules.length}/24</strong></span>
                  <span>Tác giả: <strong className="text-[#F1EADC]">{bot.author}</strong></span>
                </div>

                {/* Behavior Card snippet */}
                <div className="p-2.5 rounded-lg bg-[#0E141A] border border-[#293640] space-y-1 text-xs">
                  <span className="text-[10px] font-mono text-[#F1C86B] font-bold block">
                    Giả Thuyết (Hypothesis):
                  </span>
                  <p className="text-[11px] text-[#B9C2C9] line-clamp-2 leading-relaxed">
                    {bot.behaviorCard.hypothesis}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-[#293640] flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onCloneSynth(bot)}
                    className="p-1.5 rounded hover:bg-[#25323D] text-[#94A1AB] hover:text-[#F4F1E8] transition-colors cursor-pointer"
                    title="Nhân bản bot sang revision mới"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onExportJson(bot)}
                    className="p-1.5 rounded hover:bg-[#25323D] text-[#94A1AB] hover:text-[#F4F1E8] transition-colors cursor-pointer"
                    title="Xuất file .bot.json"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {isActive ? (
                    <button
                      onClick={onNavigateToWorkshop}
                      className="px-3 py-1.5 rounded-lg bg-[#E8C56C] hover:bg-[#F1C86B] text-[#090D11] font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                    >
                      <span>Vào Workshop</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onSelectSynth(bot)}
                      className="px-3 py-1.5 rounded-lg bg-[#25323D] hover:bg-[#39434C] text-[#F1EADC] font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Chọn Sử Dụng
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
