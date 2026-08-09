import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appealsService } from '../../services/appeals.service'
import { SkeletonCard } from '../../components/ui/feedback'

const STATUS_STYLES = {
  pending:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  under_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  accepted:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}
const STATUS_LABELS = {
  pending: 'Pending', under_review: 'Under Review', accepted: 'Accepted', rejected: 'Rejected',
}

const TABS = ['All', 'Pending', 'Under Review', 'Accepted', 'Rejected']
const TAB_STATUS = { All: '', Pending: 'pending', 'Under Review': 'under_review', Accepted: 'accepted', Rejected: 'rejected' }

function ResponseModal({ title, action, onClose, onSubmit, requireResponse }) {
  const [response, setResponse] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <h3 className="font-bold text-slate-800 dark:text-slate-200">{title}</h3>
        <div>
          <label className="label">Admin Response {requireResponse && <span className="text-red-500">*</span>}</label>
          <textarea
            className="input min-h-[80px]"
            placeholder="Enter your response to the school…"
            value={response}
            onChange={e => setResponse(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button
            onClick={() => onSubmit(response)}
            disabled={requireResponse && !response.trim()}
            className={`btn-primary btn-sm disabled:opacity-50 ${action === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {action === 'reject' ? 'Reject' : action === 'accept' ? 'Accept' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Appeals() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('Pending')
  const [modal, setModal] = useState(null) // { appeal, action }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-appeals'],
    queryFn: () => appealsService.getAll().then(r => r.data),
  })

  const markUnderReviewMutation = useMutation({
    mutationFn: (id) => appealsService.markUnderReview(id),
    onSuccess: () => queryClient.invalidateQueries(['admin-appeals']),
  })

  const acceptMutation = useMutation({
    mutationFn: ({ id, admin_response }) => appealsService.accept(id, { admin_response }),
    onSuccess: () => { queryClient.invalidateQueries(['admin-appeals']); setModal(null) },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, admin_response }) => appealsService.reject(id, { admin_response }),
    onSuccess: () => { queryClient.invalidateQueries(['admin-appeals']); setModal(null) },
  })

  const all = data?.results || []
  const statusKey = TAB_STATUS[activeTab]
  const filtered = statusKey ? all.filter(a => a.status === statusKey) : all

  const countByStatus = (s) => all.filter(a => a.status === s).length

  const handleModalSubmit = (response) => {
    if (!modal) return
    if (modal.action === 'accept') acceptMutation.mutate({ id: modal.appeal.id, admin_response: response })
    else rejectMutation.mutate({ id: modal.appeal.id, admin_response: response })
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="nepal-stripe w-full" />

      <div className="px-6 pt-5 pb-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">⚖️ Ranking Appeals</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Review and respond to school ranking appeals</p>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">{countByStatus('pending')} pending</span>
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">{countByStatus('under_review')} under review</span>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-0">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab}
              {TAB_STATUS[tab] && countByStatus(TAB_STATUS[tab]) > 0 && (
                <span className="ml-1.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-full px-1.5 py-0.5 text-[10px]">
                  {countByStatus(TAB_STATUS[tab])}
                </span>
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
            <div className="text-4xl mb-3">⚖️</div>
            <p className="text-slate-400">No {activeTab !== 'All' ? activeTab.toLowerCase() : ''} appeals found.</p>
          </div>
        ) : (
          filtered.map(appeal => (
            <div key={appeal.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card p-5 space-y-3">
              {/* Header row */}
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{appeal.school_name}</div>
                  <div className="text-xs text-slate-400">{appeal.school_district} · {appeal.submitted_by_username} · {new Date(appeal.created_at).toLocaleDateString()}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[appeal.status]}`}>
                  {STATUS_LABELS[appeal.status]}
                </span>
              </div>

              {/* Rank + score */}
              <div className="flex gap-4">
                <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl px-4 py-2 text-center">
                  <div className="text-lg font-black text-slate-800 dark:text-slate-200">#{appeal.current_rank}</div>
                  <div className="text-[10px] text-slate-400">Rank at submission</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl px-4 py-2 text-center">
                  <div className="text-lg font-black text-slate-800 dark:text-slate-200">{((appeal.current_score || 0) * 100).toFixed(1)}%</div>
                  <div className="text-[10px] text-slate-400">Score at submission</div>
                </div>
              </div>

              {/* Reason */}
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3">
                <div className="text-xs font-semibold text-slate-500 mb-1">Reason</div>
                <p className="text-sm text-slate-700 dark:text-slate-300">{appeal.reason}</p>
              </div>

              {appeal.supporting_notes && (
                <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3">
                  <div className="text-xs font-semibold text-slate-500 mb-1">Supporting Notes</div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{appeal.supporting_notes}</p>
                </div>
              )}

              {appeal.admin_response && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                  <div className="text-xs font-semibold text-blue-600 mb-1">Admin Response · {appeal.reviewed_by_username}</div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">{appeal.admin_response}</p>
                </div>
              )}

              {/* Action buttons */}
              {(appeal.status === 'pending' || appeal.status === 'under_review') && (
                <div className="flex flex-wrap gap-2">
                  {appeal.status === 'pending' && (
                    <button
                      onClick={() => markUnderReviewMutation.mutate(appeal.id)}
                      disabled={markUnderReviewMutation.isPending}
                      className="btn-secondary btn-sm text-blue-600 dark:text-blue-400"
                    >
                      🔍 Mark Under Review
                    </button>
                  )}
                  <button
                    onClick={() => setModal({ appeal, action: 'accept' })}
                    className="btn-primary btn-sm bg-green-600 hover:bg-green-700"
                  >
                    ✓ Accept
                  </button>
                  <button
                    onClick={() => setModal({ appeal, action: 'reject' })}
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

      {modal && (
        <ResponseModal
          title={modal.action === 'accept' ? 'Accept Appeal' : 'Reject Appeal'}
          action={modal.action}
          requireResponse={modal.action === 'reject'}
          onClose={() => setModal(null)}
          onSubmit={handleModalSubmit}
        />
      )}
    </div>
  )
}
