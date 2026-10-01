import React, { useState, useRef, useEffect } from 'react';
import { PlacedModule, ModuleCatalogId } from '../../types/game';
import { MODULE_CATALOG } from '../../data/catalog';
import { RotateCw, Trash2, Crosshair, Eye, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface GridCanvasProps {
  modules: PlacedModule[];
  selectedModuleId: string | null;
  onSelectModule: (id: string | null) => void;
  onPlaceModule: (cell: { x: number; y: number }) => void;
  onRotateModule: (id: string) => void;
  onDeleteModule: (id: string) => void;
  activePaletteId: ModuleCatalogId | null;
  activeOrientation: 0 | 1 | 2 | 3;
}

export const GridCanvas: React.FC<GridCanvasProps> = ({
  modules,
  selectedModuleId,
  onSelectModule,
  onPlaceModule,
  onRotateModule,
  onDeleteModule,
  activePaletteId,
  activeOrientation,
}) => {
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [showRadiusGuide, setShowRadiusGuide] = useState(true);
  const [zoom, setZoom] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cell size in px
  const CELL_SIZE = 40 * zoom;
  const GRID_SIZE = 12;
  const CANVAS_WIDTH = CELL_SIZE * GRID_SIZE;
  const CANVAS_HEIGHT = CELL_SIZE * GRID_SIZE;

  // Find Core center
  const coreModule = modules.find(m => m.catalogId === 'core');
  const coreCenterX = coreModule ? coreModule.cell.x + 1 : 6;
  const coreCenterY = coreModule ? coreModule.cell.y + 1 : 6;

  // Draw Grid & Modules on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background (Arena void #0E141A)
    ctx.fillStyle = '#0E141A';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid lines
    ctx.strokeStyle = '#293640';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      // Vertical
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_HEIGHT);
      ctx.stroke();

      // Horizontal
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_WIDTH, i * CELL_SIZE);
      ctx.stroke();
    }

    // Grid coordinate numbers (0..11)
    ctx.fillStyle = '#8193A0';
    ctx.font = `${Math.max(9, 10 * zoom)}px 'IBM Plex Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < GRID_SIZE; i++) {
      ctx.fillText(`${i}`, i * CELL_SIZE + CELL_SIZE / 2, 12);
      ctx.fillText(`${i}`, 12, i * CELL_SIZE + CELL_SIZE / 2);
    }

    // Bounding radius circle (6.5 units from Core center)
    if (showRadiusGuide) {
      ctx.strokeStyle = 'rgba(241, 200, 107, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(
        coreCenterX * CELL_SIZE,
        coreCenterY * CELL_SIZE,
        6.5 * CELL_SIZE,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.setLineDash([]);

      // Center crosshair
      ctx.strokeStyle = 'rgba(241, 200, 107, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(coreCenterX * CELL_SIZE - 10, coreCenterY * CELL_SIZE);
      ctx.lineTo(coreCenterX * CELL_SIZE + 10, coreCenterY * CELL_SIZE);
      ctx.moveTo(coreCenterX * CELL_SIZE, coreCenterY * CELL_SIZE - 10);
      ctx.lineTo(coreCenterX * CELL_SIZE, coreCenterY * CELL_SIZE + 10);
      ctx.stroke();
    }

    // Draw placed modules
    for (const m of modules) {
      const catalog = MODULE_CATALOG[m.catalogId];
      if (!catalog) continue;

      const isSelected = m.id === selectedModuleId;
      const w = catalog.footprint.w * CELL_SIZE;
      const h = catalog.footprint.h * CELL_SIZE;
      const px = m.cell.x * CELL_SIZE;
      const py = m.cell.y * CELL_SIZE;

      ctx.save();
      ctx.translate(px, py);

      // Core module 2x2 special rendering
      if (m.catalogId === 'core') {
        // Alloy chassis base
        ctx.fillStyle = '#141C24';
        ctx.fillRect(2, 2, w - 4, h - 4);
        ctx.strokeStyle = isSelected ? '#F1EADC' : '#39434C';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(2, 2, w - 4, h - 4);

        // Living Ceramic inner plates
        ctx.fillStyle = '#D9D4C8';
        ctx.fillRect(8, 8, w - 16, h - 16);

        // Golden Core concentric circles (#F1C86B)
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = '#141C24';
        ctx.beginPath();
        ctx.arc(cx, cy, 22 * zoom, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#F1C86B';
        ctx.lineWidth = 3 * zoom;
        ctx.beginPath();
        ctx.arc(cx, cy, 18 * zoom, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#F1C86B';
        ctx.beginPath();
        ctx.arc(cx, cy, 8 * zoom, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#090D11';
        ctx.beginPath();
        ctx.arc(cx, cy, 3 * zoom, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = '#F4F1E8';
        ctx.font = `bold ${Math.max(10, 11 * zoom)}px 'Inter', sans-serif`;
        ctx.fillText('CORE 2x2', cx, cy + 28 * zoom);
      } else {
        // Standard 1x1 modules
        // Base plate (Living Ceramic #D9D4C8)
        ctx.fillStyle = isSelected ? '#F1EADC' : '#D9D4C8';
        ctx.fillRect(3, 3, w - 6, h - 6);

        // Alloy border and chamfers (#39434C)
        ctx.strokeStyle = isSelected ? '#F1C86B' : '#39434C';
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.strokeRect(3, 3, w - 6, h - 6);

        // Dark inner slot (#141C24)
        ctx.fillStyle = '#141C24';
        ctx.fillRect(7, 7, w - 14, h - 14);

        // Orientation notch / chevron
        const rotCenter = CELL_SIZE / 2;
        ctx.save();
        ctx.translate(rotCenter, rotCenter);
        // Orientation: 0 = +X (East/Right), 1 = +Y (South/Down in canvas or North/Up), let's map: 0 = 0 deg, 1 = -90 deg (+Y up in game coordinates)
        const angle = -m.orientation * (Math.PI / 2);
        ctx.rotate(angle);

        // Module glyphs and visual identifiers
        if (m.catalogId === 'thruster') {
          // Dual exhaust vents
          ctx.fillStyle = '#8193A0';
          ctx.fillRect(-8, -4, 4, 8);
          ctx.fillRect(-2, -4, 4, 8);
          ctx.fillStyle = '#F0B85B';
          ctx.beginPath();
          ctx.moveTo(-10, -3);
          ctx.lineTo(-14, 0);
          ctx.lineTo(-10, 3);
          ctx.fill();
        } else if (m.catalogId === 'blade') {
          // Sharp angular slash
          ctx.strokeStyle = '#55C58A';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-6, -6);
          ctx.lineTo(8, 0);
          ctx.lineTo(-6, 6);
          ctx.stroke();
        } else if (m.catalogId === 'lance') {
          // Piercing needle
          ctx.fillStyle = '#EC6A68';
          ctx.beginPath();
          ctx.moveTo(-6, -3);
          ctx.lineTo(10, 0);
          ctx.lineTo(-6, 3);
          ctx.fill();
        } else if (m.catalogId === 'burst') {
          // 3 dots
          ctx.fillStyle = '#7EBBE8';
          ctx.beginPath();
          ctx.arc(6, -4, 2, 0, Math.PI * 2);
          ctx.arc(6, 0, 2, 0, Math.PI * 2);
          ctx.arc(6, 4, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (m.catalogId === 'shield') {
          // Concave shield arc
          ctx.strokeStyle = '#65C8D4';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, 8, -Math.PI / 3, Math.PI / 3);
          ctx.stroke();
        } else if (m.catalogId === 'armor') {
          // Solid cross plate
          ctx.fillStyle = '#8193A0';
          ctx.fillRect(-6, -6, 12, 12);
          ctx.strokeStyle = '#D9D4C8';
          ctx.lineWidth = 1;
          ctx.strokeRect(-4, -4, 8, 8);
        } else if (m.catalogId === 'breaker') {
          // Fractured crack
          ctx.strokeStyle = '#F0B85B';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-6, -6);
          ctx.lineTo(0, 0);
          ctx.lineTo(6, 6);
          ctx.stroke();
        } else if (m.catalogId === 'capacitor') {
          // 3 vertical charge lines
          ctx.fillStyle = '#F1C86B';
          ctx.fillRect(-5, -5, 2, 10);
          ctx.fillRect(-1, -5, 2, 10);
          ctx.fillRect(3, -5, 2, 10);
        } else if (m.catalogId === 'radiator') {
          // Cooling fins
          ctx.strokeStyle = '#65C8D4';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-6, -4); ctx.lineTo(6, -4);
          ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
          ctx.moveTo(-6, 4); ctx.lineTo(6, 4);
          ctx.stroke();
        }

        ctx.restore();

        // Small tag
        ctx.fillStyle = '#F4F1E8';
        ctx.font = `600 ${Math.max(8, 9 * zoom)}px 'Inter', sans-serif`;
        ctx.fillText(m.catalogId.slice(0, 3).toUpperCase(), CELL_SIZE / 2, CELL_SIZE / 2 + 10 * zoom);
      }

      ctx.restore();
    }

    // Draw Ghost Placement Preview
    if (hoverCell && activePaletteId) {
      const cat = MODULE_CATALOG[activePaletteId];
      if (cat) {
        const w = cat.footprint.w * CELL_SIZE;
        const h = cat.footprint.h * CELL_SIZE;
        const px = hoverCell.x * CELL_SIZE;
        const py = hoverCell.y * CELL_SIZE;

        ctx.fillStyle = 'rgba(241, 200, 107, 0.25)';
        ctx.fillRect(px, py, w, h);
        ctx.strokeStyle = '#F1C86B';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(px, py, w, h);
        ctx.setLineDash([]);
      }
    }
  }, [modules, selectedModuleId, hoverCell, showRadiusGuide, zoom, activePaletteId, activeOrientation, coreCenterX, coreCenterY]);

  // Click handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const cellX = Math.floor(clickX / CELL_SIZE);
    const cellY = Math.floor(clickY / CELL_SIZE);

    if (cellX < 0 || cellX >= GRID_SIZE || cellY < 0 || cellY >= GRID_SIZE) return;

    // Check if clicked an existing module
    const clickedModule = modules.find(m => {
      const cat = MODULE_CATALOG[m.catalogId];
      const w = cat?.footprint.w || 1;
      const h = cat?.footprint.h || 1;
      return cellX >= m.cell.x && cellX < m.cell.x + w && cellY >= m.cell.y && cellY < m.cell.y + h;
    });

    if (clickedModule) {
      onSelectModule(clickedModule.id);
    } else {
      // Empty cell -> place module
      onPlaceModule({ x: cellX, y: cellY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cellX = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const cellY = Math.floor((e.clientY - rect.top) / CELL_SIZE);

    if (cellX >= 0 && cellX < GRID_SIZE && cellY >= 0 && cellY < GRID_SIZE) {
      setHoverCell({ x: cellX, y: cellY });
    } else {
      setHoverCell(null);
    }
  };

  const selectedModule = modules.find(m => m.id === selectedModuleId);

  return (
    <div className="flex flex-col items-center justify-center p-3 lg:p-4 bg-[#141C24] rounded-xl border border-[#293640] shadow-xl w-full">
      {/* Top canvas controls toolbar */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-[#293640] mb-3 text-xs text-[#B9C2C9]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[#F4F1E8] font-medium">Lưới 12×12</span>
          <span className="text-[#94A1AB]">|</span>
          <span className="text-[#94A1AB] font-mono">
            {hoverCell ? `Ô: (${hoverCell.x}, ${hoverCell.y})` : 'Di chuột để căn vị trí'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRadiusGuide(!showRadiusGuide)}
            className={`px-2 py-1 rounded flex items-center gap-1.5 transition-colors cursor-pointer border ${
              showRadiusGuide
                ? 'bg-[#1B2630] text-[#F1C86B] border-[#F1C86B]/40'
                : 'text-[#8193A0] hover:text-[#F4F1E8] border-[#293640]'
            }`}
            title="Bật/tắt vòng giới hạn bán kính 6.5 unit"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Giới hạn 6.5u</span>
          </button>

          <button
            onClick={() => setZoom(Math.max(0.8, zoom - 0.1))}
            className="p-1 rounded bg-[#1B2630] border border-[#293640] hover:text-[#F4F1E8] text-[#8193A0] cursor-pointer"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] text-[#94A1AB] w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(Math.min(1.4, zoom + 0.1))}
            className="p-1 rounded bg-[#1B2630] border border-[#293640] hover:text-[#F4F1E8] text-[#8193A0] cursor-pointer"
            title="Phóng to"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid Canvas */}
      <div className="relative overflow-auto max-w-full rounded-lg border border-[#293640] shadow-inner bg-[#0E141A]">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverCell(null)}
          className="cursor-crosshair block"
        />
      </div>

      {/* Selected Module Quick Action Bar */}
      {selectedModule && (
        <div className="mt-3 w-full p-2.5 rounded-lg bg-[#1B2630] border border-[#8193A0]/30 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#F1EADC]">
              Đang chọn: <span className="text-[#F1C86B] font-mono">{MODULE_CATALOG[selectedModule.catalogId]?.vietnameseName}</span> ({selectedModule.id})
            </span>
            <span className="text-[11px] font-mono text-[#94A1AB]">
              Ô ({selectedModule.cell.x}, {selectedModule.cell.y}) • Hướng: {selectedModule.orientation * 90}°
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedModule.catalogId !== 'core' && (
              <button
                onClick={() => onRotateModule(selectedModule.id)}
                className="px-2.5 py-1 rounded bg-[#25323D] hover:bg-[#39434C] text-[#F4F1E8] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-[#8193A0]/30"
              >
                <RotateCw className="w-3.5 h-3.5 text-[#F1C86B]" />
                Xoay 90°
              </button>
            )}

            {selectedModule.catalogId !== 'core' && (
              <button
                onClick={() => onDeleteModule(selectedModule.id)}
                className="px-2.5 py-1 rounded bg-[#EC6A68]/20 hover:bg-[#EC6A68]/30 text-[#EC6A68] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-[#EC6A68]/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Gỡ bỏ
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
