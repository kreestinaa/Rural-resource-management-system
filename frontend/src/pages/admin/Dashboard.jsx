import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { schoolsService } from '../../services/schools.service'
import { allocationService } from '../../services/allocation.service'
import { reportsService, downloadBlob } from '../../services/reports.service'
import { Alert } from '../../components/ui/feedback'
import NepalProvinceMap from '../../components/NepalProvinceMap'

const PROVINCE_LABELS = {
  bagmati: 'Bagmati', gandaki: 'Gandaki', province1: 'Koshi',
  madhesh: 'Madhesh', lumbini: 'Lumbini', karnali: 'Karnali', sudurpashchim: 'Sudurpashchim',
}
const TIERS = ['critical', 'high', 'medium', 'low']
const TIER_STYLE = {
  critical: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  high:     'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
  medium:   'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  low:      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
}
const NPR = (n) => `NPR ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function Dashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['school-stats'],
    queryFn: () => schoolsService.getStats().then((r) => r.data),
  })
  const { data: cyclesData } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => allocationService.getCycles().then((r) => r.data),
  })
  const computeMutation = useMutation({
    mutationFn: () => schoolsService.computeRankings({}),
    onSuccess: () => queryClient.invalidateQueries(['school-stats']),
  })
  const exportMutation = useMutation({
    mutationFn: () => reportsService.downloadSchoolsCSV(),
    onSuccess: (res) => downloadBlob(res.data, 'schools_rankings.csv'),
  })

  const provinceData = (stats?.province_breakdown || []).map((p) => ({
    name: PROVINCE_LABELS[p.province] || p.province,
    schools: p.count,
    score: parseFloat(((p.avg_score || 0) * 100).toFixed(1)),
  })).sort((a, b) => b.schools - a.schools)

  const allocationHistory = [...(stats?.allocation_history || [])].reverse().map((c) => ({
    name: c.fiscal_year || (c.name || '').slice(-6),
    allocated: parseFloat(((c.total_allocated || 0) / 1_000_000).toFixed(2)),
    schools: c.schools_covered || 0,
  }))

  const provinceTierDist = stats?.province_ranking_distribution || {}
  const topSchools = stats?.top_priority_schools || []
  const maxProvinceSchools = Math.max(1, ...provinceData.map((p) => p.schools))

  const kpis = [
    ['Total Schools', stats?.total_schools ?? 0, `${stats?.ranked_schools ?? 0} ranked`],
    ['Ranked', stats?.ranked_schools ?? 0, `${stats?.schools_with_no_ranking ?? 0} pending`],
    ['Total Students', (stats?.total_students ?? 0).toLocaleString(), `${(stats?.total_teachers ?? 0).toLocaleString()} teachers`],
    ['Avg S:T Ratio', `${stats?.avg_student_teacher_ratio ?? 0}:1`, 'Students per teacher'],
    ['Budget YTD', `NPR ${((stats?.budget_allocated_ytd || 0) / 1_000_000).toFixed(1)}M`, `${cyclesData?.count || 0} cycles`],
    ['Avg Gini', `${((stats?.avg_gini_coefficient ?? 0) * 100).toFixed(1)}%`, '0% = perfect equality'],
  ]

  if (isLoading) return <p className="p-8 text-center text-slate-400">Loading dashboard...</p>

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Rural Resource Allocation Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => computeMutation.mutate()} disabled={computeMutation.isPending} className="btn-primary btn-sm">
            {computeMutation.isPending ? 'Computing...' : 'Run MCDA'}
          </button>
          <button onClick={() => navigate('/admin/allocation')} className="btn-secondary btn-sm">New Allocation</button>
          <button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending} className="btn-ghost btn-sm">
            {exportMutation.isPending ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {computeMutation.isSuccess && <Alert type="success" message="Rankings recomputed successfully." dismissible />}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(([label, value, sub]) => (
          <div key={label} className="card">
            <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{value}</div>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">{label}</div>
            <div className="text-xs text-slate-400">{sub}</div>
          </div>
        ))}
      </div>

      {/* Province map */}
      <NepalProvinceMap provinceData={stats?.province_breakdown || []} />

      {/* Province + allocation summary tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Schools by Province</h2>
          {provinceData.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No data.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="tbl-head">Province</th>
                  <th className="tbl-head">Schools</th>
                  <th className="tbl-head">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {provinceData.map((p) => (
                  <tr key={p.name} className="tbl-row">
                    <td className="tbl-cell">{p.name}</td>
                    <td className="tbl-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-2 rounded bg-blue-500" style={{ width: `${(p.schools / maxProvinceSchools) * 80}px` }} />
                        <span>{p.schools}</span>
                      </div>
                    </td>
                    <td className="tbl-cell">{p.score}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Allocation History</h2>
          {allocationHistory.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No allocation data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="tbl-head">Period</th>
                  <th className="tbl-head">Allocated (M NPR)</th>
                  <th className="tbl-head">Schools</th>
                </tr>
              </thead>
              <tbody>
                {allocationHistory.map((a, i) => (
                  <tr key={i} className="tbl-row">
                    <td className="tbl-cell">{a.name}</td>
                    <td className="tbl-cell">{a.allocated}</td>
                    <td className="tbl-cell">{a.schools}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Province x tier distribution */}
      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Province × Priority Tier Distribution</h2>
        {Object.keys(provinceTierDist).length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="tbl-head">Province</th>
                {TIERS.map((t) => <th key={t} className="tbl-head text-center capitalize">{t}</th>)}
                <th className="tbl-head text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(provinceTierDist).map(([prov, tiers]) => {
                const total = TIERS.reduce((s, t) => s + (tiers[t] || 0), 0)
                return (
                  <tr key={prov} className="tbl-row">
                    <td className="tbl-cell font-medium capitalize">{PROVINCE_LABELS[prov] || prov}</td>
                    {TIERS.map((t) => (
                      <td key={t} className="tbl-cell text-center">
                        {(tiers[t] || 0) > 0
                          ? <span className={`pill ${TIER_STYLE[t]}`}>{tiers[t]}</span>
                          : <span className="text-slate-300 dark:text-slate-700">-</span>}
                      </td>
                    ))}
                    <td className="tbl-cell text-center font-semibold">{total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-center text-slate-400 text-sm py-8">Run MCDA rankings to see tier distribution.</p>
        )}
      </div>

      {/* Top priority schools */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Top Priority Schools</h2>
          <button onClick={() => navigate('/admin/rankings')} className="btn-ghost btn-sm">View all</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr>
              {['Rank', 'School', 'District', 'Province', 'Students', 'Score'].map((h) => (
                <th key={h} className="tbl-head">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topSchools.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400 text-sm">Click "Run MCDA" to generate rankings.</td></tr>
            ) : topSchools.map((school) => (
              <tr key={school.id} className="tbl-row">
                <td className="tbl-cell font-bold">#{school.priority_rank}</td>
                <td className="tbl-cell">
                  <div className="font-medium">{school.name}</div>
                  <div className="text-xs text-slate-400">{school.emis}</div>
                </td>
                <td className="tbl-cell text-slate-500">{school.district}</td>
                <td className="tbl-cell text-slate-500 capitalize">{PROVINCE_LABELS[school.province] || school.province}</td>
                <td className="tbl-cell">{school.students}</td>
                <td className="tbl-cell">
                  <span className="pill bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                    {((school.priority_score || 0) * 100).toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
