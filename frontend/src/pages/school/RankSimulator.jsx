import { useState, useMemo, useEffect } from 'react'
import { useAuthStore } from '../../store/auth.store'
import { useQuery } from '@tanstack/react-query'
import { schoolsService } from '../../services/schools.service'

// MCDA constants
const DEFAULT_WEIGHTS = {
  student_teacher_ratio: 0.30,
  infrastructure_deficit: 0.25,
  material_shortage: 0.20,
  geographic_difficulty: 0.15,
  socioeconomic_index: 0.10,
}

const INDICATORS = [
  {
    key: 'student_teacher_ratio',
    label: 'Student-Teacher Ratio',
    desc: 'Number of students per teacher (or raw ratio index 0–100)',
    min: 0, max: 100, step: 1,
    color: '#ef4444',
    icon: '👥',
    unit: '',
    tip: 'Higher = more students per teacher = higher priority',
  },
  {
    key: 'infrastructure_deficit',
    label: 'Infrastructure Deficit',
    desc: 'Buildings, sanitation, electricity deficit score',
    min: 0, max: 100, step: 1,
    color: '#f97316',
    icon: '🏗️',
    unit: '',
    tip: 'Higher = worse infrastructure = higher priority',
  },
  {
    key: 'material_shortage',
    label: 'Material Shortage',
    desc: 'Lack of textbooks, desks, stationery',
    min: 0, max: 100, step: 1,
    color: '#eab308',
    icon: '📚',
    unit: '',
    tip: 'Higher = more materials needed = higher priority',
  },
  {
    key: 'geographic_difficulty',
    label: 'Geographic Difficulty',
    desc: 'Remote location, difficult terrain, road access',
    min: 0, max: 100, step: 1,
    color: '#22c55e',
    icon: '🗺️',
    unit: '',
    tip: 'Higher = more remote = higher priority',
  },
  {
    key: 'socioeconomic_index',
    label: 'Socioeconomic Index',
    desc: 'Community poverty & vulnerability level',
    min: 0, max: 100, step: 1,
    color: '#3b82f6',
    icon: '📊',
    unit: '',
    tip: 'Higher = more disadvantaged community = higher priority',
  },
]

// MCDA score calculation (Min-Max normalization + weighted sum)
// We use a simple normalization against a fixed range [0, 100]
// so users can see real-time changes without needing all school data.
function computeScore(values, weights) {
  let score = 0
  for (const ind of INDICATORS) {
    const raw = values[ind.key] ?? 0
    // Min-Max normalize against [0, 100] range
    const normalized = Math.min(100, Math.max(0, raw)) / 100
    score += normalized * (weights[ind.key] ?? 0)
  }
  return Math.min(1, Math.max(0, score))
}

// Estimate rank position based on score relative to all school scores
function estimateRank(newScore, allSchoolScores, currentRank) {
  if (!allSchoolScores.length) return currentRank
  // Count how many schools have a higher score (they rank before us)
  const higherCount = allSchoolScores.filter(s => s > newScore).length
  return higherCount + 1
}

// Build the slider values object from a school's saved indicators
function getSchoolValues(school) {
  return {
    student_teacher_ratio: parseFloat(school?.student_teacher_ratio) || 50,
    infrastructure_deficit: parseFloat(school?.infrastructure_deficit) || 50,
    material_shortage: parseFloat(school?.material_shortage) || 50,
    geographic_difficulty: parseFloat(school?.geographic_difficulty) || 50,
    socioeconomic_index: parseFloat(school?.socioeconomic_index) || 50,
  }
}

// Component
export default function RankSimulator() {
  const { user } = useAuthStore()
  const school = user?.school

  // Load all rankings to estimate rank position
  const { data: rankingsData } = useQuery({
    queryKey: ['rankings-all-for-sim'],
    queryFn: () => schoolsService.getRankings({ limit: 150 }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const allSchools = rankingsData?.results || []
  const allScores = allSchools.map(s => s.priority_score || 0)

  // Initialize sliders from current school values
  const [values, setValues] = useState(() => getSchoolValues(school))

  // Update sliders if school data loads (e.g. page reload)
  useEffect(() => {
    if (school) {
      setValues(getSchoolValues(school))
    }
  }, [school?.id])

  const currentScore = useMemo(() => school?.priority_score || 0, [school])
  const currentRank = school?.priority_rank

  const simScore = useMemo(() => computeScore(values, DEFAULT_WEIGHTS), [values])
  const simRank = useMemo(() => estimateRank(simScore, allScores, currentRank), [simScore, allScores, currentRank])

  const scoreDelta = simScore - currentScore
  const rankDelta = currentRank && simRank ? currentRank - simRank : 0 // positive = improved

  const resetToOriginal = () => {
    if (school) {
      setValues(getSchoolValues(school))
    }
  }

  if (!school) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
        <span className="text-4xl">🎯</span>
        <p className="text-sm">No school linked to your account.</p>
      </div>
    )
  }

  const simScorePct = (simScore * 100).toFixed(1)
  const currentScorePct = (currentScore * 100).toFixed(1)

  return (
    <div className="flex flex-col min-h-0">
      {/* Nepal stripe */}
      <div className="nepal-stripe w-full" />

      {/* Header */}
      <div className="px-6 pt-5 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">🎯 Rank Simulator</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Adjust indicator values to see how your priority score and rank would change.
        </p>
      </div>

      <div className="p-6 space-y-5 overflow-y-auto">
        {/* Score comparison cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Current */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-t-4 border-t-slate-400 border-l border-r border-b border-slate-100 dark:border-slate-700 shadow-card p-4 text-center">
            <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Current</div>
            <div className="text-3xl font-black text-slate-700 dark:text-slate-200 tabular-nums">#{currentRank || '—'}</div>
            <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">{currentScorePct}%</div>
            <div className="text-xs text-slate-400 mt-0.5">Priority score</div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center text-2xl text-slate-300 dark:text-slate-600 hidden sm:flex">→</div>

          {/* Simulated */}
          <div className={`bg-white dark:bg-slate-800 rounded-2xl border-t-4 border-l border-r border-b border-slate-100 dark:border-slate-700 shadow-card p-4 text-center transition-all duration-300 ${
            rankDelta > 0 ? 'border-t-green-500' : rankDelta < 0 ? 'border-t-red-500' : 'border-t-blue-500'
          }`}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1 flex items-center justify-center gap-1">
              <span className={rankDelta > 0 ? 'text-green-500' : rankDelta < 0 ? 'text-red-500' : 'text-blue-500'}>
                {rankDelta > 0 ? '⬆' : rankDelta < 0 ? '⬇' : '—'}
              </span>
              <span className="text-slate-400 dark:text-slate-500">Simulated</span>
            </div>
            <div className={`text-3xl font-black tabular-nums ${
              rankDelta > 0 ? 'text-green-600 dark:text-green-400' : rankDelta < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
            }`}>
              #{simRank || '—'}
            </div>
            <div className={`text-sm font-bold mt-1 ${
              scoreDelta > 0.005 ? 'text-green-500' : scoreDelta < -0.005 ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
            }`}>
              {simScorePct}%
            </div>
            {(rankDelta !== 0) && (
              <div className={`text-xs mt-0.5 font-semibold ${rankDelta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {rankDelta > 0 ? `+${rankDelta} positions` : `${rankDelta} positions`}
              </div>
            )}
          </div>
        </div>

        {/* Change summary banner */}
        {Math.abs(scoreDelta) > 0.005 && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
            scoreDelta > 0
              ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
          }`}>
            <span className="text-xl">{scoreDelta > 0 ? '⬆' : '⬇'}</span>
            <div>
              <div className="font-semibold">
                Priority score {scoreDelta > 0 ? 'increases' : 'decreases'} by {Math.abs(scoreDelta * 100).toFixed(1)} percentage points
              </div>
              <div className="text-xs opacity-80 mt-0.5">
                {rankDelta > 0
                  ? `Rank improves by ${rankDelta} position${rankDelta !== 1 ? 's' : ''} (lower rank # = higher priority)`
                  : rankDelta < 0
                    ? `Rank drops by ${Math.abs(rankDelta)} position${Math.abs(rankDelta) !== 1 ? 's' : ''}`
                    : 'No rank change with current data'
                }
              </div>
            </div>
          </div>
        )}

        {/* Sliders */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Adjust Indicators</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Drag to simulate what-if changes</p>
            </div>
            <button
              onClick={resetToOriginal}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              ↺ Reset to Current
            </button>
          </div>

          <div className="space-y-6">
            {INDICATORS.map(ind => {
              const current = parseFloat(school[ind.key]) || 0
              const sim = values[ind.key]
              const changed = Math.abs(sim - current) > 0.5
              const pct = (sim - ind.min) / (ind.max - ind.min)

              return (
                <div key={ind.key} className={`transition-all duration-200 ${changed ? 'p-3 -mx-3 rounded-xl bg-slate-50/80 dark:bg-slate-700/30' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{ind.icon}</span>
                      <div>
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{ind.label}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">{ind.desc}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      {changed && (
                        <div className="text-[10px] text-slate-400">
                          Was: <span className="font-medium">{current.toFixed(0)}</span>
                        </div>
                      )}
                      <div className="text-sm font-bold tabular-nums" style={{ color: ind.color }}>
                        {sim.toFixed(0)}{ind.unit}
                      </div>
                    </div>
                  </div>

                  {/* Custom slider */}
                  <div className="relative h-5 flex items-center">
                    <div className="absolute inset-x-0 h-2 rounded-full bg-slate-100 dark:bg-slate-700" />
                    <div
                      className="absolute left-0 h-2 rounded-full transition-all duration-100"
                      style={{ width: `${pct * 100}%`, backgroundColor: ind.color, opacity: 0.7 }}
                    />
                    {/* Current value marker */}
                    <div
                      className="absolute w-0.5 h-4 rounded-full bg-slate-400 dark:bg-slate-500"
                      style={{ left: `${((current - ind.min) / (ind.max - ind.min)) * 100}%` }}
                      title={`Current: ${current.toFixed(0)}`}
                    />
                    <input
                      type="range"
                      min={ind.min} max={ind.max} step={ind.step}
                      value={sim}
                      onChange={e => setValues(prev => ({ ...prev, [ind.key]: parseFloat(e.target.value) }))}
                      className="absolute inset-x-0 h-2 opacity-0 cursor-pointer w-full"
                      style={{ zIndex: 10 }}
                    />
                    {/* Thumb */}
                    <div
                      className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md transition-all duration-100"
                      style={{ left: `calc(${pct * 100}% - 8px)`, backgroundColor: ind.color }}
                    />
                  </div>

                  <div className="flex justify-between text-[9px] text-slate-300 dark:text-slate-600 mt-0.5">
                    <span>{ind.min}</span>
                    <span className="text-slate-400 dark:text-slate-500 italic">{ind.tip}</span>
                    <span>{ind.max}</span>
                  </div>

                  {changed && (
                    <div className={`mt-1 text-[10px] font-semibold ${
                      sim > current ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                    }`}>
                      {sim > current ? `▲ +${(sim - current).toFixed(0)} (higher need)` : `▼ ${(sim - current).toFixed(0)} (lower need)`}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Score breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card p-5">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Score Breakdown (Simulated)</h2>
          <div className="space-y-3">
            {INDICATORS.map(ind => {
              const raw = values[ind.key] ?? 0
              const normalized = Math.min(100, Math.max(0, raw)) / 100
              const contribution = normalized * DEFAULT_WEIGHTS[ind.key]
              return (
                <div key={ind.key} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ind.color }} />
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 dark:text-slate-400">{ind.label}</span>
                      <div className="flex gap-2">
                        <span className="text-slate-400">{(DEFAULT_WEIGHTS[ind.key] * 100).toFixed(0)}% weight</span>
                        <span className="font-bold tabular-nums" style={{ color: ind.color }}>
                          +{(contribution * 100).toFixed(2)}pts
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${normalized * 100}%`, backgroundColor: ind.color }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
            <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-700 flex justify-between text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Estimated Priority Score</span>
              <span className="font-black text-primary-600 dark:text-primary-400 tabular-nums">{simScorePct}%</span>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-xl p-4 text-xs text-amber-700 dark:text-amber-400">
          <strong>Note:</strong> This simulator uses simplified Min-Max normalization against a fixed 0–100 range.
          Actual MCDA rankings are computed by the admin using the full dataset with proper normalization across all 150+ schools.
          Results here are indicative only.
        </div>
      </div>
    </div>
  )
}
