/**
 * Minimalist Modern 设计系统令牌
 * 
 * 这个文件定义了整个应用的设计令牌，包括颜色、字体、间距、阴影等。
 * 所有组件都应该使用这些令牌来保持视觉一致性。
 */

export const designTokens = {
  colors: {
    background: "#FAFAFA",
    foreground: "#0F172A", // Slate-900
    muted: "#F1F5F9", // Slate-100
    "muted-foreground": "#64748B", // Slate-500
    accent: "#0052FF", // Electric Blue
    "accent-secondary": "#4D7CFF",
    "accent-foreground": "#FFFFFF",
    border: "#E2E8F0", // Slate-200
    card: "#FFFFFF",
    ring: "#0052FF",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
  },
  fonts: {
    display: '"Calistoga", Georgia, serif',
    ui: '"Inter", system-ui, sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
  spacing: {
    section: {
      mobile: "py-28", // 7rem
      desktop: "py-44", // 11rem
    },
  },
  shadows: {
    sm: "0 1px 3px rgba(0,0,0,0.06)",
    md: "0 4px 6px rgba(0,0,0,0.07)",
    lg: "0 10px 15px rgba(0,0,0,0.08)",
    xl: "0 20px 25px rgba(0,0,0,0.1)",
    accent: "0 4px 14px rgba(0,82,255,0.25)",
    "accent-lg": "0 8px 24px rgba(0,82,255,0.35)",
  },
  borderRadius: {
    sm: "0.375rem", // 6px
    md: "0.5rem", // 8px
    lg: "0.75rem", // 12px
    xl: "1rem", // 16px
    full: "9999px",
  },
  transitions: {
    default: "transition-all duration-200 ease-out",
    hover: "duration-300",
    entrance: "duration-700",
  },
} as const;

/**
 * 生成渐变背景的 CSS 值
 */
export const gradientAccent = "linear-gradient(to right, #0052FF, #4D7CFF)";
export const gradientAccentDiagonal = "linear-gradient(135deg, #0052FF, #4D7CFF)";
