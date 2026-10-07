import type { BotDefinition, PublicActor, PublicFrame } from '@prompt-chien/contracts';

export type DeepReadonly<T> = T extends (...args: never[]) => unknown ? T : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type PresentationMode = '2d' | '3d';
export type Quality = 'high' | 'medium' | 'low';
export interface CameraState {
  readonly target: readonly [number, number, number];
  readonly azimuth: number;
  readonly elevation: number;
  readonly zoom: number;
}
export interface SceneViewportProps {
  readonly quality: Quality;
  readonly camera: CameraState;
  readonly cameraLocked: boolean;
  readonly reducedMotion: boolean;
  readonly grayscale: boolean;
  readonly onCameraChange: (camera: CameraState) => void;
  readonly onReady: () => void;
  readonly onGraphicsState: (state: 'loading' | 'ready' | 'lost' | 'unavailable', message: string | null) => void;
  readonly onRequest2d: () => void;
}
export interface CellSelection { readonly x: number; readonly y: number }
export interface ModuleSelection { readonly moduleId: string }
export interface AssetLevel {
  readonly modelUrl: string;
  readonly modelSha256: string;
  readonly bytes: number;
  readonly triangles: number;
  readonly textures: readonly { readonly url: string; readonly sha256: string; readonly bytes: number; readonly width: number; readonly height: number; readonly format: 'ktx2' }[];
}
export interface ModulePresentation {
  readonly catalogId: string;
  readonly source: { readonly path: string; readonly sha256: string; readonly license: string; readonly attribution: string };
  readonly thumbnail: { readonly url: string; readonly sha256: string; readonly bytes: number };
  readonly levels: Readonly<Record<Quality, AssetLevel>>;
  readonly normalization: {
    readonly uniformScale: number;
    readonly rotationRadians: readonly [number, number, number];
    readonly translation: readonly [number, number, number];
    readonly pivot: readonly [number, number, number];
    readonly bounds: { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] };
    readonly front: '+X';
    readonly baseY: 0;
  };
}
export interface PresentationManifest {
  readonly version: 'ui3d-v1';
  readonly assetRevision: string;
  readonly unitsPerCell: 1;
  readonly axes: 'X-forward,Y-up,-Z-left';
  readonly modules: readonly ModulePresentation[];
  readonly decoders: readonly { readonly kind: 'meshopt' | 'ktx2'; readonly url: string; readonly sha256: string; readonly bytes: number; readonly version: string }[];
}
export interface SynthVisualProps {
  // Body-only or public projection; never pass BotDefinition/Brain/LocalReplay.
  readonly body: DeepReadonly<BotDefinition['body']>;
  readonly publicState: DeepReadonly<PublicActor> | null;
  readonly footprintByCatalogId: Readonly<Record<string, number>>;
  readonly manifest: PresentationManifest;
  readonly quality: Quality;
  readonly team: 'A' | 'B' | 'preview';
  readonly selectedModuleId: string | null;
  readonly onSelectModule: (selection: ModuleSelection) => void;
}
export interface SynthPreviewProps {
  readonly body: DeepReadonly<BotDefinition['body']>;
  readonly footprintByCatalogId: Readonly<Record<string, number>>;
  readonly manifest: PresentationManifest;
  readonly viewport: SceneViewportProps;
}
// Presentation units, projected explicitly by the app from the arena init.
// PublicFrame contains ring state but does not contain the arena dimensions.
export interface ArenaLayout {
  readonly width: number; readonly depth: number;
  readonly objective: { readonly x: number; readonly z: number; readonly radius: number };
  readonly props: readonly { readonly x: number; readonly z: number; readonly width: number; readonly depth: number; readonly height: number }[];
}
export interface ArenaSceneProps {
  readonly layout: ArenaLayout;
  readonly frames: DeepReadonly<readonly PublicFrame[]>;
  // Fractional boundary index for visual interpolation. The app owns play/seek/audio.
  readonly position: number;
  readonly footprintByCatalogId: Readonly<Record<string, number>>;
  readonly manifest: PresentationManifest;
  readonly viewport: SceneViewportProps;
  readonly vfx: boolean;
}
export interface WorkshopSceneProps extends SynthPreviewProps {
  readonly selectedModuleId: string | null;
  readonly cursor: CellSelection;
  readonly ghost: DeepReadonly<BotDefinition['body']['modules'][number]> | null;
  readonly onSelectModule: (selection: ModuleSelection) => void;
  readonly onSelectCell: (selection: CellSelection) => void;
  // Emits intent only. Application edit/validation/undo remains the authority.
  readonly onConfirmPlacement: (selection: CellSelection) => void;
}
