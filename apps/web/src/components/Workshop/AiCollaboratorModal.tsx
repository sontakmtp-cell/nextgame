import React, { useState } from 'react';
import { BotDefinition } from '../../types/game';
import { Sparkles, X, Check, ArrowRight, GitCommit, Bot, Zap, RefreshCw } from 'lucide-react';

interface AiCollaboratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBot: BotDefinition;
  onApplyProposal: (updatedBot: BotDefinition) => void;
}

export const AiCollaboratorModal: React.FC<AiCollaboratorModalProps> = ({
  isOpen,
  onClose,
  currentBot,
  onApplyProposal,
}) => {
  const [prompt, setPrompt] = useState(
    'Tôi muốn tối ưu Mantis để khắc phục điểm yếu trước pháo tầm xa Kestrel: bổ sung 1 Tấm Giáp trước cánh và lập trình Brain né sang sườn khi phát hiện đạn bay tới.'
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposalReady, setProposalReady] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setProposalReady(true);
    }, 1200);
  };

  const handleApply = () => {
    // Generate modified bot clone with the proposed armor and updated revision
    const modifiedBot: BotDefinition = {
      ...currentBot,
      name: `${currentBot.name} (AI Optimized)`,
      revision: currentBot.revision + 1,
      body: {
        ...currentBot.body,
        modules: [
          ...currentBot.body.modules,
          { id: 'extraArmor', catalogId: 'armor', cell: { x: 5, y: 7 }, orientation: 0 },
        ],
      },
      behaviorCard: {
        ...currentBot.behaviorCard,
        hypothesis: 'Thêm tấm giáp gốm ở sườn phải và chuyển trạng thái né sang sườn vòng cung khi cự ly > 4.5u.',
      },
    };
    onApplyProposal(modifiedBot);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#090D11]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#141C24] border border-[#293640] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#293640] flex items-center justify-between bg-[#1B2630]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F1C86B]/20 border border-[#F1C86B]/40 flex items-center justify-center text-[#F1C86B]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#F4F1E8]">Đồng Sáng Tạo Cùng AI (MCP Collaborator)</h3>
              <p className="text-[11px] text-[#94A1AB]">Host: Claude 3.7 / Cursor MCP Protocol v2.0</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#25323D] text-[#8193A0] hover:text-[#F4F1E8] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* User Prompt Input */}
          <div className="space-y-1.5">
            <label className="font-semibold text-[#F1EADC] block">
              1. Mục tiêu và ý tưởng điều chỉnh (Prompt):
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={3}
              className="w-full p-3 rounded-lg bg-[#0E141A] border border-[#293640] text-[#F4F1E8] focus:border-[#F1C86B] focus:outline-none font-sans text-xs resize-none"
              placeholder="Nhập yêu cầu chiến thuật, vị trí module muốn thêm/bớt hoặc kịch bản Brain..."
            />
            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-4 py-2 rounded-lg bg-[#E8C56C] hover:bg-[#F1C86B] text-[#090D11] font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang phân tích cấu trúc...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tạo Đề Xuất & Diff</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Response & Diff Preview */}
          {proposalReady && (
            <div className="space-y-3 pt-3 border-t border-[#293640] animate-fadeIn">
              {/* Brief diễn giải */}
              <div className="p-3 rounded-lg bg-[#0E141A] border border-[#293640] space-y-1">
                <span className="text-[10px] font-mono text-[#F1C86B] uppercase font-bold tracking-wider">
                  AI Brief & Hypothesis
                </span>
                <p className="text-[#F4F1E8] font-medium">
                  Hiểu yêu cầu: Giảm tỷ lệ chịu sát thương từ Kestrel bằng cách nâng cấp giáp sườn và điều chỉnh góc lạng lách.
                </p>
                <p className="text-[#B9C2C9] text-[11px]">
                  <strong>Đánh đổi (Trade-off):</strong> Tăng 4 điểm khối lượng ($M = 45 \to 49$), tốc độ tối đa giảm nhẹ 3%, nhưng tăng 300 HP giáp chắn hướng +Y sườn.
                </p>
              </div>

              {/* Proposed Diff */}
              <div className="p-3 rounded-lg bg-[#1B2630] border border-[#8193A0]/30 space-y-2">
                <span className="text-[10px] font-mono text-[#55C58A] uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <GitCommit className="w-3 h-3" />
                  Bản Thay Đổi Đề Xuất (Diff)
                </span>

                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex items-center gap-2 text-[#55C58A]">
                    <span>+ Thêm:</span>
                    <span>1× Giáp Gốm Ceramic Armor tại ô (5, 7)</span>
                    <span className="text-[#94A1AB] ml-auto">+4 pts / +4 mass</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#7EBBE8]">
                    <span>~ Sửa Brain:</span>
                    <span>Quy tắc [evadeOnTelegraph]: tăng strafe từ 600 lên 900</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#F1C86B]">
                    <span>* Validation:</span>
                    <span>Đạt chuẩn (12 modules, 92/100 points, 6.2u radius)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#293640] flex items-center justify-between bg-[#1B2630]">
          <span className="text-[11px] text-[#94A1AB]">
            Thay đổi sẽ tạo phiên bản mới (Revision {currentBot.revision + 1})
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-[#25323D] hover:bg-[#39434C] text-[#B9C2C9] font-medium transition-colors cursor-pointer"
            >
              Hủy
            </button>
            {proposalReady && (
              <button
                onClick={handleApply}
                className="px-4 py-2 rounded-lg bg-[#55C58A] hover:bg-[#47b078] text-[#090D11] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Áp Dụng Thay Đổi</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
