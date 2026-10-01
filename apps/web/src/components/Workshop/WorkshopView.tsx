import React, { useState } from 'react';
import { BotDefinition, PlacedModule, ModuleCatalogId } from '../../types/game';
import { validateSynth } from '../../utils/validation';
import { GridCanvas } from './GridCanvas';
import { ModulePalette } from './ModulePalette';
import { InspectorPanel } from './InspectorPanel';
import { AiCollaboratorModal } from './AiCollaboratorModal';
import { LocalExperimentModal } from './LocalExperimentModal';
import { MODULE_CATALOG } from '../../data/catalog';

interface WorkshopViewProps {
  currentBot: BotDefinition;
  onChangeBot: (updated: BotDefinition) => void;
  onNavigateToArena: () => void;
}

export const WorkshopView: React.FC<WorkshopViewProps> = ({
  currentBot,
  onChangeBot,
  onNavigateToArena,
}) => {
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [activePaletteId, setActivePaletteId] = useState<ModuleCatalogId | null>('thruster');
  const [activeOrientation, setActiveOrientation] = useState<0 | 1 | 2 | 3>(0);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isExperimentModalOpen, setIsExperimentModalOpen] = useState(false);

  const validationReport = validateSynth(currentBot);

  // Place module on grid
  const handlePlaceModule = (cell: { x: number; y: number }) => {
    if (!activePaletteId) return;

    const catalogItem = MODULE_CATALOG[activePaletteId];
    if (!catalogItem) return;

    let updatedModules = [...currentBot.body.modules];

    // If placing Core, remove existing core if any
    if (activePaletteId === 'core') {
      updatedModules = updatedModules.filter(m => m.catalogId !== 'core');
    }

    const newModuleId = `${activePaletteId}_${Date.now().toString().slice(-4)}`;
    const newModule: PlacedModule = {
      id: newModuleId,
      catalogId: activePaletteId,
      cell,
      orientation: activeOrientation,
    };

    updatedModules.push(newModule);

    onChangeBot({
      ...currentBot,
      body: {
        ...currentBot.body,
        modules: updatedModules,
      },
    });

    setSelectedModuleId(newModuleId);
  };

  // Rotate module 90 deg clockwise
  const handleRotateModule = (id: string) => {
    const updated = currentBot.body.modules.map(m => {
      if (m.id === id) {
        return {
          ...m,
          orientation: (((m.orientation + 1) % 4) as 0 | 1 | 2 | 3),
        };
      }
      return m;
    });

    onChangeBot({
      ...currentBot,
      body: {
        ...currentBot.body,
        modules: updated,
      },
    });
  };

  // Delete module
  const handleDeleteModule = (id: string) => {
    const updated = currentBot.body.modules.filter(m => m.id !== id);
    onChangeBot({
      ...currentBot,
      body: {
        ...currentBot.body,
        modules: updated,
      },
    });
    if (selectedModuleId === id) setSelectedModuleId(null);
  };

  // Reset body (keep only Core at 5,5)
  const handleResetBody = () => {
    onChangeBot({
      ...currentBot,
      body: {
        ...currentBot.body,
        modules: [
          { id: 'coreMain', catalogId: 'core', cell: { x: 5, y: 5 }, orientation: 0 },
        ],
      },
    });
    setSelectedModuleId(null);
  };

  const selectedModule = currentBot.body.modules.find(m => m.id === selectedModuleId) || null;

  return (
    <div className="p-4 lg:p-6 max-w-[1700px] mx-auto animate-fadeIn">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-[#293640]">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-[#F4F1E8] tracking-tight">
            Xưởng Chế Tác Synth (Workshop)
          </h1>
          <p className="text-xs text-[#94A1AB]">
            Thiết kế hình học cơ thể trên lưới 12×12 • Ngân sách 100 điểm • Tối đa 24 module
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#94A1AB] font-mono">Chế độ:</span>
          <span className="px-2 py-0.5 rounded bg-[#141C24] border border-[#55C58A]/40 text-[#55C58A] text-xs font-mono font-semibold">
            Gốm Sống / Cốt Graphite
          </span>
        </div>
      </div>

      {/* Main 3-Column Layout according to Docs/06_ART_UX.md */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Module Palette (3 cols) */}
        <div className="lg:col-span-3 order-2 lg:order-1">
          <ModulePalette
            selectedPaletteId={activePaletteId}
            onSelectPaletteId={setActivePaletteId}
            orientation={activeOrientation}
            onChangeOrientation={setActiveOrientation}
          />
        </div>

        {/* Center Column: 12x12 Grid Canvas (6 cols) */}
        <div className="lg:col-span-5 order-1 lg:order-2 flex flex-col items-center">
          <GridCanvas
            modules={currentBot.body.modules}
            selectedModuleId={selectedModuleId}
            onSelectModule={setSelectedModuleId}
            onPlaceModule={handlePlaceModule}
            onRotateModule={handleRotateModule}
            onDeleteModule={handleDeleteModule}
            activePaletteId={activePaletteId}
            activeOrientation={activeOrientation}
          />
        </div>

        {/* Right Column: Inspector & Validation (4 cols) */}
        <div className="lg:col-span-4 order-3">
          <InspectorPanel
            bot={currentBot}
            validationReport={validationReport}
            selectedModule={selectedModule}
            onLoadPreset={onChangeBot}
            onOpenAiCollaborator={() => setIsAiModalOpen(true)}
            onTestInArena={onNavigateToArena}
            onResetBody={handleResetBody}
            onOpenExperiment={() => setIsExperimentModalOpen(true)}
          />
        </div>
      </div>

      {/* AI Collaborator Modal */}
      <AiCollaboratorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        currentBot={currentBot}
        onApplyProposal={onChangeBot}
      />

      {/* Local A/B Experiment Suite Modal */}
      <LocalExperimentModal
        isOpen={isExperimentModalOpen}
        onClose={() => setIsExperimentModalOpen(false)}
        currentBot={currentBot}
      />
    </div>
  );
};
