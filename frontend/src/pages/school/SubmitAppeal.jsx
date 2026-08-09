import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { appealsService } from '../../services/appeals.service'
import { Alert } from '../../components/ui/feedback'

const STATUS_STYLES = {
  pending:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  under_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  accepted:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const STATUS_LABELS = {
  pending: 'Pending', under_review: 'Under Review', accepted: 'Accepted', rejected: 'Rejected',
}

export default function SubmitAppeal() {
  const { user } = useAuthStore()
  const school = user?.school
  const queryClient = useQueryClient()

  const [form, setForm] = useState({ reason: '', supporting_notes: '' })
  const [submitted, setSubmitted] = useState(false)

  const { data: historyData } = useQuery({
    queryKey: ['my-appeals'],
    queryFn: () => appealsService.getAll().then(r => r.data),
  })

  const submitMutation = useMutation({
    mutationFn: (data) => appealsService.submit(data),
    onSuccess: () => {
      setSubmitted(true)
      setForm({ reason: '', supporting_notes: '' })
      queryClient.invalidateQueries(['my-appeals'])
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.reason.trim()) return
    submitMutation.mutate(form)
  }

  const pastAppeals = historyData?.results || []

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-2xl mx-auto">
      {/* Current rank header */}
      {school && (
        <div className="card">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Your Current Standing</div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-4xl font-bold text-slate-800 dark:text-slate-200">#{school.priority_rank || '-'}</div>
              <div className="text-xs text-slate-500 mt-0.5">Priority Rank</div>
            </div>
            <div className="w-px h-12 bg-slate-200 dark:bg-slate-700" />
            <div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{((school.priority_score || 0) * 100).toFixed(1)}%</div>
              <div className="text-xs text-slate-500 mt-0.5">Priority Score</div>
            </div>
            <div className="w-px h-12 bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{school.name}</div>
              <div className="text-xs text-slate-400">{school.district}</div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white"> Submit Ranking Appeal</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Appeal your current priority ranking if you believe it does not accurately reflect your school's situation.
        </p>
      </div>

      {submitted && (
        <Alert type="success" title="Appeal Submitted" message="Your appeal has been submitted. An admin will review it and respond." />
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <label className="label">Reason for Appeal <span className="text-red-500">*</span></label>
          <textarea
            className="input min-h-[100px] resize-y"
            placeholder="Clearly explain why you believe your current ranking is inaccurate or unfair…"
            value={form.reason}
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            required
          />
        </div>

        <div>
          <label className="label">Supporting Notes <span className="text-slate-400 text-xs">(optional)</span></label>
          <textarea
            className="input min-h-[80px] resize-y"
            placeholder="Any additional context, evidence, or supporting information…"
            value={form.supporting_notes}
            onChange={e => setForm(f => ({ ...f, supporting_notes: e.target.value }))}
          />
        </div>

        {submitMutation.isError && (
          <Alert type="error" message={submitMutation.error?.response?.data?.detail || 'Submission failed. Please try again.'} />
        )}

        <button
          type="submit"
          disabled={submitMutation.isPending || !form.reason.trim()}
          className="btn-primary w-full py-2.5 disabled:opacity-50"
        >
          {submitMutation.isPending ? 'Submitting…' : '⚖️ Submit Appeal'}
        </button>
      </form>

      {/* Past appeals */}
      {pastAppeals.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Your Previous Appeals</h2>
          {pastAppeals.map(appeal => (
            <div key={appeal.id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{new Date(appeal.created_at).toLocaleDateString()}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[appeal.status] || STATUS_STYLES.pending}`}>
                  {STATUS_LABELS[appeal.status] || appeal.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{appeal.reason}</p>
              {appeal.admin_response && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5">
                  <p className="text-xs font-semibold text-blue-600 mb-0.5">Admin Response</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">{appeal.admin_response}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
