import { useState, useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'

/* ── Province key mapping (matches GeoJSON NAME_EN and PROVINCE number) ── */
const PROVINCE_MAP = {
  'Koshi': 'province1',        '1': 'province1',
  'Madhesh': 'madhesh',        '2': 'madhesh',
  'Bagmati': 'bagmati',        '3': 'bagmati',
  'Gandaki': 'gandaki',        '4': 'gandaki',
  'Lumbini': 'lumbini',        '5': 'lumbini',
  'Karnali': 'karnali',        '6': 'karnali',
  'Sudurpashchim': 'sudurpashchim', '7': 'sudurpashchim',
}

const PROVINCE_LABELS = {
  province1:      'Koshi',
  madhesh:        'Madhesh',
  bagmati:        'Bagmati',
  gandaki:        'Gandaki',
  lumbini:        'Lumbini',
  karnali:        'Karnali',
  sudurpashchim:  'Sudurpashchim',
}

const PROVINCE_CAPITALS = {
  province1:     'Biratnagar',
  madhesh:       'Janakpur',
  bagmati:       'Kathmandu',
  gandaki:       'Pokhara',
  lumbini:       'Deukhuri',
  karnali:       'Birendranagar',
  sudurpashchim: 'Godawari',
}

/* ── Extract province key from GeoJSON feature properties ── */
function getProvinceKey(properties) {
  if (!properties) return null
  const name = properties.NAME_EN || properties.NAME || properties.name
  if (name && PROVINCE_MAP[name]) return PROVINCE_MAP[name]
  const id = properties.PROVINCE ?? properties.ID ?? properties.id
  if (id !== undefined) return PROVINCE_MAP[String(id)] ?? null
  return null
}

/* ── Priority tier label ── */
function getTier(score) {
  if (score >= 0.7) return { label: 'Critical', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40' }
  if (score >= 0.5) return { label: 'High',     color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40' }
  if (score >= 0.3) return { label: 'Medium',   color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/40' }
  return               { label: 'Low',      color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' }
}

/* ─────────────────────────────────────────────────────────────────────────────
   SVG dimensions — wider viewBox so all of Nepal (lon 80–88.2) is visible
   The key fix: use fitExtent so D3 auto-fits the projection to the SVG.
───────────────────────────────────────────────────────────────────────────── */
const W = 760
const H = 300

export default function NepalProvinceMap({ provinceData = [] }) {
  const svgRef      = useRef(null)
  const containerRef = useRef(null)

  const [geoData,    setGeoData]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [tooltip,    setTooltip]    = useState(null)   // { x, y, key }
  const [hovered,    setHovered]    = useState(null)
  const [retry,      setRetry]      = useState(0)

  /* ── Load GeoJSON once ── */
  useEffect(() => {
    setLoading(true)
    setFetchError(null)
    d3.json('/nepal-provinces.geojson')
      .then(data => { setGeoData(data); setLoading(false) })
      .catch(err  => { setFetchError(err.message || 'Failed'); setLoading(false) })
  }, [retry])

  /* ── Build province data lookup ── */
  const dataMap = {}
  provinceData.forEach(p => { dataMap[p.province] = p })

  /* ── Compute path generator that auto-fits Nepal into our SVG ── */
  const { pathGen, features } = useComputeProjection(geoData)

  /* ── Tooltip handlers ── */
  const handleMouseMove = useCallback((e, key) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, key })
    setHovered(key)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setTooltip(null)
    setHovered(null)
  }, [])

  const ttData  = tooltip ? dataMap[tooltip.key]                      : null
  const ttLabel = tooltip ? (PROVINCE_LABELS[tooltip.key] || tooltip.key) : ''
  const ttTier  = ttData  ? getTier(ttData.avg_score || 0)            : null

  /* ── Color scale: white → deep red ── */
  const colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, 1])

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card overflow-hidden">

      {/* Header */}
      <div className="nepal-stripe" />
      <div className="px-5 pt-4 pb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
            🗺️ Nepal Province Priority Map
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Average MCDA priority score per province — deeper red = higher need
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
          <span className="text-slate-400">Low</span>
          <div className="w-24 h-3 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600"
            style={{ background: `linear-gradient(to right, ${colorScale(0.05)}, ${colorScale(0.5)}, ${colorScale(1)})` }} />
          <span className="text-red-500 font-medium">High need</span>
        </div>
      </div>

      {/* Map container */}
      <div ref={containerRef} className="relative w-full px-2 pb-2">

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-52 gap-3">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400 animate-pulse">Loading Nepal province map…</span>
          </div>
        )}

        {/* Error state */}
        {fetchError && !loading && (
          <div className="flex flex-col items-center justify-center h-52 gap-3">
            <span className="text-3xl">🗺️</span>
            <p className="text-sm text-slate-500 dark:text-slate-400">Map data unavailable</p>
            <button className="btn btn-secondary btn-sm" onClick={() => setRetry(r => r + 1)}>
              🔄 Retry
            </button>
          </div>
        )}

        {/* SVG Map */}
        {!loading && !fetchError && geoData && pathGen && (
          <>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.07))' }}
            >
              {features.map((feature, i) => {
                const key    = getProvinceKey(feature.properties)
                const data   = key ? dataMap[key] : null
                const score  = data?.avg_score ?? 0
                const fill   = data ? colorScale(Math.max(score, 0.08)) : '#e2e8f0'
                const isHov  = hovered === key
                const pathD  = pathGen(feature)
                const [cx, cy] = pathGen.centroid(feature)
                const label  = key ? (PROVINCE_LABELS[key] || key) : ''
                const parts  = label.split(' ')
                const dark   = score > 0.5

                return (
                  <g key={i}>
                    <path
                      d={pathD}
                      fill={fill}
                      stroke={isHov ? '#1e40af' : 'white'}
                      strokeWidth={isHov ? 2 : 1.2}
                      strokeLinejoin="round"
                      style={{
                        cursor: 'pointer',
                        filter: isHov ? 'brightness(0.88) drop-shadow(0 0 4px rgba(30,64,175,0.4))' : 'none',
                        transition: 'filter 0.15s ease, stroke 0.15s ease',
                      }}
                      onMouseMove={e => handleMouseMove(e, key)}
                      onMouseLeave={handleMouseLeave}
                    />
                    {/* Province label */}
                    {!isNaN(cx) && !isNaN(cy) && label && (
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={parts.length > 1 ? '7.5' : '8.5'}
                        fontWeight="700"
                        letterSpacing="0.3"
                        fill={dark ? 'rgba(255,255,255,0.92)' : '#374151'}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {parts.map((word, wi) => (
                          <tspan
                            key={wi}
                            x={cx}
                            dy={wi === 0 ? (parts.length > 1 ? -(parts.length - 1) * 5 : 0) : 11}
                          >
                            {word}
                          </tspan>
                        ))}
                      </text>
                    )}
                    {/* Score label below province name */}
                    {!isNaN(cx) && !isNaN(cy) && data && (
                      <text
                        x={cx}
                        y={cy + (parts.length > 1 ? 14 : 10)}
                        textAnchor="middle"
                        fontSize="7"
                        fontWeight="500"
                        fill={dark ? 'rgba(255,255,255,0.7)' : '#6b7280'}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {(score * 100).toFixed(0)}%
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Floating tooltip */}
            {tooltip && (
              <div
                className="absolute pointer-events-none z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl px-3 py-2.5 text-xs"
                style={{
                  left: Math.min(tooltip.x + 14, (containerRef.current?.offsetWidth ?? 700) - 170),
                  top:  Math.max(tooltip.y - 90, 4),
                  minWidth: 160,
                }}
              >
                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1">{ttLabel}</div>
                {ttData ? (
                  <>
                    <div className="flex justify-between text-slate-500 dark:text-slate-400 mb-0.5">
                      <span>Schools</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{ttData.count ?? '—'}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-slate-400 mb-0.5">
                      <span>Avg Score</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {((ttData.avg_score || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-slate-400 mb-1.5">
                      <span>Capital</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {PROVINCE_CAPITALS[tooltip.key] || '—'}
                      </span>
                    </div>
                    <div className={`text-center text-[10px] font-bold px-2 py-0.5 rounded-full ${ttTier?.color} ${ttTier?.bg}`}>
                      {ttTier?.label} Priority
                    </div>
                  </>
                ) : (
                  <div className="text-slate-400 dark:text-slate-500 italic">No ranking data yet</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Province summary cards */}
      {provinceData.length > 0 && (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {Object.entries(PROVINCE_LABELS).map(([key, label]) => {
              const data  = dataMap[key]
              if (!data) return null
              const score = data.avg_score || 0
              const color = colorScale(Math.max(score, 0.08))
              const tier  = getTier(score)
              return (
                <div
                  key={key}
                  className="flex flex-col items-center p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 text-center hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                  style={{ borderTopColor: color, borderTopWidth: 3 }}
                >
                  <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight mb-1">
                    {label}
                  </div>
                  <div className="text-sm font-bold tabular-nums" style={{ color }}>
                    {(score * 100).toFixed(1)}%
                  </div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {data.count} schools
                  </div>
                  <div className={`text-[9px] font-semibold mt-1 px-1.5 py-0.5 rounded-full ${tier.color} ${tier.bg}`}>
                    {tier.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Custom hook: compute D3 projection fitted to actual GeoJSON bounds ── */
function useComputeProjection(geoData) {
  const [result, setResult] = useState({ pathGen: null, features: [] })

  useEffect(() => {
    if (!geoData?.features?.length) return

    // Use fitExtent so D3 auto-calculates scale + translate to fill the SVG
    const projection = d3.geoMercator().fitExtent(
      [[20, 15], [W - 20, H - 15]],   // padding: 20px left/right, 15px top/bottom
      geoData
    )
    const pathGen = d3.geoPath(projection)
    setResult({ pathGen, features: geoData.features })
  }, [geoData])

  return result
}
