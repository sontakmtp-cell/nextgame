import React from 'react';
import { Shield, Cpu, Swords, Trophy, Bot, Sparkles, Radio } from 'lucide-react';

export type NavTab = 'workshop' | 'brain' | 'arena' | 'ranked' | 'mysynths';

interface HeaderProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  activeSynthName: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  activeSynthName,
}) => {
  const tabs = [
    { id: 'workshop', label: 'Workshop', viLabel: 'Xưởng chế tác', icon: Shield },
    { id: 'brain', label: 'Brain Lab', viLabel: 'Phòng Trí tuệ', icon: Cpu },
    { id: 'arena', label: 'Arena & Replay', viLabel: 'Đấu trường', icon: Swords },
    { id: 'ranked', label: 'Ranked & BXH', viLabel: 'Đấu hạng BO2', icon: Trophy },
    { id: 'mysynths', label: 'My Synths', viLabel: 'Kho Bot', icon: Bot },
  ];

  return (
    <header className="h-16 border-b border-[#293640] bg-[#0E141A]/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-6 flex items-center justify-between">
      {/* Brand & Logo */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#141C24] border border-[#F1C86B]/60 flex items-center justify-center shadow-[0_0_12px_rgba(241,200,107,0.15)]">
            <div className="w-4 h-4 rounded-full border-2 border-[#F1C86B] flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F1C86B]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-base lg:text-lg text-[#F4F1E8]">
                PROMPT <span className="text-[#F1C86B]">CHIẾN</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1B2630] border border-[#293640] text-[#94A1AB]">
                v2.0
              </span>
            </div>
            <p className="text-[10px] text-[#94A1AB] font-mono hidden sm:block">
              Build intelligence. Prove it in battle.
            </p>
          </div>
        </div>

        {/* Current Active Synth indicator */}
        <div className="hidden xl:flex items-center gap-2 pl-4 border-l border-[#293640]">
          <span className="text-xs text-[#94A1AB]">Synth:</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#1B2630] border border-[#8193A0]/30 text-[#F1EADC]">
            {activeSynthName}
          </span>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <nav className="flex items-center gap-1 sm:gap-1.5">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as NavTab)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#25323D] text-[#F1EADC] border border-[#8193A0]/60 shadow-[0_2px_8px_rgba(0,0,0,0.4)]'
                  : 'text-[#B9C2C9] hover:text-[#F4F1E8] hover:bg-[#141C24] border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#F1C86B]' : 'text-[#8193A0]'}`} />
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden">{tab.viLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Status & Account */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* MCP Connection Status */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#141C24] border border-[#293640] text-[11px] font-mono text-[#55C58A]">
          <Radio className="w-3 h-3 animate-pulse text-[#55C58A]" />
          <span>MCP Host v2</span>
        </div>

        {/* Ruleset Digest */}
        <div className="hidden 2xl:flex items-center gap-1 px-2 py-1 rounded bg-[#141C24] border border-[#293640] text-[10px] font-mono text-[#94A1AB]">
          <span>digest:</span>
          <span className="text-[#E8C56C]">#alpha-0</span>
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#293640]">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-[#F4F1E8]">Commander Sontak</div>
            <div className="text-[10px] font-mono text-[#F1C86B]">2,140 Elo • Master</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1B2630] to-[#25323D] border border-[#8193A0]/40 flex items-center justify-center font-bold text-xs text-[#F1C86B]">
            SK
          </div>
        </div>
      </div>
    </header>
  );
};
