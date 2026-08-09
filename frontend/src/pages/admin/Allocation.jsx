import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { allocationService } from '../../services/allocation.service'
import { fiscalBudgetService } from '../../services/fiscalBudget.service'
import { Alert, Progress } from '../../components/ui/feedback'

// Format a number as Nepali rupees
const NPR = (n) => `NPR ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const TIER_LABELS = { minimum: 'Minimum', standard: 'Standard', priority: 'Priority', maximum: 'Maximum' }

// Strategy code -> label, used by the disbursement cycle selector
const STRATEGY_LABELS = {
  priority: 'Priority-Based',
  equality: 'Equal Distribution',
  hybrid: 'Hybrid (60/40)',
}

const CRITERIA = [
  { key: 'weight_student_teacher', label: 'Student-Teacher Ratio' },
  { key: 'weight_infrastructure', label: 'Infrastructure Deficit' },
  { key: 'weight_materials', label: 'Material Shortage' },
  { key: 'weight_geographic', label: 'Geographic Difficulty' },
  { key: 'weight_socioeconomic', label: 'Socioeconomic Index' },
]

const STEPS = ['Budget & Constraints', 'MCDA Weights', 'Preview & Run']

// Small coloured label for a disbursement status
function DisburseBadge({ status }) {
  if (status === 'disbursed') {
    return <span className="pill bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Disbursed</span>
  }
  return <span className="pill bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Pending</span>
}

// Small coloured label for an allocation tier
function TierBadge({ tier }) {
  return <span className="pill bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{TIER_LABELS[tier] || tier}</span>
}

// Disbursement tab: pick a cycle and mark schools as disbursed
function DisbursementTab() {
  const queryClient = useQueryClient()
  const [cycleId, setCycleId] = useState(null)

  const { data: cyclesData } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => allocationService.getCycles().then(r => r.data),
  })
  const cycles = cyclesData?.results || []

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['disbursement-summary', cycleId],
    queryFn: () => allocationService.getDisbursementSummary(cycleId).then(r => r.data),
  })

  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ['disbursement-results', summary?.cycle_id],
    queryFn: () => allocationService.getCycleResultsForDisbursement(summary.cycle_id).then(r => r.data),
    enabled: !!summary?.cycle_id,
  })

  const disburseMutation = useMutation({
    mutationFn: (id) => allocationService.disburseResult(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['disbursement-summary'])
      queryClient.invalidateQueries(['disbursement-results'])
    },
  })

  const results = resultsData?.results || []
  const pct = summary?.total > 0 ? Math.round((summary.disbursed / summary.total) * 100) : 0

  if (summaryLoading) return <p className="p-8 text-center text-slate-400">Loading disbursement data...</p>

  if (!summary?.cycle_id) {
    return <p className="p-8 text-center text-slate-400">No allocation cycles found. Run an allocation first.</p>
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Disbursement Progress</h2>
            <select
              value={summary.cycle_id ?? ''}
              onChange={(e) => setCycleId(e.target.value || null)}
              className="input w-auto text-sm"
            >
              {cycles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - {STRATEGY_LABELS[c.allocation_strategy] || c.allocation_strategy}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{summary.disbursed}</div>
              <div className="text-xs text-green-600 dark:text-green-400">Disbursed</div>
            </div>
            <div>
              <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{summary.pending}</div>
              <div className="text-xs text-amber-600 dark:text-amber-400">Pending</div>
            </div>
            <div>
              <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{summary.total}</div>
              <div className="text-xs text-slate-500">Total</div>
            </div>
          </div>
        </div>
        <Progress value={pct} max={100} label={`${pct}% disbursed`} color="bg-green-500" size="md" showPercent />
      </div>

      {/* Results table */}
      <div className="card overflow-x-auto">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
          All Schools - {summary.cycle_name || 'Selected Cycle'}
        </h3>
        {resultsLoading ? (
          <p className="p-6 text-center text-slate-400">Loading...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Rank', 'School', 'District', 'Amount', 'Status', 'Action'].map(h => (
                  <th key={h} className="tbl-head">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id} className="tbl-row">
                  <td className="tbl-cell">#{r.priority_rank}</td>
                  <td className="tbl-cell">{r.school_name}</td>
                  <td className="tbl-cell">{r.school_district}</td>
                  <td className="tbl-cell font-semibold text-green-700 dark:text-green-400">{NPR(r.allocated_amount)}</td>
                  <td className="tbl-cell"><DisburseBadge status={r.disbursement_status} /></td>
                  <td className="tbl-cell">
                    {r.disbursement_status === 'pending' ? (
                      <button
                        onClick={() => disburseMutation.mutate(r.id)}
                        disabled={disburseMutation.isPending}
                        className="btn-primary btn-sm"
                      >
                        Mark Disbursed
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {r.disbursed_at ? new Date(r.disbursed_at).toLocaleDateString() : '-'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// Step 1: budget and constraints
function StepBudget({ form, update }) {
  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <label className="label">Cycle Name</label>
        <input className="input" value={form.name} onChange={e => update('name', e.target.value)} />
      </div>
      <div>
        <label className="label">Fiscal Year (Nepali)</label>
        <input className="input" value={form.fiscal_year} onChange={e => update('fiscal_year', e.target.value)} placeholder="e.g. 2081/82" />
      </div>
      <div>
        <label className="label">Total Budget (NPR)</label>
        <input
          type="number" className="input" value={form.total_budget}
          onChange={e => update('total_budget', Number(e.target.value))}
          min={100000} step={500000}
        />
        <p className="text-xs text-slate-500 mt-1">{NPR(form.total_budget)}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Minimum / School (NPR)</label>
          <input type="number" className="input" value={form.min_allocation}
            onChange={e => update('min_allocation', Number(e.target.value))} step={10000} />
          <p className="text-xs text-slate-400 mt-1">{NPR(form.min_allocation)}</p>
        </div>
        <div>
          <label className="label">Maximum / School (NPR)</label>
          <input type="number" className="input" value={form.max_per_school}
            onChange={e => update('max_per_school', Number(e.target.value))} step={50000} />
          <p className="text-xs text-slate-400 mt-1">{NPR(form.max_per_school)}</p>
        </div>
      </div>
    </div>
  )
}

// Step 2: MCDA weights
function StepWeights({ form, update }) {
  let weightSum = 0
  for (const c of CRITERIA) weightSum += form[c.key] || 0
  const weightsValid = Math.abs(weightSum - 1.0) < 0.01

  return (
    <div className="space-y-4 max-w-lg">
      <p className={`text-sm font-semibold ${weightsValid ? 'text-green-600' : 'text-amber-600'}`}>
        Weight Sum: {weightSum.toFixed(2)} {weightsValid ? '(valid)' : '(must equal 1.0)'}
      </p>

      {CRITERIA.map(c => (
        <div key={c.key}>
          <label className="flex justify-between text-sm text-slate-700 dark:text-slate-300 mb-1">
            <span>{c.label}</span>
            <span className="font-semibold">{Math.round((form[c.key] || 0) * 100)}%</span>
          </label>
          <input
            type="range" min="0" max="1" step="0.05"
            value={form[c.key] || 0}
            onChange={e => update(c.key, parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      ))}

      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3">
        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">Allocation Method: Priority-Based (Greedy Algorithm)</div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Every school is guaranteed a minimum allocation, then the remaining budget
          is awarded in MCDA priority order (highest need first), capped per school.
        </p>
      </div>
    </div>
  )
}

// Step 3: preview and run
function StepPreview({ form, onRun, isPending, disabled = false }) {
  let weightSum = 0
  for (const c of CRITERIA) weightSum += form[c.key] || 0
  const weightsValid = Math.abs(weightSum - 1.0) < 0.01

  return (
    <div className="space-y-4 max-w-lg">
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
        <div className="text-sm font-bold text-slate-700 dark:text-slate-300">Configuration Summary</div>
        {[
          ['Cycle Name', form.name],
          ['Fiscal Year', form.fiscal_year],
          ['Total Budget', NPR(form.total_budget)],
          ['Min / School', NPR(form.min_allocation)],
          ['Max / School', NPR(form.max_per_school)],
          ['Strategy', 'Priority-Based (Greedy)'],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">{k}</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{v}</span>
          </div>
        ))}
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
        <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">MCDA Weights</div>
        {CRITERIA.map(c => (
          <div key={c.key} className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">{c.label}</span>
            <span className="font-semibold">{Math.round((form[c.key] || 0) * 100)}%</span>
          </div>
        ))}
      </div>

      {!weightsValid && (
        <Alert type="warning" title="Invalid weights" message={`Weights sum to ${weightSum.toFixed(2)}, must equal 1.0. Go back and adjust.`} />
      )}

      <button
        onClick={onRun}
        disabled={isPending || !weightsValid || disabled}
        className="btn-primary w-full py-3"
      >
        {isPending ? 'Running Allocation...' : 'Run Allocation'}
      </button>
      <p className="text-xs text-slate-400 text-center">
        This will compute allocations for all ranked schools and save the results.
      </p>
    </div>
  )
}

// Results view shown after an allocation runs
function ResultsView({ result, cycleResults }) {
  const summary = result?.summary || {}
  const tiers = summary.allocation_tiers || {}
  const tierList = Object.keys(tiers).filter(k => tiers[k] > 0)
  const topResults = cycleResults?.results?.slice(0, 20) || []
  const giniPct = (summary.gini_coefficient || 0) * 100
  const remaining = (summary.total_budget || 0) - (summary.total_allocated || 0)

  const stats = [
    ['Schools Funded', summary.schools_covered || 0],
    ['Utilization Rate', `${summary.utilization_rate || 0}%`],
    ['Total Allocated', NPR(summary.total_allocated)],
    ['Avg / School', NPR(summary.avg_allocation)],
  ]

  return (
    <div className="space-y-6">
      <Alert type="success" title="Allocation Complete" message={result?.message || 'Budget allocation computed successfully.'} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(([label, value]) => (
          <div key={label} className="card text-center">
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{value}</div>
            <div className="text-xs text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gini */}
        <div className="card text-center">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Gini Coefficient</div>
          <div className="text-3xl font-bold text-slate-800 dark:text-slate-200">{(summary.gini_coefficient || 0).toFixed(3)}</div>
          <div className="text-xs text-slate-400 mt-1">
            {giniPct < 30 ? 'Equitable distribution' : giniPct < 50 ? 'Moderate inequality' : 'High inequality'}
          </div>
        </div>

        {/* Tiers */}
        <div className="card">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Allocation Tiers</div>
          {tierList.length === 0 ? (
            <p className="text-xs text-slate-400">No data.</p>
          ) : (
            tierList.map(k => (
              <div key={k} className="flex justify-between text-sm py-0.5">
                <span className="text-slate-600 dark:text-slate-400">{TIER_LABELS[k] || k}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{tiers[k]}</span>
              </div>
            ))
          )}
        </div>

        {/* Budget breakdown */}
        <div className="card">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Budget Breakdown</div>
          {[
            ['Total Budget', NPR(summary.total_budget)],
            ['Total Allocated', NPR(summary.total_allocated)],
            ['Remaining', NPR(remaining)],
            ['Min Granted', NPR(summary.min_allocation)],
            ['Max Granted', NPR(summary.max_allocation)],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between text-xs py-0.5">
              <span className="text-slate-500 dark:text-slate-400">{label}</span>
              <span className="text-slate-700 dark:text-slate-300">{val}</span>
            </div>
          ))}
          <div className="mt-3">
            <Progress value={summary.utilization_rate || 0} max={100} label="Budget utilization" color="bg-primary-500" size="sm" />
          </div>
        </div>
      </div>

      {/* Top 20 table */}
      {topResults.length > 0 && (
        <div className="card overflow-x-auto">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Top 20 School Allocations</h3>
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Rank', 'School', 'District', 'Allocated Amount', 'Tier'].map(h => (
                  <th key={h} className="tbl-head">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topResults.map(r => (
                <tr key={r.id} className="tbl-row">
                  <td className="tbl-cell font-bold">{r.priority_rank}</td>
                  <td className="tbl-cell">{r.school_name}</td>
                  <td className="tbl-cell">{r.school_district}</td>
                  <td className="tbl-cell font-semibold text-green-700 dark:text-green-400">{NPR(r.allocated_amount)}</td>
                  <td className="tbl-cell"><TierBadge tier={r.allocation_tier} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function Allocation() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('allocation')
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: `Budget Allocation ${new Date().getFullYear()}`,
    fiscal_year: '2081/82',
    total_budget: 10000000,
    min_allocation: 50000,
    max_per_school: 500000,
    allocation_strategy: 'priority',
    weight_student_teacher: 0.30,
    weight_infrastructure: 0.25,
    weight_materials: 0.20,
    weight_geographic: 0.15,
    weight_socioeconomic: 0.10,
  })
  const [result, setResult] = useState(null)
  const [selectedCycle, setSelectedCycle] = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  const { data: cyclesData } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => allocationService.getCycles().then(r => r.data),
  })

  const { data: cycleResults } = useQuery({
    queryKey: ['cycle-results', selectedCycle],
    queryFn: () => allocationService.getResults(selectedCycle, { page_size: 200 }).then(r => r.data),
    enabled: !!selectedCycle,
  })

  const { data: pool, isLoading: poolLoading } = useQuery({
    queryKey: ['fiscal-active'],
    queryFn: () => fiscalBudgetService.getActive().then(r => r.data),
    retry: false,
  })

  const runMutation = useMutation({
    mutationFn: allocationService.runAllocation,
    onSuccess: (res) => {
      setResult(res.data)
      setSelectedCycle(res.data.cycle_id)
      queryClient.invalidateQueries(['cycles'])
      queryClient.invalidateQueries(['fiscal-active'])
      queryClient.invalidateQueries(['fiscal-budgets'])
      queryClient.invalidateQueries(['fiscal-breakdown'])
    },
  })

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const canNext = () => {
    if (step === 1) return form.name && form.fiscal_year && form.total_budget > 0
    if (step === 2) {
      let wSum = 0
      for (const c of CRITERIA) wSum += form[c.key] || 0
      return Math.abs(wSum - 1.0) < 0.01
    }
    return true
  }

  const handleRun = () => {
    runMutation.mutate({ ...form, fiscal_budget: pool?.id })
  }

  const handleNewAllocation = () => {
    setResult(null)
    setStep(1)
    setSelectedCycle(null)
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Budget Allocation</h1>
        {activeTab === 'allocation' && (
          <div className="flex items-center gap-2">
            {result && (
              <button onClick={handleNewAllocation} className="btn-secondary btn-sm">+ New Allocation</button>
            )}
            <button onClick={() => setShowHistory(h => !h)} className="btn-ghost btn-sm">History</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {[['allocation', 'Allocation'], ['disbursement', 'Disbursement']].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === tab
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Disbursement tab */}
      {activeTab === 'disbursement' && <DisbursementTab />}

      {activeTab === 'allocation' && (
        <div className="space-y-5">
          {/* History panel */}
          {showHistory && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Allocation History</h2>
                <button onClick={() => setShowHistory(false)} className="btn-ghost btn-sm">Close</button>
              </div>
              {!cyclesData?.results?.length ? (
                <p className="text-center text-slate-400 text-sm py-6">No allocations yet.</p>
              ) : (
                <div className="space-y-2">
                  {(cyclesData?.results || []).map(cycle => (
                    <div
                      key={cycle.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${
                        selectedCycle === cycle.id
                          ? 'border-primary-300 bg-primary-50 dark:bg-primary-950/20 dark:border-primary-800'
                          : 'border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                      }`}
                      onClick={() => { setSelectedCycle(cycle.id); setShowHistory(false) }}
                    >
                      <div>
                        <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{cycle.name}</div>
                        <div className="text-xs text-slate-400">{cycle.fiscal_year} · {cycle.schools_covered} schools · {cycle.allocation_strategy}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm text-green-600 dark:text-green-400">{NPR(cycle.total_allocated)}</div>
                        <div className="text-xs text-slate-400">{cycle.utilization_rate}% utilized · Gini {cycle.gini_coefficient?.toFixed(3)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {result ? (
            <ResultsView result={result} cycleResults={cycleResults} />
          ) : !poolLoading && !pool ? (
            <div className="card text-center py-10">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Create an Annual Budget first</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
                Every allocation cycle draws from a fiscal-year budget pool. This guarantees that
                total spending - cycles plus discretionary grants - can never exceed the annual budget.
              </p>
              <a href="/admin/annual-budget" className="btn-primary inline-block">Go to Annual Budget</a>
            </div>
          ) : (
            <div className="card">
              {/* Annual pool balance */}
              {pool && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Annual Budget {pool.fiscal_year}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Total {NPR(pool.total_amount)} · Spent {NPR(pool.spent)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Available for this cycle</div>
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">{NPR(pool.available)}</div>
                  </div>
                </div>
              )}
              {pool && form.total_budget > Number(pool.available) && (
                <p className="text-xs text-red-500 mb-4 font-medium">
                  This cycle ({NPR(form.total_budget)}) exceeds the available annual budget ({NPR(pool.available)}). Reduce the cycle budget.
                </p>
              )}

              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-5 text-sm">
                {STEPS.map((label, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      step === i + 1 ? 'bg-primary-600 text-white' :
                      step > i + 1 ? 'bg-green-500 text-white' :
                      'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}>
                      {step > i + 1 ? '✓' : i + 1}
                    </span>
                    <span className={step === i + 1 ? 'font-semibold text-slate-800 dark:text-slate-200' : 'text-slate-400'}>{label}</span>
                    {i < STEPS.length - 1 && <span className="text-slate-300">›</span>}
                  </div>
                ))}
              </div>

              {/* Step content */}
              {step === 1 && <StepBudget form={form} update={update} />}
              {step === 2 && <StepWeights form={form} update={update} />}
              {step === 3 && (
                <StepPreview
                  form={form}
                  onRun={handleRun}
                  isPending={runMutation.isPending}
                  disabled={!pool || form.total_budget > Number(pool?.available ?? 0)}
                />
              )}

              {runMutation.isError && (
                <div className="mt-4">
                  <Alert type="error" message={runMutation.error?.response?.data?.error?.message || 'Allocation failed. Please try again.'} />
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button onClick={() => setStep(s => s - 1)} disabled={step === 1} className="btn-secondary btn-sm disabled:opacity-40">Back</button>
                {step < 3 ? (
                  <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="btn-primary btn-sm">Next</button>
                ) : (
                  <span />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
