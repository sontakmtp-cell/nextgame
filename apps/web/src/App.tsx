import React, { useState } from 'react';
import { BotDefinition } from './types/game';
import { PRESET_SYNTHS } from './data/presets';
import { Header, NavTab } from './components/Header';
import { WorkshopView } from './components/Workshop/WorkshopView';
import { BrainLabView } from './components/BrainLab/BrainLabView';
import { ArenaView } from './components/Arena/ArenaView';
import { RankedView } from './components/Ranked/RankedView';
import { MySynthsView } from './components/MySynths/MySynthsView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('workshop');
  const [synths, setSynths] = useState<BotDefinition[]>(PRESET_SYNTHS);
  const [currentBotId, setCurrentBotId] = useState<string>(PRESET_SYNTHS[0].id);

  const currentBot = synths.find(b => b.id === currentBotId) || synths[0];

  // Update current bot
  const handleUpdateCurrentBot = (updatedBot: BotDefinition) => {
    setSynths(prev =>
      prev.map(b => (b.id === updatedBot.id ? updatedBot : b))
    );
  };

  // Clone bot
  const handleCloneSynth = (bot: BotDefinition) => {
    const newId = `${bot.id}-fork-${Date.now().toString().slice(-4)}`;
    const cloned: BotDefinition = {
      ...bot,
      id: newId,
      name: `${bot.name} (Bản sao)`,
      revision: bot.revision + 1,
    };
    setSynths([cloned, ...synths]);
    setCurrentBotId(newId);
  };

  // Export JSON
  const handleExportJson = (bot: BotDefinition) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bot, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${bot.id}.bot.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON
  const handleImportJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event: any) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed.body && parsed.brain) {
            const importedBot: BotDefinition = {
              ...parsed,
              id: `imported-${Date.now().toString().slice(-4)}`,
            };
            setSynths([importedBot, ...synths]);
            setCurrentBotId(importedBot.id);
            setActiveTab('workshop');
          } else {
            alert('File JSON không đúng cấu trúc BotDefinition v2.0');
          }
        } catch (err) {
          alert('Không thể đọc file JSON');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-[#090D11] text-[#F4F1E8] flex flex-col font-sans">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeSynthName={currentBot.name}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {activeTab === 'workshop' && (
          <WorkshopView
            currentBot={currentBot}
            onChangeBot={handleUpdateCurrentBot}
            onNavigateToArena={() => setActiveTab('arena')}
          />
        )}

        {activeTab === 'brain' && (
          <BrainLabView
            currentBot={currentBot}
            onChangeBot={handleUpdateCurrentBot}
          />
        )}

        {activeTab === 'arena' && (
          <ArenaView
            currentBot={currentBot}
            onNavigateToWorkshop={() => setActiveTab('workshop')}
          />
        )}

        {activeTab === 'ranked' && (
          <RankedView currentBot={currentBot} />
        )}

        {activeTab === 'mysynths' && (
          <MySynthsView
            synths={synths}
            activeSynthId={currentBotId}
            onSelectSynth={b => {
              setCurrentBotId(b.id);
              setActiveTab('workshop');
            }}
            onCloneSynth={handleCloneSynth}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onNavigateToWorkshop={() => setActiveTab('workshop')}
          />
        )}
      </main>

      {/* Bottom Status Footer */}
      <footer className="h-10 border-t border-[#293640] bg-[#0E141A] px-4 lg:px-6 flex items-center justify-between text-[11px] font-mono text-[#94A1AB]">
        <div className="flex items-center gap-3">
          <span>PROMPT Chiến v2.0 • Living Ceramic / Graphite Core</span>
          <span className="hidden sm:inline text-[#293640]">|</span>
          <span className="hidden sm:inline">Engine 60 Hz • Brain 10 Hz Deterministic</span>
        </div>
        <div className="flex items-center gap-2 text-[#55C58A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#55C58A] animate-pulse" />
          <span>Local Simulation Ready</span>
        </div>
      </footer>
    </div>
  );
};
export default App;
