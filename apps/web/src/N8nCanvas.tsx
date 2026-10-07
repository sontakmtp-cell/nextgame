import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { BotDefinition } from '@prompt-chien/contracts';
import { conditionSummary } from './brain-library.js';

export type N8nNodeType = 'state' | 'condition' | 'action' | 'transition';

export interface N8nNodeData {
  id: string;
  type: N8nNodeType;
  title: string;
  subtitle: string;
  stateIndex: number;
  ruleIndex?: number;
  details?: Record<string, unknown>;
}

interface WireConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromPort: 'out' | 'true' | 'false';
  toPort: 'in';
  wireType: 'flow' | 'true' | 'false' | 'transition';
}

interface N8nCanvasProps {
  bot: BotDefinition;
  stateIndex: number;
  ruleIndex: number;
  onSelectState: (stateIdx: number) => void;
  onSelectRule: (ruleIdx: number) => void;
  onSelectNode?: (nodeData: N8nNodeData) => void;
}

export default function N8nCanvas({
  bot,
  stateIndex,
  ruleIndex,
  onSelectState,
  onSelectRule,
  onSelectNode,
}: N8nCanvasProps) {
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(1);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const draggingNodeRef = useRef<string | null>(null);
  const dragStartMouseRef = useRef({ x: 0, y: 0 });
  const dragStartNodePosRef = useRef({ x: 0, y: 0 });

  const currentState = bot.brain.states[stateIndex];

  // Build nodes and wires from currentState
  const { nodes, wires } = useMemo(() => {
    if (!currentState) return { nodes: [], wires: [] };

    const nodeList: N8nNodeData[] = [];
    const wireList: WireConnection[] = [];

    // 1. State Node
    const isInitial = bot.brain.initialState === currentState.id;
    const stateNodeId = `state-${currentState.id}`;
    nodeList.push({
      id: stateNodeId,
      type: 'state',
      title: isInitial ? `START: ${currentState.id}` : `STATE: ${currentState.id}`,
      subtitle: `${currentState.rules.length} quy tắc điều kiện FSM`,
      stateIndex,
    });

    // 2. Rules
    currentState.rules.forEach((rule, rIdx) => {
      const condId = `cond-${currentState.id}-${rIdx}`;
      const actId = `act-${currentState.id}-${rIdx}`;
      const transId = `trans-${currentState.id}-${rIdx}`;

      // Condition Node
      const conditionText = 'when' in rule ? conditionSummary(rule.when) : `Kỹ năng: ${rule.useSkill}`;

      nodeList.push({
        id: condId,
        type: 'condition',
        title: `${rIdx + 1}. ${rule.id}`,
        subtitle: conditionText,
        stateIndex,
        ruleIndex: rIdx,
        details: { conditionText },
      });

      // Wire: State -> First Condition, or Previous Condition False -> This Condition
      if (rIdx === 0) {
        wireList.push({
          id: `wire-state-${condId}`,
          fromNodeId: stateNodeId,
          toNodeId: condId,
          fromPort: 'out',
          toPort: 'in',
          wireType: 'flow',
        });
      } else {
        const prevCondId = `cond-${currentState.id}-${rIdx - 1}`;
        wireList.push({
          id: `wire-fallback-${prevCondId}-${condId}`,
          fromNodeId: prevCondId,
          toNodeId: condId,
          fromPort: 'false',
          toPort: 'in',
          wireType: 'false',
        });
      }

      // Action Node
      if ('intent' in rule && rule.intent) {
        const fwd = rule.intent.thrust.forward.kind === 'const' ? rule.intent.thrust.forward.value : '?';
        const str = rule.intent.thrust.strafe.kind === 'const' ? rule.intent.thrust.strafe.value : '?';
        const turn = rule.intent.turn.kind === 'const' ? rule.intent.turn.value : '?';
        const activeModules = rule.intent.modules?.length ?? 0;

        nodeList.push({
          id: actId,
          type: 'action',
          title: `Hành động: ${rule.id}`,
          subtitle: `Tiến: ${fwd} | Ngang: ${str} | Xoay: ${turn}${activeModules > 0 ? ` | Vũ khí: ${activeModules}` : ''}`,
          stateIndex,
          ruleIndex: rIdx,
          details: { fwd, str, turn },
        });

        // Wire: Condition True -> Action
        wireList.push({
          id: `wire-true-${condId}-${actId}`,
          fromNodeId: condId,
          toNodeId: actId,
          fromPort: 'true',
          toPort: 'in',
          wireType: 'true',
        });

        // Transition Node (if nextState is defined)
        if ('nextState' in rule && rule.nextState) {
          nodeList.push({
            id: transId,
            type: 'transition',
            title: `Chuyển: → ${rule.nextState}`,
            subtitle: `Chuyển mạch FSM sang state [${rule.nextState}]`,
            stateIndex,
            ruleIndex: rIdx,
            details: { nextState: rule.nextState },
          });

          // Wire: Action -> Transition
          wireList.push({
            id: `wire-trans-${actId}-${transId}`,
            fromNodeId: actId,
            toNodeId: transId,
            fromPort: 'out',
            toPort: 'in',
            wireType: 'transition',
          });
        }
      }
    });

    return { nodes: nodeList, wires: wireList };
  }, [currentState, bot.brain.initialState, stateIndex]);

  // Auto-Layout function: arranged cleanly in n8n columns (left to right)
  const autoLayout = useCallback(() => {
    const newPositions: Record<string, { x: number; y: number }> = {};
    if (!currentState) return;

    const startX = 60;
    const col2X = 350;
    const col3X = 670;
    const col4X = 990;

    const rowSpacing = 160;
    const startY = 80;

    // State Node in Col 1, aligned with first rule at startY for clear waterfall flow
    newPositions[`state-${currentState.id}`] = { x: startX, y: startY };

    currentState.rules.forEach((_, rIdx) => {
      const condId = `cond-${currentState.id}-${rIdx}`;
      const actId = `act-${currentState.id}-${rIdx}`;
      const transId = `trans-${currentState.id}-${rIdx}`;
      const y = startY + rIdx * rowSpacing;

      newPositions[condId] = { x: col2X, y };
      newPositions[actId] = { x: col3X, y };
      newPositions[transId] = { x: col4X, y };
    });

    setNodePositions((prev) => ({ ...prev, ...newPositions }));
    setPan({ x: 40, y: 40 });
    setZoom(1);
  }, [currentState]);

  // Initial auto-layout when state changes
  useEffect(() => {
    autoLayout();
  }, [currentState?.id, autoLayout]);

  // Highlight selected rule's condition node by default
  useEffect(() => {
    if (currentState?.rules[ruleIndex]) {
      setSelectedNodeId(`cond-${currentState.id}-${ruleIndex}`);
    }
  }, [ruleIndex, currentState?.id, currentState?.rules]);

  // Handle pan
  const onMouseDownCanvas = (e: React.MouseEvent) => {
    // If clicked on canvas background
    if ((e.target as HTMLElement).closest('.n8n-node')) return;
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const onMouseMoveCanvas = (e: React.MouseEvent) => {
    if (isPanningRef.current) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    } else if (draggingNodeRef.current) {
      const dx = (e.clientX - dragStartMouseRef.current.x) / zoom;
      const dy = (e.clientY - dragStartMouseRef.current.y) / zoom;
      const nodeId = draggingNodeRef.current;
      setNodePositions((prev) => ({
        ...prev,
        [nodeId]: {
          x: Math.round(dragStartNodePosRef.current.x + dx),
          y: Math.round(dragStartNodePosRef.current.y + dy),
        },
      }));
    }
  };

  const onMouseUpCanvas = () => {
    isPanningRef.current = false;
    draggingNodeRef.current = null;
  };

  // Handle zoom with wheel
  const onWheelCanvas = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((z) => Math.min(1.8, Math.max(0.4, Number((z + delta).toFixed(2)))));
  };

  // Node Drag Start
  const startDragNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    draggingNodeRef.current = nodeId;
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
    const currentPos = nodePositions[nodeId] || { x: 0, y: 0 };
    dragStartNodePosRef.current = { ...currentPos };

    // Find node data
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      if (typeof node.ruleIndex === 'number') {
        onSelectRule(node.ruleIndex);
      }
      onSelectState(node.stateIndex);
      onSelectNode?.(node);
    }
  };

  // Calculate Port Position helper with deterministic fallback
  const getNodePortPos = (nodeId: string, port: 'in' | 'out' | 'true' | 'false') => {
    let pos = nodePositions[nodeId];
    if (!pos && currentState) {
      const startX = 60;
      const col2X = 350;
      const col3X = 670;
      const col4X = 990;
      const rowSpacing = 160;
      const startY = 80;

      if (nodeId.startsWith('state-')) {
        pos = { x: startX, y: startY };
      } else {
        const match = nodeId.match(/-(?:cond|act|trans)-.*?-(\d+)$/);
        const rIdx = match ? Number(match[1]) : 0;
        const y = startY + rIdx * rowSpacing;
        if (nodeId.startsWith('cond-')) pos = { x: col2X, y };
        else if (nodeId.startsWith('act-')) pos = { x: col3X, y };
        else if (nodeId.startsWith('trans-')) pos = { x: col4X, y };
      }
    }
    pos = pos || { x: 0, y: 0 };
    const nodeWidth = 230;
    const nodeHeight = 84;

    let x = pos.x;
    let y = pos.y + nodeHeight / 2;

    if (port === 'in') {
      x = pos.x;
      y = pos.y + nodeHeight / 2;
    } else if (port === 'out') {
      x = pos.x + nodeWidth;
      y = pos.y + nodeHeight / 2;
    } else if (port === 'true') {
      x = pos.x + nodeWidth;
      y = pos.y + nodeHeight * 0.35;
    } else if (port === 'false') {
      x = pos.x + nodeWidth;
      y = pos.y + nodeHeight * 0.7;
    }

    return { x, y };
  };

  return (
    <div className="n8n-container">
      {/* Top Toolbar */}
      <div className="n8n-toolbar">
        <div className="n8n-toolbar-left">
          <span className="eyebrow" style={{ margin: 0 }}>
            N8N WORKFLOW GRAPH
          </span>
          <span className="subtle" style={{ color: 'var(--cyan)' }}>
            STATE: {currentState?.id} ({currentState?.rules.length} rules)
          </span>
          <span className="n8n-badge-pulse" title="Tần số nhịp dữ liệu trận đấu thời gian thực">
            ⚡ 10 Hz PULSE SYNC
          </span>
        </div>
        <div className="n8n-toolbar-right">
          <button className="n8n-btn-autolayout" onClick={autoLayout}>
            ⚡ SẮP XẾP N8N
          </button>
          <button onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}>+</button>
          <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}>−</button>
          <button onClick={() => { setZoom(1); setPan({ x: 40, y: 40 }); }}>1:1</button>
        </div>
      </div>

      {/* Viewport */}
      <div
        className="n8n-canvas-viewport"
        ref={containerRef}
        onMouseDown={onMouseDownCanvas}
        onMouseMove={onMouseMoveCanvas}
        onMouseUp={onMouseUpCanvas}
        onMouseLeave={onMouseUpCanvas}
        onWheel={onWheelCanvas}
      >
        <div
          className="n8n-world"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* SVG Wires Layer */}
          <svg className="n8n-wires-svg">
            {wires.map((wire) => {
              const start = getNodePortPos(wire.fromNodeId, wire.fromPort);
              const end = getNodePortPos(wire.toNodeId, wire.toPort);

              const dx = Math.max(Math.abs(end.x - start.x) * 0.5, 40);
              const pathD = `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`;

              let color = '#00f0ff';
              let dash = '';
              if (wire.wireType === 'true') color = '#00ff88';
              if (wire.wireType === 'false') {
                color = '#ff3366';
                dash = '6 4';
              }
              if (wire.wireType === 'transition') color = '#c77dff';

              return (
                <g key={wire.id}>
                  {/* Layer 1: Ambient Neon Glow */}
                  <path
                    d={pathD}
                    className="n8n-wire-path n8n-wire-glow"
                    style={{ stroke: color }}
                  />
                  {/* Layer 2: Core Transmission Wire */}
                  <path
                    d={pathD}
                    className="n8n-wire-path n8n-wire-core"
                    style={{ stroke: color, strokeDasharray: dash }}
                  />
                  {/* Layer 3: Dynamic Pulse Wave (Running Along Wire) */}
                  <path
                    d={pathD}
                    className="n8n-wire-pulse"
                    style={{ stroke: color }}
                  />
                  {/* Layer 4: High-Energy Moving Photons / Packets (10 Hz) */}
                  <path
                    d={pathD}
                    className="n8n-wire-packets"
                    style={{ stroke: '#ffffff' }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Nodes Layer */}
          {nodes.map((node) => {
            const pos = nodePositions[node.id] || { x: 50, y: 50 };
            const isSelected = selectedNodeId === node.id;

            return (
              <div
                key={node.id}
                className={`n8n-node n8n-node-${node.type} ${isSelected ? 'selected' : ''}`}
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                }}
                onMouseDown={(e) => startDragNode(e, node.id)}
              >
                {/* Input port */}
                {node.type !== 'state' && (
                  <div className="n8n-port n8n-port-in" title="Cổng Input">
                    <span className="n8n-port-label">IN</span>
                  </div>
                )}

                {/* Node Header */}
                <div className="n8n-node-header">
                  <span>
                    {node.type === 'state' && '🔵 STATE'}
                    {node.type === 'condition' && '🔷 CẢM BIẾN'}
                    {node.type === 'action' && '🟠 HÀNH ĐỘNG'}
                    {node.type === 'transition' && '🟣 CHUYỂN MẠCH'}
                  </span>
                  <small style={{ color: 'inherit', opacity: 0.8 }}>#{node.ruleIndex !== undefined ? node.ruleIndex + 1 : '0'}</small>
                </div>

                {/* Node Body */}
                <div className="n8n-node-body">
                  <div className="n8n-node-title">{node.title}</div>
                  <div className="n8n-node-desc">{node.subtitle}</div>
                </div>

                {/* Output ports */}
                {node.type === 'state' && (
                  <div className="n8n-port n8n-port-out" title="Cổng Xuất Chu trình FSM">
                    <span className="n8n-port-label">OUT</span>
                  </div>
                )}
                {node.type === 'condition' && (
                  <>
                    <div className="n8n-port n8n-port-true" title="TRUE (Điều kiện Thỏa Mãn)">
                      <span className="n8n-port-label">TRUE</span>
                    </div>
                    <div className="n8n-port n8n-port-false" title="FALSE (Điều kiện Sai - Dự Phòng)">
                      <span className="n8n-port-label">FALSE</span>
                    </div>
                  </>
                )}
                {node.type === 'action' && (
                  <div className="n8n-port n8n-port-out" title="Cổng Xuất Chuyển State">
                    <span className="n8n-port-label">OUT</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
