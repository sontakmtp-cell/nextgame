// Renderer-only entry; application must lazy-load runtime. No gameplay authority.
export type { PresentationMode, Quality, SceneViewportProps, SynthVisualProps, SynthPreviewProps, ArenaSceneProps, PresentationManifest, WorkshopSceneProps, CameraState, CellSelection, ModuleSelection, AssetLevel, ModulePresentation, DeepReadonly } from './interfaces.js';
export { SceneViewport, workshopCamera, arenaCamera } from './SceneViewport.js';
export { SynthVisual } from './SynthVisual.js';
export { SynthPreview, WorkshopScene, ArenaScene } from './Scenes.js';
export { WorkshopStage, ArenaStage } from './Stages.js';
export type { ArenaLayout } from './interfaces.js';
export { fitPreviewCamera } from './geometry.js';
