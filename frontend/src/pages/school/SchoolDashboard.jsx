import { useQuery } from '@tanstack/react-query'
import { allocationService } from '../../services/allocation.service'
import { schoolsService } from '../../services/schools.service'

const NPR = (n) => `NPR ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const INDICATORS = [
  { key: 'student_teacher_ratio', label: 'S:T Ratio', color: '#ef4444' },
  { key: 'infrastructure_deficit', label: 'Infrastructure', color: '#f97316' },
  { key: 'material_shortage', label: 'Materials', color: '#eab308' },
  { key: 'geographic_difficulty', label: 'Geographic', color: '#22c55e' },
  { key: 'socioeconomic_index', label: 'Socioeconomic', color: '#3b82f6' },
]

// Rough province averages, used for the comparison table
const PROVINCE_AVG = {
  student_teacher_ratio: 52,
  infrastructure_deficit: 61,
  material_shortage: 58,
  geographic_difficulty: 45,
  socioeconomic_index: 55,
}

// Give a priority rank a readable band + colour
function rankBand(rank) {
  if (!rank) return { label: 'Unranked', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' }
  if (rank <= 10) return { label: 'Critical Priority', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' }
  if (rank <= 50) return { label: 'High Priority', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' }
  if (rank <= 100) return { label: 'Medium Priority', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' }
  return { label: 'Standard Priority', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' }
}

export default function SchoolDashboard() {
  // Always read the school from the API so admin edits show up immediately
  const { data: school, isLoading } = useQuery({
    queryKey: ['my-school'],
    queryFn: () => schoolsService.getMyProfile().then(r => r.data),
  })

  const { data: cyclesData } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => allocationService.getCycles().then(r => r.data),
  })

  if (isLoading) {
    return <p className="p-8 text-center text-slate-400">Loading...</p>
  }

  if (!school) {
    return (
      <div className="p-8 text-center text-slate-400 dark:text-slate-500">
        No school linked to your account. Contact the administrator.
      </div>
    )
  }

  const band = rankBand(school.priority_rank)
  const scorePct = Math.round((school.priority_score || 0) * 100)

  const compareData = INDICATORS.map(ind => ({
    name: ind.label,
    mine: parseFloat(school[ind.key]) || 0,
    province: PROVINCE_AVG[ind.key],
    color: ind.color,
  }))

  const cycles = cyclesData?.results || []
  const myAllocations = cycles
    .filter(c => ['computed', 'approved', 'disbursed'].includes(c.status))
    .slice(0, 5)

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`pill ${band.color}`}>{band.label}</span>
              {school.is_rural && <span className="pill bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Rural</span>}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{school.name}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              EMIS: {school.emis} · {school.district} · {school.province}
            </p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600 dark:text-slate-400">
              <span><strong className="text-slate-800 dark:text-slate-200">{school.students || '-'}</strong> Students</span>
              <span><strong className="text-slate-800 dark:text-slate-200">{school.teachers || '-'}</strong> Teachers</span>
              <span><strong className="text-slate-800 dark:text-slate-200">{school.classrooms || '-'}</strong> Classrooms</span>
            </div>
          </div>
          <div className="text-center border border-slate-200 dark:border-slate-700 rounded-xl px-6 py-3">
            <div className="text-xs text-slate-500 uppercase">Priority Rank</div>
            <div className="text-4xl font-bold text-slate-800 dark:text-slate-200">#{school.priority_rank || '-'}</div>
            <div className="text-sm text-slate-500 mt-1">Score: {scorePct}%</div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          ['Priority Score', `${scorePct}%`],
          ['Female Students', school.female_students || 0],
          ['Male Students', school.male_students || 0],
          ['Female Teachers', school.female_teachers || 0],
          ['Male Teachers', school.male_teachers || 0],
          ['Last Ranked', school.last_ranking_date
            ? new Date(school.last_ranking_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
            : 'Not yet'],
        ].map(([label, value]) => (
          <div key={label} className="card">
            <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Comparison vs province average */}
      <div className="card">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Your School vs Province Average</h2>
        <p className="text-xs text-slate-400 mb-3">Higher values indicate greater need</p>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="tbl-head">Indicator</th>
              <th className="tbl-head">Your School</th>
              <th className="tbl-head">Province Avg</th>
            </tr>
          </thead>
          <tbody>
            {compareData.map(d => (
              <tr key={d.name} className="tbl-row">
                <td className="tbl-cell">{d.name}</td>
                <td className="tbl-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded" style={{ width: `${d.mine * 0.8}px`, backgroundColor: d.color }} />
                    <span>{d.mine.toFixed(1)}</span>
                  </div>
                </td>
                <td className="tbl-cell text-slate-500">{d.province}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-400 mt-3">See your full rank history on the My Ranking page.</p>
      </div>

      {/* Recent allocations */}
      <div className="card">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Recent Allocations</h2>
        {myAllocations.length > 0 ? (
          <div className="space-y-2">
            {myAllocations.map(c => (
              <div key={c.id} className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                <div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{c.name}</div>
                  <div className="text-xs text-slate-400">{c.fiscal_year} · {c.allocation_strategy} · {c.schools_covered} schools</div>
                </div>
                <div className="text-sm font-semibold text-green-600 dark:text-green-400">{NPR(c.total_allocated)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-6 text-center">No allocations recorded yet.</p>
        )}
      </div>

      {/* School information */}
      <div className="card">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">School Information</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[
            ['School Type', (school.school_type || '').replace('_', ' ') || '-'],
            ['Location', school.is_rural ? 'Rural' : 'Urban'],
            ['Municipality', school.municipality || '-'],
            ['Ward No.', school.ward_number || '-'],
            ['Female Students', school.female_students || '-'],
            ['Male Students', school.male_students || '-'],
            ['Female Teachers', school.female_teachers || '-'],
            ['Male Teachers', school.male_teachers || '-'],
            ['Classrooms', school.classrooms || '-'],
            ['Last Ranked', school.last_ranking_date ? new Date(school.last_ranking_date).toLocaleDateString() : 'Not yet'],
          ].map(([label, value]) => (
            <div key={label} className="border border-slate-100 dark:border-slate-700 rounded-xl p-3">
              <div className="text-xs font-medium text-slate-400 uppercase mb-1">{label}</div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 capitalize">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
