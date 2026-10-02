/**
 * PROMPT Chiến — Art & UX Color Tokens (06_ART_UX.md §4)
 * Theme: Gốm Sống / Cốt Graphite
 */

export const THEME = {
  // Backgrounds & Surfaces
  VOID: '#090D11',
  ARENA: '#0E141A',
  SURFACE_1: '#141C24',
  SURFACE_2: '#1B2630',
  SURFACE_3: '#25323D',

  // Lines & Boundaries
  LINE: '#8193A0',
  LINE_QUIET: '#293640',

  // Typography
  TEXT_PRIMARY: '#F4F1E8',
  TEXT_SECONDARY: '#B9C2C9',
  TEXT_MUTED: '#94A1AB',

  // Living Ceramic & Alloy Skeleton
  CERAMIC: '#D9D4C8',
  CERAMIC_LIT: '#F1EADC',
  ALLOY: '#39434C',

  // Team Identity
  TEAM_A: '#F27B59',
  TEAM_B: '#65C8D4',

  // Functional & Semantic Highlights
  CORE: '#F1C86B',
  PRIMARY_ACTION: '#E8C56C',
  SUCCESS: '#55C58A',
  WARNING_HEAT: '#F0B85B',
  DANGER: '#EC6A68',
  INFO: '#7EBBE8',
} as const;

export type ThemeColorKey = keyof typeof THEME;

/**
 * Parses a hex color '#RRGGBB' into [r, g, b] 0..255
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Calculates ITU-R BT.709 relative luminance (0..1)
 */
export function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/**
 * Converts a hex color to perceptual grayscale hex
 */
export function toGrayscaleHex(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  // ITU-R BT.601 / BT.709 standard luma weights
  const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const clamped = Math.max(0, Math.min(255, luma));
  const byte = clamped.toString(16).padStart(2, '0');
  return `#${byte}${byte}${byte}`;
}

/**
 * Computes WCAG 2.2 contrast ratio between two hex colors
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
