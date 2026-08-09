// Theme definitions built on tokens
import { colors, shadows } from './tokens'

export const lightTheme = {
  page:    { bg: '#f8fafc' },
  card:    { bg: '#ffffff', border: '#e2e8f0', shadow: shadows.card, shadowHover: shadows['card-hover'] },
  sidebar: {
    admin:  { bg: '#0f2157', active: '#DC143C', hover: 'rgba(255,255,255,0.08)', text: '#c7d2fe', textActive: '#ffffff' },
    school: { bg: '#052e16', active: '#15803d', hover: 'rgba(255,255,255,0.08)', text: '#bbf7d0', textActive: '#ffffff' },
  },
  text:  { primary: '#0f172a', secondary: '#475569', muted: '#94a3b8', inverse: '#ffffff' },
  input: { bg: '#ffffff', border: '#cbd5e1', focusBorder: colors.primary[500], placeholder: '#94a3b8' },
  table: { header: '#f8fafc', border: '#e2e8f0', rowHover: '#f8fafc', rowHighlight: '#eff6ff' },
}

export const darkTheme = {
  page:    { bg: '#0f172a' },
  card:    { bg: '#1e293b', border: '#334155', shadow: 'none', shadowHover: '0 4px 12px rgb(0 0 0 / 0.3)' },
  sidebar: {
    admin:  { bg: '#0a1628', active: '#DC143C', hover: 'rgba(255,255,255,0.06)', text: '#93a8d0', textActive: '#ffffff' },
    school: { bg: '#031a0e', active: '#16a34a', hover: 'rgba(255,255,255,0.06)', text: '#86efac', textActive: '#ffffff' },
  },
  text:  { primary: '#f1f5f9', secondary: '#94a3b8', muted: '#64748b', inverse: '#0f172a' },
  input: { bg: '#1e293b', border: '#475569', focusBorder: colors.primary[400], placeholder: '#64748b' },
  table: { header: '#0f172a', border: '#334155', rowHover: '#273549', rowHighlight: '#1e3a5f' },
}
