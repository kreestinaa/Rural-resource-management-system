import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { verificationService } from '../../services/verification.service'
import { Alert } from '../../components/ui/feedback'

const INDICATORS = [
  { 
    key: 'student_teacher_ratio',  
    label: 'Student-Teacher Ratio',  
    desc: 'Normalized 0–100 (higher = worse ratio)',
    guidance: [
      { range: '0–30', text: 'Good Ratio (15–30 students per teacher, well staffed)', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      { range: '31–50', text: 'Moderate Ratio (31–45 students per teacher, minor shortage)', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
      { range: '51–75', text: 'Severe Shortage (46–60 students per teacher, heavy workload)', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
      { range: '76–100', text: 'Extreme Deficit (60+ students per teacher, crisis shortage)', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' }
    ]
  },
  { 
    key: 'infrastructure_deficit', 
    label: 'Infrastructure Deficit',  
    desc: 'Normalized 0–100 (higher = more deficit)',
    guidance: [
      { range: '0–30%', text: 'Minor Damage (paint peeling, window crack)', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      { range: '31–60%', text: 'Moderate Damage (1 room unusable, minor roof leak)', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
      { range: '61–90%', text: 'Severe Damage (2–3 rooms destroyed, no toilets)', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
      { range: '91–100%', text: 'Extreme Crisis (building collapsed)', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' }
    ]
  },
  { 
    key: 'material_shortage',      
    label: 'Material Shortage',       
    desc: 'Normalized 0–100 (higher = more shortage)',
    guidance: [
      { range: '0–30%', text: 'Adequate Materials (all students have textbooks & desks)', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      { range: '31–60%', text: 'Partial Shortage (some textbooks or desks missing)', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
      { range: '61–90%', text: 'Severe Shortage (most students lack textbooks & lab tools)', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
      { range: '91–100%', text: 'Critical Failure (no textbooks or learning aids available)', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' }
    ]
  },
  { 
    key: 'geographic_difficulty',  
    label: 'Geographic Difficulty',   
    desc: 'Normalized 0–100 (higher = more remote)',
    guidance: [
      { range: '0–30', text: 'Easy Access (flat road, near district headquarters)', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      { range: '31–60', text: 'Moderate Access (gravel road, 1–2 hours travel)', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
      { range: '61–90', text: 'High Remoteness (steep mountain trail, multi-hour trek)', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
      { range: '91–100', text: 'Extreme Isolation (Himalayan high mountain, multi-day foot trek)', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' }
    ]
  },
  { 
    key: 'socioeconomic_index',    
    label: 'Socioeconomic Index',     
    desc: 'Normalized 0–100 (higher = more disadvantaged)',
    guidance: [
      { range: '0–30%', text: 'Low Poverty (village families have steady income)', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      { range: '31–60%', text: 'Moderate Poverty (average rural farming community)', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
      { range: '61–90%', text: 'High Poverty (most families below national poverty line)', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
      { range: '91–100%', text: 'Severe Disadvantage (marginalized, high food insecurity)', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' }
    ]
  },
]

const STATUS_STYLES = {
  pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

export default function SubmitVerification() {
  const { user } = useAuthStore()
  const school = user?.school
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    student_teacher_ratio: 0,
    infrastructure_deficit: 0,
    material_shortage: 0,
    geographic_difficulty: 0,
    socioeconomic_index: 0,
    reason: '',
  })
  const [submitted, setSubmitted] = useState(false)

  // Pre-fill from current school values
  useEffect(() => {
    if (school) {
      setForm(f => ({
        ...f,
        student_teacher_ratio: school.student_teacher_ratio ?? 0,
        infrastructure_deficit: school.infrastructure_deficit ?? 0,
        material_shortage: school.material_shortage ?? 0,
        geographic_difficulty: school.geographic_difficulty ?? 0,
        socioeconomic_index: school.socioeconomic_index ?? 0,
      }))
    }
  }, [school])

  const { data: historyData } = useQuery({
    queryKey: ['my-verification-requests'],
    queryFn: () => verificationService.getAll().then(r => r.data),
  })

  const submitMutation = useMutation({
    mutationFn: (data) => verificationService.submit(data),
    onSuccess: () => {
      setSubmitted(true)
      queryClient.invalidateQueries(['my-verification-requests'])
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.reason.trim()) return
    submitMutation.mutate(form)
  }

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const pastRequests = historyData?.results || []

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white"> Submit Data Update</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Request a correction to your school's indicator values. An admin will review and apply the changes.
        </p>
      </div>

      {submitted ? (
        <Alert type="success" title="Request Submitted" message="Your data verification request has been submitted for admin review." />
      ) : (
        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Proposed Indicator Values
          </div>

          {INDICATORS.map(ind => (
            <div key={ind.key} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
              <div>
                <label className="label">{ind.label}</label>
                <p className="text-xs text-slate-500 dark:text-slate-400">{ind.desc}</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0} max={100} step={0.1}
                  value={form[ind.key]}
                  onChange={e => update(ind.key, parseFloat(e.target.value) || 0)}
                  className="input w-24"
                />
                <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-primary-500 transition-all"
                    style={{ width: `${Math.min(100, form[ind.key])}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 w-12 text-right">
                  {Number(form[ind.key]).toFixed(1)}
                </span>
              </div>
              {school && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Current: {Number(school[ind.key] ?? 0).toFixed(1)}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {ind.guidance.map((g, i) => (
                  <div key={i} className={`p-2 rounded-md text-[10.5px] leading-snug border border-black/5 dark:border-white/5 ${g.color}`}>
                    <span className="font-bold mr-1 block sm:inline">{g.range}:</span> 
                    <span>{g.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div>
            <label className="label">Reason for Update <span className="text-red-500">*</span></label>
            <textarea
              className="input min-h-[90px] resize-y"
              placeholder="Explain why these values need to be updated (e.g., recent survey data, incorrect data entry, new assessment)…"
              value={form.reason}
              onChange={e => update('reason', e.target.value)}
              required
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
            {submitMutation.isPending ? 'Submitting…' : ' Submit Verification Request'}
          </button>
        </form>
      )}

      {/* Past requests */}
      {pastRequests.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Your Previous Requests</h2>
          {pastRequests.map(req => (
            <div key={req.id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">{new Date(req.created_at).toLocaleDateString()}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[req.status] || STATUS_STYLES.pending}`}>
                  {req.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{req.reason}</p>
              {req.admin_note && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5 italic">Admin note: {req.admin_note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
