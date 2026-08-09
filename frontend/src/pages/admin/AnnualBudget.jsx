import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fiscalBudgetService } from '../../services/fiscalBudget.service'
import { Alert } from '../../components/ui/feedback'

const NPR = (n) => `NPR ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function AnnualBudget() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fiscal_year: '', name: '', total_amount: '' })

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['fiscal-budgets'],
    queryFn: () => fiscalBudgetService.getAll().then(r => r.data),
  })

  const list = budgets?.results || budgets || []
  const activeId = list.find(b => b.is_active)?.id

  const { data: breakdown } = useQuery({
    queryKey: ['fiscal-breakdown', activeId],
    queryFn: () => fiscalBudgetService.getBreakdown(activeId).then(r => r.data),
    enabled: !!activeId,
  })

  const disburseGrantMutation = useMutation({
    mutationFn: (grantId) => fiscalBudgetService.disburseGrant(grantId),
    onSuccess: () => {
      queryClient.invalidateQueries(['fiscal-breakdown'])
      queryClient.invalidateQueries(['fiscal-budgets'])
    },
  })

  const createMutation = useMutation({
    mutationFn: (data) => fiscalBudgetService.create(data),
    onSuccess: () => {
      setShowForm(false)
      setForm({ fiscal_year: '', name: '', total_amount: '' })
      queryClient.invalidateQueries(['fiscal-budgets'])
    },
  })

  const active = list.find(b => b.is_active)
  const pctSpent = active && Number(active.total_amount) > 0
    ? (Number(active.spent) / Number(active.total_amount)) * 100
    : 0
  const pctCycles = active && Number(active.total_amount) > 0
    ? (Number(active.allocated_by_cycles) / Number(active.total_amount)) * 100
    : 0
  const pctGrants = active && Number(active.total_amount) > 0
    ? (Number(active.granted_by_requests) / Number(active.total_amount)) * 100
    : 0

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-screen-xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            🏦 Annual Budget
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            The fiscal-year pool. Budget cycles and approved resource requests both draw from it.
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl px-4 py-2">
          {showForm ? 'Cancel' : '+ New Fiscal Year'}
        </button>
      </div>

      {createMutation.isError && (
        <Alert type="error" title="Could not create"
          message={createMutation.error?.response?.data?.fiscal_year?.[0]
            || createMutation.error?.response?.data?.error
            || 'Check the fields and try again.'} />
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card p-6">
          <h2 className="font-bold text-slate-800 dark:text-slate-200 mb-4">New Fiscal Year Budget</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Fiscal Year <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.fiscal_year}
                onChange={e => setForm(f => ({ ...f, fiscal_year: e.target.value }))}
                placeholder="2081/82"
                className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Name</label>
              <input type="text" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Annual Education Budget"
                className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Total Amount (NPR) <span className="text-red-500">*</span>
              </label>
              <input type="number" value={form.total_amount}
                onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                placeholder="10000000"
                className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 tabular-nums" />
              {form.total_amount && (
                <p className="text-xs text-blue-600 mt-1">{NPR(form.total_amount)}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => createMutation.mutate(form)}
            disabled={!form.fiscal_year || !form.total_amount || createMutation.isPending}
            className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-5 py-2.5">
            {createMutation.isPending ? 'Creating…' : 'Create Budget'}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-slate-400 py-16">Loading…</div>
      ) : !active ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-12 text-center">
          <div className="text-4xl mb-3">🏦</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">No annual budget yet.</p>
          <p className="text-xs text-slate-400">
            Create one to start running allocation cycles and approving resource requests.
          </p>
        </div>
      ) : (
        <>
          {/* Balance overview */}
          <div className="card">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Fiscal Year {active.fiscal_year}
                </div>
                <div className="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-200">{NPR(active.total_amount)}</div>
                <div className="text-xs text-slate-500 mt-0.5">{active.name || 'Annual Budget'}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Available</div>
                <div className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400">{NPR(active.available)}</div>
                <div className="text-xs text-slate-500 mt-0.5">{(100 - pctSpent).toFixed(1)}% remaining</div>
              </div>
            </div>

            {/* Stacked bar */}
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
              <div className="h-3 bg-blue-400" style={{ width: `${pctCycles}%` }} />
              <div className="h-3 bg-amber-400" style={{ width: `${pctGrants}%` }} />
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                Allocation cycles: <b>{NPR(active.allocated_by_cycles)}</b>
                <span className="text-slate-400">({active.cycle_count} cycles)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Resource grants: <b>{NPR(active.granted_by_requests)}</b>
                <span className="text-slate-400">({active.grant_count} grants)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                Unspent: <b>{NPR(active.available)}</b>
              </span>
            </div>
          </div>

          {/* Ledger */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Cycles */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card p-5">
              <h2 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-3">
                📊 Allocation Cycles
              </h2>
              {!breakdown?.cycles?.length ? (
                <p className="text-sm text-slate-400 text-center py-6">No cycles run yet.</p>
              ) : (
                <div className="space-y-2">
                  {breakdown.cycles.map(c => (
                    <div key={c.id} className="flex items-center justify-between border border-slate-100 dark:border-slate-700 rounded-xl p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{c.name}</div>
                        <div className="text-xs text-slate-400">
                          {c.schools_covered} schools · {c.status}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-blue-600 tabular-nums whitespace-nowrap ml-3">
                        −{NPR(c.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Grants */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card p-5">
              <h2 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-3">
                📄 Discretionary Grants
              </h2>
              {!breakdown?.grants?.length ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  No grants made yet. Approve a resource request to grant funds.
                </p>
              ) : (
                <div className="space-y-2">
                  {breakdown.grants.map(g => (
                    <div key={g.id} className="flex items-center justify-between gap-3 border border-slate-100 dark:border-slate-700 rounded-xl p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {g.school_name}
                        </div>
                        <div className="text-xs text-slate-400 truncate">{g.request_subject}</div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-bold text-amber-600 tabular-nums whitespace-nowrap">
                            −{NPR(g.amount)}
                          </div>
                          <span className={`text-[10px] font-semibold ${
                            g.disbursement_status === 'disbursed' ? 'text-green-600' : 'text-amber-600'
                          }`}>
                            {g.disbursement_status === 'disbursed' ? '✓ Disbursed' : '⏳ Pending'}
                          </span>
                        </div>
                        {g.disbursement_status !== 'disbursed' && (
                          <button
                            onClick={() => disburseGrantMutation.mutate(g.id)}
                            disabled={disburseGrantMutation.isPending}
                            className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-lg px-2.5 py-1.5 whitespace-nowrap"
                          >
                            Mark Disbursed
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
