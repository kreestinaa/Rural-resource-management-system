// Design tokens — single source of truth for the Rural Resource Allocation UI

export const colors = {
  nepal: { red: '#DC143C', blue: '#003893' },

  // Primary (government navy blue)
  primary: {
    50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
    400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
    800: '#1e40af', 900: '#1e3a8a', 950: '#0f2157',
  },

  // Semantic
  success: { light: '#dcfce7', DEFAULT: '#22c55e', dark: '#15803d', text: '#166534' },
  warning: { light: '#fef3c7', DEFAULT: '#f59e0b', dark: '#b45309', text: '#92400e' },
  danger:  { light: '#fee2e2', DEFAULT: '#ef4444', dark: '#b91c1c', text: '#991b1b' },
  info:    { light: '#dbeafe', DEFAULT: '#3b82f6', dark: '#1d4ed8', text: '#1e40af' },

  // Priority tiers
  tier: {
    critical: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
    high:     { bg: '#fff7ed', text: '#9a3412', border: '#fdba74' },
    medium:   { bg: '#fefce8', text: '#854d0e', border: '#fde047' },
    low:      { bg: '#f0fdf4', text: '#14532d', border: '#86efac' },
  },

  // Indicator heat (green=low need -> red=high need)
  heat: {
    0:  '#d1fae5', 20: '#a7f3d0', 40: '#fef9c3',
    60: '#fde68a', 80: '#fca5a5', 100: '#f87171',
  },
}

export const typography = {
  fonts: {
    sans: "'Inter', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  sizes: {
    xs: '0.75rem',  sm: '0.875rem', base: '1rem',
    lg: '1.125rem', xl: '1.25rem',  '2xl': '1.5rem',
    '3xl': '1.875rem', '4xl': '2.25rem', '5xl': '3rem',
  },
  weights: { normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
}

export const spacing = {
  px: '1px', 0.5: '0.125rem', 1: '0.25rem', 2: '0.5rem',
  3: '0.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem',
  8: '2rem', 10: '2.5rem', 12: '3rem', 16: '4rem', 20: '5rem',
}

export const shadows = {
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.10), 0 1px 2px -1px rgb(0 0 0 / 0.10)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.10)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.10)',
  card: '0 1px 3px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04)',
  'card-hover': '0 4px 12px rgb(0 0 0 / 0.08), 0 2px 4px rgb(0 0 0 / 0.04)',
}

export const radii = {
  sm: '6px', md: '8px', lg: '12px', xl: '16px',
  '2xl': '20px', full: '9999px',
}

export const durations = {
  fast: '100ms', normal: '200ms', slow: '300ms', verySlow: '500ms',
}

export const breakpoints = {
  sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px',
}
