import React, { useState, useEffect } from 'react';
import { BrainSource } from '../../types/game';
import { Code, Check, AlertCircle, Copy, CheckCircle2, Cpu } from 'lucide-react';
import { BrainCompiler, CompilerDiagnostic } from '@nextgame/brain';
import { parseJsonRejectDuplicates } from '@nextgame/contracts';

interface SourceCodeEditorProps {
  brain: BrainSource;
  onSaveBrain: (updated: BrainSource) => void;
}

export const SourceCodeEditor: React.FC<SourceCodeEditorProps> = ({
  brain,
  onSaveBrain,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [diagnostics, setDiagnostics] = useState<CompilerDiagnostic[]>([]);
  const [compileStats, setCompileStats] = useState<{ totalNodes: number; stateCount: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setJsonText(JSON.stringify(brain, null, 2));
    try {
      const compiler = new BrainCompiler();
      const res = compiler.compile(brain as any);
      setDiagnostics(res.diagnostics);
      if (res.ir) {
        setCompileStats({ totalNodes: res.ir.totalNodes, stateCount: res.ir.states.length });
      }
    } catch (err: any) {
      setDiagnostics([{ type: 'error', code: 'EXCEPTION', message: err.message }]);
      setCompileStats(null);
    }
  }, [brain]);

  const handleApply = () => {
    try {
      // 1. Strict JSON duplicate key check & prototype pollution guard
      const parsed = parseJsonRejectDuplicates<BrainSource>(jsonText);
      if (!parsed.states || !Array.isArray(parsed.states)) {
        throw new Error('Cấu trúc Brain không hợp lệ: thiếu mảng "states"');
      }

      // 2. Run BrainCompiler diagnostics
      const compiler = new BrainCompiler();
      const res = compiler.compile(parsed as any);
      setDiagnostics(res.diagnostics);

      const hasError = res.diagnostics.some(d => d.type === 'error');
      if (hasError) {
        setCompileStats(null);
        return;
      }

      if (res.ir) {
        setCompileStats({ totalNodes: res.ir.totalNodes, stateCount: res.ir.states.length });
      }

      onSaveBrain(parsed);
    } catch (e: any) {
      setDiagnostics([{ type: 'error', code: 'PARSE_ERROR', message: e.message || 'Lỗi cú pháp JSON' }]);
      setCompileStats(null);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasErrors = diagnostics.some(d => d.type === 'error');

  return (
    <div className="bg-[#141C24] rounded-xl border border-[#293640] p-4 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-[#293640] mb-3">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-[#F1C86B]" />
          <div>
            <h3 className="text-sm font-bold text-[#F4F1E8]">Mã Nguồn JSON Brain (DSL ABI v2.0)</h3>
            <p className="text-[11px] text-[#94A1AB]">Kiểm định nghiêm ngặt cú pháp, AST nodes (≤ 2048) và độ sâu lồng (≤ 16)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {compileStats && !hasErrors ? (
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#55C58A] bg-[#55C58A]/10 border border-[#55C58A]/30 px-2 py-1 rounded">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Hợp lệ ({compileStats.totalNodes}/2048 nodes)</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-[#EC6A68] bg-[#EC6A68]/10 border border-[#EC6A68]/30 px-2 py-1 rounded">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Chưa biên dịch</span>
            </div>
          )}

          <button
            onClick={handleCopy}
            className="px-2.5 py-1 rounded bg-[#1B2630] border border-[#293640] hover:text-[#F4F1E8] text-xs font-mono text-[#94A1AB] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#55C58A]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>

          <button
            onClick={handleApply}
            className="px-3 py-1 rounded bg-[#E8C56C] hover:bg-[#F1C86B] text-[#090D11] text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Biên Dịch & Lưu</span>
          </button>
        </div>
      </div>

      {diagnostics.length > 0 && (
        <div className="mb-3 space-y-1">
          {diagnostics.map((d, i) => (
            <div
              key={i}
              className={`p-2 rounded text-xs font-mono flex items-center gap-2 border ${
                d.type === 'error'
                  ? 'bg-[#EC6A68]/15 border-[#EC6A68]/40 text-[#EC6A68]'
                  : 'bg-[#F0B85B]/15 border-[#F0B85B]/40 text-[#F0B85B]'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                <strong>[{d.code}]</strong> {d.message}
              </span>
            </div>
          ))}
        </div>
      )}

      <textarea
        value={jsonText}
        onChange={e => setJsonText(e.target.value)}
        className="flex-1 w-full bg-[#0E141A] border border-[#293640] rounded-lg p-3 text-xs font-mono text-[#F1EADC] focus:border-[#F1C86B] focus:outline-none resize-none leading-relaxed min-h-[440px]"
        spellCheck={false}
      />
    </div>
  );
};

