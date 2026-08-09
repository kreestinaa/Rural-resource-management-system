import { useEffect, useRef, useState } from 'react'

/* ─────────────────────────────────────────────────────────────────────────────
   SchoolPinMap — Leaflet map showing every school as a pin coloured by priority.
   Loads Leaflet from CDN at runtime (no npm dependency required), so it works
   even if `leaflet` isn't installed. If you prefer the npm package, run:
       npm install leaflet
   …and replace the CDN loader with `import L from 'leaflet'`.
───────────────────────────────────────────────────────────────────────────── */

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L)

    // CSS
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = LEAFLET_CSS
      document.head.appendChild(link)
    }
    // JS
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L))
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.src = LEAFLET_JS
    script.async = true
    script.onload = () => resolve(window.L)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

/* Priority tier → pin colour */
function tierColor(score) {
  if (score >= 0.7) return '#dc2626'   // critical — red
  if (score >= 0.5) return '#ea580c'   // high — orange
  if (score >= 0.3) return '#d97706'   // medium — amber
  return '#16a34a'                      // low — green
}

function tierLabel(score) {
  if (score >= 0.7) return 'Critical'
  if (score >= 0.5) return 'High'
  if (score >= 0.3) return 'Medium'
  return 'Low'
}

export default function SchoolPinMap({ schools = [] }) {
  const mapRef       = useRef(null)
  const containerRef = useRef(null)
  const layerRef     = useRef(null)
  const [status, setStatus] = useState('loading')   // loading | ready | error

  // With coords only
  const pins = schools.filter(
    (s) => s.latitude != null && s.longitude != null
  )

  useEffect(() => {
    let cancelled = false

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current) return

        // Init map once
        if (!mapRef.current) {
          mapRef.current = L.map(containerRef.current, {
            center: [28.39, 84.12],   // centre of Nepal
            zoom: 7,
            scrollWheelZoom: false,
            attributionControl: true,
          })
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '© OpenStreetMap',
          }).addTo(mapRef.current)
        }

        // Clear old markers
        if (layerRef.current) {
          mapRef.current.removeLayer(layerRef.current)
        }
        const group = L.layerGroup()

        pins.forEach((s) => {
          const score = s.priority_score || 0
          const color = tierColor(score)
          const marker = L.circleMarker([s.latitude, s.longitude], {
            radius: 6,
            fillColor: color,
            color: '#fff',
            weight: 1.5,
            fillOpacity: 0.85,
          })
          marker.bindPopup(`
            <div style="font-family:Inter,sans-serif;min-width:160px">
              <div style="font-weight:700;font-size:13px;margin-bottom:4px">${s.name}</div>
              <div style="font-size:11px;color:#64748b">${s.district}, ${s.province}</div>
              <div style="font-size:11px;margin-top:4px">
                Rank <b>#${s.priority_rank ?? '—'}</b> ·
                Score <b>${(score * 100).toFixed(1)}%</b>
              </div>
              <div style="font-size:11px;margin-top:2px">
                <span style="color:${color};font-weight:700">${tierLabel(score)} priority</span>
              </div>
              <div style="font-size:11px;color:#64748b;margin-top:2px">
                ${s.students} students · ${s.teachers} teachers
              </div>
            </div>
          `)
          group.addLayer(marker)
        })

        group.addTo(mapRef.current)
        layerRef.current = group

        // Fit bounds to pins
        if (pins.length) {
          const bounds = L.latLngBounds(pins.map((s) => [s.latitude, s.longitude]))
          mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 9 })
        }

        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('error'))

    return () => { cancelled = true }
  }, [schools])

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return (
    <div className="card overflow-hidden p-0">
      <div className="nepal-stripe" />
      <div className="px-5 pt-4 pb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
            📍 School Locations Map
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {pins.length} schools plotted — pin colour shows priority tier
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          {[['#dc2626', 'Critical'], ['#ea580c', 'High'], ['#d97706', 'Medium'], ['#16a34a', 'Low']].map(
            ([c, label]) => (
              <span key={label} className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                {label}
              </span>
            )
          )}
        </div>
      </div>

      <div className="relative">
        {status === 'loading' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 dark:bg-slate-800/70 gap-3">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400 animate-pulse">Loading map…</span>
          </div>
        )}
        {status === 'error' && (
          <div className="h-64 flex flex-col items-center justify-center gap-2">
            <span className="text-3xl">🗺️</span>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Map library could not load (check your internet connection).
            </p>
          </div>
        )}
        <div
          ref={containerRef}
          style={{ height: 380, width: '100%' }}
          className={status === 'error' ? 'hidden' : ''}
        />
      </div>
    </div>
  )
}
