import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { resourceRequestService } from '../../services/resourceRequest.service'
import { fiscalBudgetService } from '../../services/fiscalBudget.service'
import { Alert } from '../../components/ui/feedback'
import { getErrorMessage } from '../../utils/errors'

const NPR = (n) => `NPR ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const STATUS_STYLES = {
  pending:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  under_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  approved:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}
const STATUS_LABELS = {
  pending: 'Pending', under_review: 'Under Review', approved: 'Approved', rejected: 'Rejected',
}
const PROVINCE_LABELS = {
  bagmati: 'Bagmati', gandaki: 'Gandaki', province1: 'Koshi', madhesh: 'Madhesh',
  lumbini: 'Lumbini', karnali: 'Karnali', sudurpashchim: 'Sudurpashchim',
}

export default function ResourceRequests() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('pending')
  const [noteById, setNoteById] = useState({})
  const [amountById, setAmountById] = useState({})

  const { data, isLoading } = useQuery({
    queryKey: ['admin-resource-requests'],
    queryFn: () => resourceRequestService.getAll().then(r => r.data),
    refetchInterval: 15_000,        // new school requests appear without refreshing
    refetchOnWindowFocus: true,
  })

  // Live annual-pool balance so the admin knows what can be granted
  const { data: pool } = useQuery({
    queryKey: ['fiscal-active'],
    queryFn: () => fiscalBudgetService.getActive().then(r => r.data),
    retry: false,
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries(['admin-resource-requests'])
    queryClient.invalidateQueries(['fiscal-active'])
    queryClient.invalidateQueries(['fiscal-budgets'])
    queryClient.invalidateQueries(['fiscal-breakdown'])
  }

  const approveMutation = useMutation({
    mutationFn: ({ id, amount, admin_response }) =>
      resourceRequestService.approve(id, { amount, admin_response }),
    onSuccess: invalidateAll,
  })
  const rejectMutation = useMutation({
    mutationFn: ({ id, admin_response }) => resourceRequestService.reject(id, { admin_response }),
    onSuccess: invalidateAll,
  })

  // Disburse the grant made against an approved request.
  // Approving COMMITS the money; disbursing RELEASES it — the same two-stage
  // flow used for algorithmic cycle allocations.
  const disburseMutation = useMutation({
    mutationFn: (grantId) => fiscalBudgetService.disburseGrant(grantId),
    onSuccess: invalidateAll,
  })

  const all = data?.results || []
  const requests = filter === 'all' ? all : all.filter(r => r.status === filter)
  const counts = {
    all: all.length,
    pending: all.filter(r => r.status === 'pending').length,
    approved: all.filter(r => r.status === 'approved').length,
    rejected: all.filter(r => r.status === 'rejected').length,
  }

  const setNote = (id, v) => setNoteById(p => ({ ...p, [id]: v }))
  const setAmount = (id, v) => setAmountById(p => ({ ...p, [id]: v }))
  const available = Number(pool?.available ?? 0)

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          📄 Resource Requests
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review official letters from schools. Approving a request grants funds from the annual budget.
        </p>
      </div>

      {/* Annual pool balance */}
      {pool ? (
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Annual Budget {pool.fiscal_year}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Grants made: <b>{NPR(pool.granted_by_requests)}</b>
              {' · '}Cycles: <b>{NPR(pool.allocated_by_cycles)}</b>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Available to grant</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{NPR(available)}</div>
          </div>
        </div>
      ) : (
        <Alert type="warning" title="No annual budget"
          message="Create a Fiscal Year Budget on the Annual Budget page before approving requests — grants must draw from a funded pool." />
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {['pending', 'approved', 'rejected', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-400'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f] ?? 0})
          </button>
        ))}
      </div>

      {(approveMutation.isError || rejectMutation.isError) && (
        <Alert type="error" title="Action failed"
          message={getErrorMessage(
            approveMutation.error || rejectMutation.error,
            'Could not complete the action.'
          )} />
      )}

      {isLoading ? (
        <div className="text-center text-slate-400 py-16">Loading requests…</div>
      ) : requests.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-12 text-center">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-sm text-slate-400">No {filter !== 'all' ? filter : ''} requests.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(r => {
            const isPending = r.status === 'pending' || r.status === 'under_review'
            const busy = approveMutation.isPending || rejectMutation.isPending
            return (
              <div key={r.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card p-5">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 dark:text-slate-200 break-words">{r.subject}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {r.school_name} · {r.school_district}, {PROVINCE_LABELS[r.school_province] || r.school_province}
                      · EMIS {r.school_emis}
                    </div>
                    <div className="text-xs text-slate-400">
                      Submitted {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {r.submitted_by_username ? ` by ${r.submitted_by_username}` : ''}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[r.status] || ''}`}>
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </div>

                {/* Letter link */}
                {r.letter_url && (
                  <a href={r.letter_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded-lg">
                    📎 Open official letter
                  </a>
                )}

                {/* Granted amount (approved) */}
                {r.status === 'approved' && r.amount_granted && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-3 py-2 rounded-lg text-sm font-semibold">
                      💰 Granted {NPR(r.amount_granted)}
                    </span>

                    {r.grant_disbursement_status === 'disbursed' ? (
                      <span className="inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-3 py-2 rounded-lg text-sm font-semibold">
                        ✓ Disbursed
                      </span>
                    ) : r.grant_id ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-3 py-2 rounded-lg text-sm font-semibold">
                          ⏳ Pending disbursement
                        </span>
                        <button
                          onClick={() => disburseMutation.mutate(r.grant_id)}
                          disabled={disburseMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-3 py-2 transition-colors"
                        >
                          {disburseMutation.isPending ? 'Releasing…' : '💵 Mark Disbursed'}
                        </button>
                      </>
                    ) : null}
                  </div>
                )}

                {/* Admin response (if reviewed) */}
                {r.admin_response && !isPending && (
                  <div className="mt-3 text-xs bg-slate-50 dark:bg-slate-700/40 rounded-lg p-2.5">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Your response: </span>
                    <span className="text-slate-600 dark:text-slate-300">{r.admin_response}</span>
                    {r.reviewed_by_username && (
                      <span className="text-slate-400"> — {r.reviewed_by_username}</span>
                    )}
                  </div>
                )}

                {/* Actions (pending only) */}
                {isPending && (() => {
                  const amt = Number(amountById[r.id] || 0)
                  const note = (noteById[r.id] || '').trim()
                  const overBudget = amt > available
                  const canApprove = !!pool && amt > 0 && !overBudget && !busy
                  return (
                    <div className="mt-4 space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Amount to grant (NPR) — read the letter, then decide
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={amountById[r.id] || ''}
                          onChange={e => setAmount(r.id, e.target.value)}
                          placeholder="e.g. 300000"
                          className={`w-full border rounded-xl px-3 py-2 text-sm tabular-nums bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                            overBudget
                              ? 'border-red-400 focus:ring-red-500/40'
                              : 'border-slate-200 dark:border-slate-600 focus:ring-blue-500/40'
                          }`}
                        />
                        {amt > 0 && (
                          <p className={`text-[11px] mt-1 ${overBudget ? 'text-red-500' : 'text-slate-400'}`}>
                            {overBudget
                              ? `Exceeds available budget (${NPR(available)})`
                              : `${NPR(amt)} · leaves ${NPR(available - amt)} in the pool`}
                          </p>
                        )}
                      </div>

                      <textarea
                        value={noteById[r.id] || ''}
                        onChange={e => setNote(r.id, e.target.value)}
                        rows={2}
                        placeholder="Response to the school (required to reject, optional to approve)…"
                        className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveMutation.mutate({
                            id: r.id, amount: amt, admin_response: noteById[r.id] || '',
                          })}
                          disabled={!canApprove}
                          className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl py-2 transition-colors">
                          ✓ Approve &amp; Grant
                        </button>
                        <button
                          onClick={() => {
                            if (!note) return
                            rejectMutation.mutate({ id: r.id, admin_response: note })
                          }}
                          disabled={busy || !note}
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl py-2 transition-colors">
                          ✕ Reject
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Approving requires an amount. Rejecting requires a response note.
                      </p>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
