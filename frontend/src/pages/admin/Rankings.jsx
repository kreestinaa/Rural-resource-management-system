import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schoolsService } from '../../services/schools.service'
import { Alert } from '../../components/ui/feedback'

const PROVINCES = [
  { value: '', label: 'All Provinces' },
  { value: 'bagmati', label: 'Bagmati' },
  { value: 'gandaki', label: 'Gandaki' },
  { value: 'province1', label: 'Koshi (Province 1)' },
  { value: 'madhesh', label: 'Madhesh' },
  { value: 'lumbini', label: 'Lumbini' },
  { value: 'karnali', label: 'Karnali' },
  { value: 'sudurpashchim', label: 'Sudurpashchim' },
]

const DEFAULT_WEIGHTS = {
  weight_student_teacher: 0.30,
  weight_infrastructure: 0.25,
  weight_materials: 0.20,
  weight_geographic: 0.15,
  weight_socioeconomic: 0.10,
}

// Each MCDA criterion: the weight key, a label, and the school field it maps to
const CRITERIA = [
  { key: 'weight_student_teacher', label: 'Student-Teacher Ratio', short: 'S:T', dataKey: 'student_teacher_ratio' },
  { key: 'weight_infrastructure', label: 'Infrastructure Deficit', short: 'Infra', dataKey: 'infrastructure_deficit' },
  { key: 'weight_materials', label: 'Material Shortage', short: 'Materials', dataKey: 'material_shortage' },
  { key: 'weight_geographic', label: 'Geographic Difficulty', short: 'Geo', dataKey: 'geographic_difficulty' },
  { key: 'weight_socioeconomic', label: 'Socioeconomic Index', short: 'SES', dataKey: 'socioeconomic_index' },
]

// Download the current rankings as a CSV file
function exportCSV(schools) {
  const headers = ['Rank', 'School', 'EMIS', 'District', 'Province', 'Students', 'S:T Ratio', 'Infrastructure', 'Materials', 'Geographic', 'Socioeconomic', 'Priority Score']
  const rows = schools.map(s => [
    s.priority_rank, `"${s.name}"`, s.emis, s.district, s.province,
    s.students,
    (s.student_teacher_ratio || 0).toFixed(1),
    (s.infrastructure_deficit || 0).toFixed(1),
    (s.material_shortage || 0).toFixed(1),
    (s.geographic_difficulty || 0).toFixed(1),
    (s.socioeconomic_index || 0).toFixed(1),
    (s.priority_score * 100).toFixed(2),
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'school_rankings.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// Colour for the rank number (top ranks = more urgent)
function rankColor(rank) {
  if (rank <= 3) return '#dc2626'
  if (rank <= 10) return '#f97316'
  if (rank <= 25) return '#f59e0b'
  return '#64748b'
}

// Simple popup comparing two schools side by side
function CompareModal({ schools, onClose }) {
  const a = schools[0]
  const b = schools[1]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card max-w-2xl w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">School Comparison</h3>
          <button onClick={onClose} className="btn-ghost btn-sm">Close</button>
        </div>
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="text-left align-bottom text-slate-500 dark:text-slate-400">
              <th className="w-1/3 p-2 font-semibold">Indicator</th>
              <th className="w-1/3 p-2 font-semibold break-words">{a.name}</th>
              <th className="w-1/3 p-2 font-semibold break-words">{b.name}</th>
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map(c => (
              <tr key={c.key} className="border-t border-slate-100 dark:border-slate-700">
                <td className="p-2 text-slate-700 dark:text-slate-300">{c.label}</td>
                <td className="p-2 text-slate-700 dark:text-slate-300">{(parseFloat(a[c.dataKey]) || 0).toFixed(1)}</td>
                <td className="p-2 text-slate-700 dark:text-slate-300">{(parseFloat(b[c.dataKey]) || 0).toFixed(1)}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-200 dark:border-slate-600">
              <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">Priority Score</td>
              <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">{(a.priority_score * 100).toFixed(1)}%</td>
              <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">{(b.priority_score * 100).toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Rankings() {
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS)
  const [province, setProvince] = useState('')
  const [search, setSearch] = useState('')
  const [compareSet, setCompareSet] = useState(new Set())
  const [showCompareModal, setShowCompareModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: rankingsData, isLoading } = useQuery({
    queryKey: ['rankings', province],
    queryFn: () => schoolsService.getRankings({ province: province || undefined, limit: 150 }).then(r => r.data),
  })

  const computeMutation = useMutation({
    mutationFn: schoolsService.computeRankings,
    onSuccess: () => {
      queryClient.invalidateQueries(['rankings'])
      queryClient.invalidateQueries(['school-stats'])
    },
  })

  const schools = rankingsData?.results || []

  // Weights must add up to 1.0
  let weightSum = 0
  for (const c of CRITERIA) weightSum += weights[c.key]
  const weightsValid = Math.abs(weightSum - 1.0) < 0.01

  function handleWeightChange(key, value) {
    setWeights({ ...weights, [key]: value })
  }

  function handleCompute() {
    if (!weightsValid) return
    computeMutation.mutate(weights)
  }

  // Filter the table by the search box
  const filtered = schools.filter(s =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.district?.toLowerCase().includes(search.toLowerCase())
  )

  // Add or remove a school from the compare selection (max 2)
  function toggleCompare(school) {
    const next = new Set(compareSet)
    if (next.has(school.id)) {
      next.delete(school.id)
    } else if (next.size < 2) {
      next.add(school.id)
    }
    setCompareSet(next)
  }

  const compareSchools = schools.filter(s => compareSet.has(s.id))

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">School Priority Rankings</h1>

      {computeMutation.isSuccess && (
        <Alert type="success" message="Rankings recomputed successfully." dismissible />
      )}
      {computeMutation.isError && (
        <Alert type="error" message={computeMutation.error?.response?.data?.error?.message || 'Failed to compute rankings.'} dismissible />
      )}

      {/* MCDA weight sliders */}
      <div className="card">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">MCDA Weights</h2>
        <div className="space-y-3">
          {CRITERIA.map(c => (
            <div key={c.key}>
              <label className="flex justify-between text-sm text-slate-700 dark:text-slate-300 mb-1">
                <span>{c.label}</span>
                <span className="font-semibold">{Math.round(weights[c.key] * 100)}%</span>
              </label>
              <input
                type="range" min="0" max="1" step="0.05"
                value={weights[c.key]}
                onChange={e => handleWeightChange(c.key, parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          ))}
        </div>
        <p className={`mt-3 text-sm ${weightsValid ? 'text-green-600' : 'text-red-600'}`}>
          Sum: {weightSum.toFixed(2)} {weightsValid ? '(valid)' : '(must equal 1.0)'}
        </p>
        <div className="flex gap-2 mt-3">
          <button onClick={() => setWeights(DEFAULT_WEIGHTS)} className="btn-secondary btn-sm">Reset to Default</button>
          <button
            onClick={handleCompute}
            disabled={computeMutation.isPending || !weightsValid}
            className="btn-primary btn-sm"
          >
            {computeMutation.isPending ? 'Computing...' : 'Compute Rankings'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search school or district"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input w-64"
        />
        <select value={province} onChange={e => setProvince(e.target.value)} className="input w-48">
          {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <button onClick={() => exportCSV(filtered)} disabled={filtered.length === 0} className="btn-secondary btn-sm">
          Export CSV
        </button>
        {compareSet.size === 2 && (
          <button onClick={() => setShowCompareModal(true)} className="btn-primary btn-sm">Compare Schools</button>
        )}
        {compareSet.size > 0 && (
          <button onClick={() => setCompareSet(new Set())} className="btn-ghost btn-sm">Clear</button>
        )}
        <span className="text-sm text-slate-500">{filtered.length} schools</span>
      </div>

      {/* Rankings table */}
      <div className="card overflow-x-auto">
        {isLoading ? (
          <p className="text-sm text-slate-500 py-8 text-center">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            {schools.length === 0 ? 'Click "Compute Rankings" to generate rankings.' : 'No schools match your search.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="tbl-head">Rank</th>
                <th className="tbl-head">School</th>
                <th className="tbl-head">District</th>
                <th className="tbl-head">Students</th>
                {CRITERIA.map(c => <th key={c.key} className="tbl-head">{c.short}</th>)}
                <th className="tbl-head">Score</th>
                <th className="tbl-head">Compare</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="tbl-row">
                  <td className="tbl-cell font-bold" style={{ color: rankColor(s.priority_rank) }}>{s.priority_rank}</td>
                  <td className="tbl-cell">
                    <div className="font-medium text-slate-800 dark:text-slate-200">{s.name}</div>
                    <div className="text-xs text-slate-400">{s.emis}</div>
                  </td>
                  <td className="tbl-cell">{s.district}</td>
                  <td className="tbl-cell">{s.students?.toLocaleString()}</td>
                  {CRITERIA.map(c => (
                    <td key={c.key} className="tbl-cell">{(parseFloat(s[c.dataKey]) || 0).toFixed(1)}</td>
                  ))}
                  <td className="tbl-cell font-semibold">{(s.priority_score * 100).toFixed(1)}</td>
                  <td className="tbl-cell">
                    <input
                      type="checkbox"
                      checked={compareSet.has(s.id)}
                      onChange={() => toggleCompare(s)}
                      disabled={compareSet.size >= 2 && !compareSet.has(s.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCompareModal && compareSchools.length === 2 && (
        <CompareModal schools={compareSchools} onClose={() => setShowCompareModal(false)} />
      )}
    </div>
  )
}
