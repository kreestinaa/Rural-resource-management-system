import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { allocationService } from '../../services/allocation.service'

const NPR = (n) => `NPR ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const CYCLE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899']

const TIERS = ['minimum', 'standard', 'priority', 'maximum']

export default function Comparison() {
  const [selectedIds, setSelectedIds] = useState([])

  const { data: cyclesData } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => allocationService.getCycles().then((r) => r.data),
  })

  const allCycles = cyclesData?.results || []

  // Fetch results for each selected cycle
  const { data: compareData } = useQuery({
    queryKey: ['compare-cycles', selectedIds],
    queryFn: async () => {
      if (selectedIds.length < 2) return null
      const results = await Promise.all(
        selectedIds.map((id) =>
          allocationService.getCycleResults(id, { page_size: 500 }).then((r) => r.data)
        )
      )
      return selectedIds.map((id, i) => ({
        cycle: allCycles.find((c) => c.id === id),
        results: results[i]?.results || [],
      }))
    },
    enabled: selectedIds.length >= 2,
  })

  const toggleCycle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    )
  }

  // Build side-by-side school table
  const schoolTable = (() => {
    if (!compareData) return []
    const schoolMap = {}
    compareData.forEach(({ cycle, results }, ci) => {
      results.forEach((r) => {
        if (!schoolMap[r.school?.name || r.school_id]) {
          schoolMap[r.school?.name || r.school_id] = {
            name: r.school?.name || `School ${r.school_id}`,
            emis: r.school?.emis || '',
          }
        }
        schoolMap[r.school?.name || r.school_id][`cycle_${cycle?.id}`] = parseFloat(r.allocated_amount)
      })
    })
    return Object.values(schoolMap).slice(0, 50)
  })()

  // Tier distribution comparison
  const tierData = TIERS.map((tier) => {
    const row = { tier }
    compareData?.forEach(({ cycle, results }) => {
      row[cycle?.name || cycle?.id] = results.filter((r) => r.allocation_tier === tier).length
    })
    return row
  })

  const selectedCycles = allCycles.filter((c) => selectedIds.includes(c.id))

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Allocation Comparison</h1>
        <p className="text-gray-500 text-sm mt-1">Select 2–4 budget cycles to compare side by side</p>
      </div>

      {/* Cycle selector */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Select Cycles ({selectedIds.length}/4)
        </h2>
        {allCycles.length === 0 ? (
          <p className="text-gray-400 text-sm">No allocation cycles found. Create one first.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allCycles.map((c) => {
              const idx = selectedIds.indexOf(c.id)
              const selected = idx >= 0
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCycle(c.id)}
                  className={`text-left p-3 rounded-lg border-2 transition-all ${
                    selected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {selected && (
                      <span
                        className="w-5 h-5 rounded-full flex-shrink-0 text-xs flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: CYCLE_COLORS[idx] }}
                      >
                        {idx + 1}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-gray-800 dark:text-gray-200 text-sm truncate">{c.name}</div>
                      <div className="text-xs text-gray-500">FY {c.fiscal_year} · {c.schools_covered} schools</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedIds.length < 2 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          Select at least 2 cycles to see the comparison.
        </div>
      )}

      {selectedIds.length >= 2 && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {selectedCycles.map((c, i) => (
              <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl border-2 dark:border-gray-700 p-4 shadow-sm"
                style={{ borderColor: CYCLE_COLORS[i] }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ backgroundColor: CYCLE_COLORS[i] }}>{i + 1}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm truncate">{c.name}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Allocated</span>
                    <span className="font-medium">{NPR(c.total_allocated)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Schools</span>
                    <span className="font-medium">{c.schools_covered}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Gini</span>
                    <span className="font-medium">{((c.gini_coefficient || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Utilization</span>
                    <span className="font-medium">{(c.utilization_rate || 0).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tier distribution table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Tier Distribution Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Tier</th>
                    {selectedCycles.map((c, i) => (
                      <th key={c.id} className="text-right py-2 px-3 font-medium" style={{ color: CYCLE_COLORS[i] }}>{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tierData.map((row) => (
                    <tr key={row.tier} className="border-b border-gray-50 dark:border-gray-700">
                      <td className="py-2 px-3 capitalize text-gray-700 dark:text-gray-300">{row.tier}</td>
                      {selectedCycles.map((c) => (
                        <td key={c.id} className="py-2 px-3 text-right">{row[c.name] || 0}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* School-by-school table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Per-School Allocation Comparison (top 50 schools)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">School</th>
                    {selectedCycles.map((c, i) => (
                      <th key={c.id} className="text-right py-2 px-3 font-medium" style={{ color: CYCLE_COLORS[i] }}>
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schoolTable.map((row, ri) => (
                    <tr key={ri} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-2 px-3">
                        <div className="font-medium text-gray-800 dark:text-gray-200 max-w-[200px] truncate text-xs">{row.name}</div>
                        <div className="text-xs text-gray-400">{row.emis}</div>
                      </td>
                      {selectedCycles.map((c) => (
                        <td key={c.id} className="py-2 px-3 text-right text-xs font-mono">
                          {row[`cycle_${c.id}`] != null
                            ? NPR(row[`cycle_${c.id}`])
                            : <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {schoolTable.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">Loading school data…</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
