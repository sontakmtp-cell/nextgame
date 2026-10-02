/**
 * Design tokens for PROMPT Chiến
 * Baseline v2 / 06_ART_UX.md: Gốm Sống / Cốt Graphite
 */

export const colors = {
  // Surface tokens
  void: '#090D11',        // Nền trang và vùng ngoài sân
  arena: '#0E141A',       // Mặt sân 2D
  surface1: '#141C24',    // Panel chính
  surface2: '#1B2630',    // Panel nổi, menu, drawer
  surface3: '#25323D',    // Hover/selected container

  // Line tokens
  line: '#8193A0',        // Khung, divider và ranh giới UI có ý nghĩa
  lineQuiet: '#293640',   // Lưới sân, seam, divider phụ

  // Text tokens
  textPrimary: '#F4F1E8', // Nội dung chính
  textSecondary: '#B9C2C9', // Hướng dẫn và nội dung phụ
  textMuted: '#94A1AB',   // Timestamp, chú thích, metadata

  // Material tokens
  ceramic: '#D9D4C8',     // Tấm giáp chuẩn
  ceramicLit: '#F1EADC',  // Viền sáng cục bộ hoặc trạng thái được chọn
  alloy: '#39434C',       // Xương chịu lực, khớp và mảng lõm

  // Team tokens
  teamA: '#F27B59',       // Viền, stripe và badge Đội A
  teamB: '#65C8D4',       // Viền, stripe và badge Đội B

  // Accent & Status tokens
  core: '#F1C86B',        // Tâm/Core và điểm chú ý chính
  primaryAction: '#E8C56C', // CTA chính; chữ trên nút dùng Void
  success: '#55C58A',     // Hợp lệ, đã lưu, thắng
  warning: '#F0B85B',     // Cảnh báo, nhiệt tăng, sắp hết thời gian
  danger: '#EC6A68',      // Lỗi, nguy cơ phá huỷ, bị hạ
  info: '#7EBBE8',        // Trạng thái thông tin và trợ giúp
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
  xxxl: '48px',
} as const;

export const radius = {
  sm: '6px',
  field: '8px',
  panel: '10px',
  card: '14px',
  full: '9999px',
} as const;

export const typography = {
  fontSans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: '"IBM Plex Mono", "SF Mono", Menlo, Consolas, monospace',
} as const;
