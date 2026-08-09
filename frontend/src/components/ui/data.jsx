// Data display components: Table, StatCard, Timeline, Tag, ArcGauge, CountUp
import { useState, useEffect, useRef } from 'react'

// CountUp — animated number counter
export function CountUp({ value, prefix = '', suffix = '', decimals = 0, duration = 1200 }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef(null)
  const numVal = parseFloat(value) || 0

  useEffect(() => {
    const start = Date.now()
    const step = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(eased * numVal)
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [numVal, duration])

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString()

  return <span className="tabular-nums">{prefix}{formatted}{suffix}</span>
}

// StatCard — KPI card with animated counter
export function StatCard({ icon, label, value, sub, trend, color = 'blue', animate = true, onClick }) {
  const COLOR_MAP = {
    blue:   { icon: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600',   bar: 'bg-blue-500',   border: 'border-t-blue-500'   },
    green:  { icon: 'bg-green-50 dark:bg-green-950/40 text-green-600', bar: 'bg-green-500',  border: 'border-t-green-500'  },
    amber:  { icon: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600', bar: 'bg-amber-500',  border: 'border-t-amber-500'  },
    red:    { icon: 'bg-red-50 dark:bg-red-950/40 text-red-600',       bar: 'bg-red-500',    border: 'border-t-red-500'    },
    purple: { icon: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600', bar: 'bg-purple-500', border: 'border-t-purple-500' },
    teal:   { icon: 'bg-teal-50 dark:bg-teal-950/40 text-teal-600',    bar: 'bg-teal-500',   border: 'border-t-teal-500'   },
  }
  const c = COLOR_MAP[color] || COLOR_MAP.blue
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, '')) || null

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl border-t-4 ${c.border}
                  border-l border-r border-b border-slate-100 dark:border-slate-700
                  shadow-card hover:shadow-card-hover transition-all duration-200 p-5
                  ${onClick ? 'cursor-pointer' : ''} animate-fade-in-up`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl ${c.icon}`}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
            trend > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
          }`}>
            {trend > 0 ? '↑' : '↓'}{Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {animate && numericValue !== null
            ? <CountUp value={numericValue} />
            : value
          }
        </div>
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{label}</div>
        {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

// Table — sortable data table
export function Table({ columns = [], data = [], loading, empty, className = '' }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0
    const va = a[sortKey]; const vb = b[sortKey]
    const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return sortDir === 'asc' ? cmp : -cmp
  })

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  if (loading) return (
    <div className="space-y-2 p-4">
      {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg animate-shimmer bg-[length:200%_100%]" />)}
    </div>
  )

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-3 px-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap
                            ${col.sortable ? 'cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-300' : ''}`}
                style={{ width: col.width }}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
                {empty || 'No data available.'}
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => (
              <tr
                key={row.id ?? i}
                className={`border-b border-slate-50 dark:border-slate-700/50 transition-colors
                            ${row._highlight ? 'bg-primary-50 dark:bg-primary-950/20 font-semibold'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="py-3 px-4 text-slate-700 dark:text-slate-300" style={{ width: col.width }}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// Timeline — vertical activity feed
export function Timeline({ items = [] }) {
  return (
    <div className="space-y-0">
      {items.map((item, i) => (
        <div key={i} className="flex gap-4 group">
          <div className="flex flex-col items-center">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm
                             ${item.color || 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
              {item.icon}
            </div>
            {i < items.length - 1 && (
              <div className="w-px flex-1 my-1 bg-slate-100 dark:bg-slate-700" />
            )}
          </div>
          <div className="pb-5 min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.title}</p>
              {item.time && <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">{item.time}</span>}
            </div>
            {item.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// Tag — chip/tag component
export function Tag({ label, color = 'slate', removable, onRemove }) {
  const COLORS = {
    slate:  'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    green:  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    red:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${COLORS[color] || COLORS.slate}`}>
      {label}
      {removable && (
        <button onClick={onRemove} className="hover:opacity-70 text-base leading-none ml-0.5">×</button>
      )}
    </span>
  )
}

// ArcGauge — SVG circular gauge
export function ArcGauge({ value, max = 100, color = '#3b82f6', label, size = 100, animate = true }) {
  const r = 36
  const cx = 50, cy = 54
  const arcAngle = 240
  const startRad = (180 + (360 - arcAngle) / 2) * (Math.PI / 180)
  const pct = Math.min(value / max, 1)

  const polarToCart = (angle) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  })

  const arcPath = (fromAngle, toAngle) => {
    const start = polarToCart(fromAngle * Math.PI / 180)
    const end = polarToCart(toAngle * Math.PI / 180)
    const large = toAngle - fromAngle > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`
  }

  const startDeg = 150
  const endDeg = startDeg + arcAngle
  const fillEnd = startDeg + arcAngle * pct

  const [rendered, setRendered] = useState(!animate)
  useEffect(() => {
    const t = setTimeout(() => setRendered(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size * 0.9} viewBox="0 0 100 90">
        {/* Track */}
        <path
          d={arcPath(startDeg, endDeg)}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="8"
          strokeLinecap="round"
          className="dark:[stroke:#334155]"
        />
        {/* Fill */}
        {rendered && (
          <path
            d={arcPath(startDeg, fillEnd)}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            style={{ transition: animate ? 'stroke-dasharray 1s ease-out' : 'none' }}
          />
        )}
        <text x="50" y="58" textAnchor="middle" fontSize="20" fontWeight="700" fill="currentColor" className="text-slate-800 dark:text-slate-200">
          {Math.round(value)}
        </text>
      </svg>
      {label && <span className="text-xs text-slate-500 dark:text-slate-400 text-center leading-tight max-w-[90px]">{label}</span>}
    </div>
  )
}
