import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import { SkeletonCard } from '../../components/ui/feedback'

const INDICATORS = [
  { key: 'student_teacher_ratio',  label: 'S-T Ratio',  cur: 'current_student_teacher_ratio',  prev: 'prev_student_teacher_ratio' },
  { key: 'infrastructure_deficit', label: 'Infra',       cur: 'current_infrastructure_deficit', prev: 'prev_infrastructure_deficit' },
  { key: 'material_shortage',      label: 'Materials',   cur: 'current_material_shortage',      prev: 'prev_material_shortage' },
  { key: 'geographic_difficulty',  label: 'Geography',   cur: 'current_geographic_difficulty',  prev: 'prev_geographic_difficulty' },
  { key: 'socioeconomic_index',    label: 'SES',         cur: 'current_socioeconomic_index',    prev: 'prev_socioeconomic_index' },
]

const STATUS_STYLES = {
  pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

function RejectModal({ req, onClose, onReject }) {
  const [note, setNote] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <h3 className="font-bold text-slate-800 dark:text-slate-200">Reject Verification Request</h3>
        <p className="text-sm text-slate-500">School: <strong>{req.school_name}</strong></p>
        <div>
          <label className="label">Admin Note <span className="text-red-500">*</span></label>
          <textarea
            className="input min-h-[80px]"
            placeholder="Explain why this request is being rejected…"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button
            onClick={() => onReject(req.id, note)}
            disabled={!note.trim()}
            className="btn-primary btn-sm bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Verifications() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('pending')
  const [rejectTarget, setRejectTarget] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-verifications'],
    queryFn: () => verificationService.getAll().then(r => r.data),
  })

  const approveMutation = useMutation({
    mutationFn: (id) => verificationService.approve(id),
    onSuccess: () => queryClient.invalidateQueries(['admin-verifications']),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, admin_note }) => verificationService.reject(id, { admin_note }),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-verifications'])
      setRejectTarget(null)
    },
  })

  const all = data?.results || []
  const filtered = statusFilter === 'all' ? all : all.filter(r => r.status === statusFilter)
  const pendingCount = all.filter(r => r.status === 'pending').length

  return (
    <div className="flex flex-col min-h-0">
      <div className="nepal-stripe w-full" />

      <div className="px-6 pt-5 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">✅ Data Verifications</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Review and approve school data update requests</p>
          </div>
          {pendingCount > 0 && (
            <span className="text-sm bg-amber-500 text-white font-bold px-3 py-1 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 mt-4">
          {[['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === val
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {label}
              {val === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 bg-white/30 rounded-full px-1">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 overflow-y-auto flex-1 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-slate-400">No {statusFilter !== 'all' ? statusFilter : ''} requests found.</p>
          </div>
        ) : (
          filtered.map(req => (
            <div key={req.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{req.school_name}</div>
                  <div className="text-xs text-slate-400">{req.school_district} · Submitted by {req.submitted_by_username} · {new Date(req.created_at).toLocaleDateString()}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[req.status]}`}>
                  {req.status}
                </span>
              </div>

              {/* Side-by-side indicator comparison */}
              <div className="overflow-x-auto">
                {(() => {
                  // For APPROVED requests, the school's current values already equal
                  // the proposed ones, so compare against the saved snapshot (prev_*)
                  // to show what actually changed. Header labels adapt accordingly.
                  const isApproved = req.status === 'approved'
                  const hasSnapshot = isApproved && req.prev_student_teacher_ratio != null
                  const beforeLabel = hasSnapshot ? 'Previous' : 'Current'
                  const afterLabel = isApproved ? 'Applied' : 'Proposed'
                  return (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-700">
                          <th className="tbl-head text-left">Indicator</th>
                          <th className="tbl-head">{beforeLabel}</th>
                          <th className="tbl-head">{afterLabel}</th>
                          <th className="tbl-head">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {INDICATORS.map(ind => {
                          // before = snapshot if approved & available, else live current
                          const before = Number(
                            (hasSnapshot ? req[ind.prev] : req[ind.cur]) ?? 0
                          )
                          const after = Number(req[ind.key] ?? 0)
                          const delta = after - before
                          return (
                            <tr key={ind.key} className="border-b border-slate-50 dark:border-slate-700/40">
                              <td className="tbl-cell font-medium">{ind.label}</td>
                              <td className="tbl-cell text-center tabular-nums">{before.toFixed(1)}</td>
                              <td className="tbl-cell text-center tabular-nums font-bold">{after.toFixed(1)}</td>
                              <td className="tbl-cell text-center tabular-nums">
                                <span className={delta > 0 ? 'text-red-500' : delta < 0 ? 'text-green-600' : 'text-slate-400'}>
                                  {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )
                })()}
              </div>

              {/* Reason */}
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Reason</div>
                <p className="text-sm text-slate-700 dark:text-slate-300">{req.reason}</p>
              </div>

              {req.admin_note && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                  <div className="text-xs font-semibold text-blue-600 mb-1">Admin Note</div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">{req.admin_note}</p>
                </div>
              )}

              {/* Actions */}
              {req.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMutation.mutate(req.id)}
                    disabled={approveMutation.isPending}
                    className="btn-primary btn-sm"
                  >
                    ✓ Approve & Apply
                  </button>
                  <button
                    onClick={() => setRejectTarget(req)}
                    className="btn-secondary btn-sm text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                  >
                    ✕ Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {rejectTarget && (
        <RejectModal
          req={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onReject={(id, admin_note) => rejectMutation.mutate({ id, admin_note })}
        />
      )}
    </div>
  )
}
