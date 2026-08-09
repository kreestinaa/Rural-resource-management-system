import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { resourceRequestService } from '../../services/resourceRequest.service'
import { Alert } from '../../components/ui/feedback'

const STATUS_STYLES = {
  pending:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  under_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  approved:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}
const STATUS_LABELS = {
  pending: 'Pending', under_review: 'Under Review', approved: 'Approved', rejected: 'Rejected',
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png'
const MAX_MB = 5

export default function ResourceRequest() {
  const { user } = useAuthStore()
  const school = user?.school
  const queryClient = useQueryClient()

  const [subject, setSubject] = useState('')
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const { data: historyData } = useQuery({
    queryKey: ['my-resource-requests'],
    queryFn: () => resourceRequestService.getAll().then(r => r.data),
  })

  const submitMutation = useMutation({
    mutationFn: (formData) => resourceRequestService.submit(formData),
    onSuccess: () => {
      setSubmitted(true)
      setSubject('')
      setFile(null)
      setFileError('')
      queryClient.invalidateQueries(['my-resource-requests'])
    },
  })

  const pickFile = (e) => {
    const f = e.target.files?.[0]
    setFileError('')
    if (!f) { setFile(null); return }
    const okType = /\.(pdf|jpg|jpeg|png)$/i.test(f.name)
    if (!okType) { setFileError('Letter must be a PDF, JPG, or PNG.'); setFile(null); return }
    if (f.size > MAX_MB * 1024 * 1024) { setFileError(`File too large (max ${MAX_MB} MB).`); setFile(null); return }
    setFile(f)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!subject.trim() || !file) return
    const fd = new FormData()
    fd.append('subject', subject.trim())
    fd.append('letter', file)
    submitMutation.mutate(fd)
  }

  const pastRequests = historyData?.results || []

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="card">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Resource Request</div>
        <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{school?.name || 'Your School'}</div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Upload your school's official letter requesting resources. Include all details
          (what you need, quantity, justification) inside the letter itself.
        </p>
      </div>

      {submitted && (
        <Alert type="success" title="Request submitted"
          message="Your resource request and letter have been sent to the Ministry for review. You'll be notified of the decision." />
      )}
      {submitMutation.isError && (
        <Alert type="error" title="Submission failed"
          message={submitMutation.error?.response?.data?.letter?.[0]
            || submitMutation.error?.response?.data?.error
            || 'Could not submit. Please check the file and try again.'} />
      )}

      {/* Submit form */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card p-6">
        <h2 className="font-bold text-slate-800 dark:text-slate-200 mb-4"> New Request</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              maxLength={200}
              placeholder="e.g. Request for additional teachers and desks"
              className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">A short line so the Ministry can identify your request.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Official Letter <span className="text-red-500">*</span>
            </label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl px-4 py-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/10 transition-colors">
              <span className="text-3xl">{file ? '📎' : '⬆️'}</span>
              {file ? (
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 break-all">{file.name}</div>
                  <div className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB · click to replace</div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-300">Click to upload your letter</div>
                  <div className="text-xs text-slate-400">PDF, JPG, or PNG · max {MAX_MB} MB</div>
                </div>
              )}
              <input type="file" accept={ACCEPT} onChange={pickFile} className="hidden" />
            </label>
            {fileError && <p className="text-xs text-red-500 mt-1.5">{fileError}</p>}
          </div>

          <button
            type="submit"
            disabled={!subject.trim() || !file || submitMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl py-2.5 transition-colors"
          >
            {submitMutation.isPending ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      </div>

      {/* Past requests */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-card p-6">
        <h2 className="font-bold text-slate-800 dark:text-slate-200 mb-4">Your Requests</h2>
        {pastRequests.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No requests submitted yet.</p>
        ) : (
          <div className="space-y-3">
            {pastRequests.map(r => (
              <div key={r.id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 break-words">{r.subject}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[r.status] || ''}`}>
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </div>
                {r.status === 'approved' && r.amount_granted && (
                  <div className="mt-2 inline-flex items-center gap-2 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-3 py-2 rounded-lg text-sm font-bold">
                     Granted NPR {Number(r.amount_granted).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                )}
                {r.letter_url && (
                  <a href={r.letter_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2">
                    📎 View submitted letter
                  </a>
                )}
                {r.admin_response && (
                  <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-700/40 rounded-lg p-2.5">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Ministry response: </span>
                    <span className="text-slate-600 dark:text-slate-300">{r.admin_response}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
