import { useRef, useEffect, useState } from 'react'
import { useAuthStore } from '../../store/auth.store'
import { useQuery } from '@tanstack/react-query'
import { schoolsService } from '../../services/schools.service'
import { Progress } from '../../components/ui/feedback'

const PROVINCES = [
  { value: '', label: 'All Provinces' },
  { value: 'bagmati', label: 'Bagmati' },
  { value: 'gandaki', label: 'Gandaki' },
  { value: 'province1', label: 'Koshi' },
  { value: 'madhesh', label: 'Madhesh' },
  { value: 'lumbini', label: 'Lumbini' },
  { value: 'karnali', label: 'Karnali' },
  { value: 'sudurpashchim', label: 'Sudurpashchim' },
]

const INDICATORS = [
  { key: 'student_teacher_ratio', label: 'Student-Teacher Ratio', weight: '30%', color: '#ef4444' },
  { key: 'infrastructure_deficit', label: 'Infrastructure Deficit', weight: '25%', color: '#f97316' },
  { key: 'material_shortage', label: 'Material Shortage', weight: '20%', color: '#eab308' },
  { key: 'geographic_difficulty', label: 'Geographic Difficulty', weight: '15%', color: '#22c55e' },
  { key: 'socioeconomic_index', label: 'Socioeconomic Index', weight: '10%', color: '#3b82f6' },
]

// Turn a rank into a readable priority band
function priorityLabel(rank) {
  if (!rank) return { text: 'Unranked', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' }
  if (rank <= 10) return { text: 'Critical Priority', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' }
  if (rank <= 50) return { text: 'High Priority', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' }
  if (rank <= 100) return { text: 'Medium Priority', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' }
  return { text: 'Standard Priority', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' }
}

export default function SchoolRanking() {
  const { user } = useAuthStore()
  const school = user?.school
  const [provinceFilter, setProvinceFilter] = useState('')
  const myRowRef = useRef(null)

  const { data: rankingsData, isLoading } = useQuery({
    queryKey: ['rankings-all', provinceFilter],
    queryFn: () => schoolsService.getRankings({
      limit: 150,
      province: provinceFilter || undefined,
    }).then(r => r.data),
  })

  const allSchools = rankingsData?.results || []
  const myRank = school?.priority_rank
  const total = allSchools.length

  const label = priorityLabel(myRank)

  // Scroll to my own row once the list loads
  useEffect(() => {
    if (myRowRef.current) {
      myRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [allSchools.length])

  if (!school) return null

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">My Ranking</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {school.name} · Rank <span className="font-semibold">#{myRank || '-'}</span> of {total} ·{' '}
          <span className={`pill ${label.cls}`}>{label.text}</span>
        </p>
      </div>

      {/* MCDA breakdown */}
      <div className="card">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">MCDA Score Breakdown</h2>
        <div className="space-y-3">
          {INDICATORS.map(ind => {
            const val = parseFloat(school[ind.key]) || 0
            return (
              <div key={ind.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-600 dark:text-slate-400">{ind.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Weight: {ind.weight}</span>
                    <span className="text-xs font-bold" style={{ color: ind.color }}>{val.toFixed(1)}/100</span>
                  </div>
                </div>
                <Progress
                  value={val}
                  max={100}
                  color={val >= 70 ? 'bg-red-400' : val >= 40 ? 'bg-amber-400' : 'bg-green-400'}
                  size="sm"
                  showPercent={false}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Priority scale */}
      <div className="card">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Priority Scale</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          Rank #1 = highest need, rank #{total} = lowest need. Your school is rank #{myRank || '-'}.
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
          {[['bg-red-600', 'Critical (1-10)'], ['bg-orange-500', 'High (11-50)'], ['bg-amber-400', 'Medium (51-100)'], ['bg-green-500', 'Standard (100+)']].map(([bg, text]) => (
            <div key={text} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full ${bg}`} />
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* Nearby table */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">School Rankings</h2>
            <p className="text-xs text-slate-400">Your school is highlighted</p>
          </div>
          <select value={provinceFilter} onChange={e => setProvinceFilter(e.target.value)} className="input w-auto text-sm">
            {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {isLoading ? (
          <p className="text-center py-8 text-slate-400 text-sm">Loading...</p>
        ) : allSchools.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">
            No rankings available. Ask an admin to compute rankings.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Rank', 'School', 'District', 'Score'].map(h => <th key={h} className="tbl-head">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {allSchools.map(s => {
                const isMe = s.id === school?.id
                return (
                  <tr
                    key={s.id}
                    ref={isMe ? myRowRef : undefined}
                    className={`tbl-row ${isMe ? 'bg-primary-50 dark:bg-primary-950/30 font-semibold' : ''}`}
                  >
                    <td className="tbl-cell font-bold">{s.priority_rank}</td>
                    <td className="tbl-cell">
                      <span className={isMe ? 'text-primary-700 dark:text-primary-300' : ''}>{s.name}</span>
                      {isMe && <span className="text-xs text-primary-400 ml-1">(Your school)</span>}
                    </td>
                    <td className="tbl-cell text-slate-500">{s.district}</td>
                    <td className="tbl-cell font-semibold">{(s.priority_score * 100).toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <p className="text-xs text-slate-400 mt-3">
          {allSchools.length} total schools in {provinceFilter ? PROVINCES.find(p => p.value === provinceFilter)?.label : 'all provinces'}
        </p>
      </div>

      {/* Rank history */}
      <RankTrendCard schoolId={school?.id} />
    </div>
  )
}

// Shows the school's rank history as a simple table
function RankTrendCard({ schoolId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['school-history', schoolId],
    queryFn: () => schoolsService.getHistory(schoolId).then(r => r.data),
    enabled: !!schoolId,
  })

  const rawHistory = (data?.history || data?.ranking_history || [])
    .slice()
    .sort((a, b) => new Date(a.computed_at) - new Date(b.computed_at))
    .map(h => ({
      date: new Date(h.computed_at || h.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      rank: h.rank,
      score: parseFloat(((h.score || 0) * 100).toFixed(1)),
    }))

  // Only keep a row when the rank or score actually changed (skip repeats)
  const history = []
  for (const h of rawHistory) {
    const prev = history[history.length - 1]
    if (!prev || prev.rank !== h.rank || prev.score !== h.score) {
      history.push(h)
    }
  }

  let delta = 0
  if (history.length >= 2) delta = history[0].rank - history[history.length - 1].rank

  return (
    <div className="card overflow-x-auto">
      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Your Rank Over Time</h2>
      <p className="text-xs text-slate-400 mb-3">Lower rank number = higher priority need</p>

      {isLoading ? (
        <p className="text-center py-6 text-slate-400 text-sm">Loading...</p>
      ) : history.length < 2 ? (
        <p className="text-center py-6 text-slate-400 text-sm">
          {rawHistory.length === 0
            ? 'No ranking history yet. History builds after each MCDA computation.'
            : rawHistory.length === 1
              ? 'Only one data point so far. More history will appear after each recomputation.'
              : `Your rank has stayed at #${rawHistory[rawHistory.length - 1].rank} across all ${rawHistory.length} computations so far.`}
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="tbl-head">Date</th>
                <th className="tbl-head">Rank</th>
                <th className="tbl-head">Score</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="tbl-row">
                  <td className="tbl-cell">{h.date}</td>
                  <td className="tbl-cell">#{h.rank}</td>
                  <td className="tbl-cell">{h.score}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {delta !== 0 && (
            <div className={`mt-3 text-xs font-semibold ${delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
              {delta > 0
                ? `Rank improved by ${delta} position(s) since first entry`
                : `Rank dropped by ${Math.abs(delta)} position(s) since first entry`}
            </div>
          )}
        </>
      )}
    </div>
  )
}
