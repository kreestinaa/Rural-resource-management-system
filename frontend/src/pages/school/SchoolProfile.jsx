import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { schoolsService } from '../../services/schools.service'

const STATUS_BADGES = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

function Indicator({ label, value, color }) {
  const pct = Math.min(100, Math.max(0, value || 0))
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-semibold" style={{ color }}>{pct.toFixed(1)}</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export default function SchoolProfile() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const school = user?.school
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [reviewSent, setReviewSent] = useState(false)

  const [form, setForm] = useState({
    students: school?.students || 0,
    teachers: school?.teachers || 1,
    classrooms: school?.classrooms || 1,
    female_students: school?.female_students || 0,
    female_teachers: school?.female_teachers || 0,
    male_students: school?.male_students || 0,
    male_teachers: school?.male_teachers || 0,
  })

  const { data: reviewsData } = useQuery({
    queryKey: ['my-review-requests'],
    queryFn: () => schoolsService.getMyReviewRequests().then((r) => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: schoolsService.updateMyProfile,
    onSuccess: () => { setSaved(true); queryClient.invalidateQueries(['auth-me']); setTimeout(() => setSaved(false), 3000) },
  })

  const reviewMutation = useMutation({
    mutationFn: schoolsService.requestReview,
    onSuccess: () => {
      setNote('')
      setReviewSent(true)
      queryClient.invalidateQueries(['my-review-requests'])
      setTimeout(() => setReviewSent(false), 3000)
    },
  })

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  if (!school) {
    return (
      <div className="p-8 text-center text-gray-400">No school linked to your account.</div>
    )
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-screen-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{school.name}</h1>
        <p className="text-gray-500 text-sm mt-1">EMIS: {school.emis} · {school.district}, {school.province}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editable Profile */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">✏️ Update School Data</h2>

          {saved && (
            <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-2 mb-4">
              ✅ Profile updated successfully!
            </div>
          )}
          {updateMutation.isError && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">
              Failed to update. Please try again.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {[
              ['students', 'Total Students'],
              ['teachers', 'Total Teachers'],
              ['classrooms', 'Classrooms'],
              ['female_students', 'Female Students'],
              ['female_teachers', 'Female Teachers'],
              ['male_students', 'Male Students'],
              ['male_teachers', 'Male Teachers'],
            ].map(([k, label]) => (
              <div key={k}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  type="number"
                  min="0"
                  className="input w-full"
                  value={form[k]}
                  onChange={(e) => set(k, parseInt(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => updateMutation.mutate(form)}
            disabled={updateMutation.isPending}
            className="btn-primary w-full mt-4 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Note: MCDA indicators (infrastructure, geographic difficulty, etc.) are set by the admin.
          </p>
        </div>

        {/* MCDA Indicators (read-only) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">📊 MCDA Indicators (Read-only)</h2>
          <div className="space-y-4">
            <Indicator label="Student-Teacher Ratio" value={school.student_teacher_ratio} color="#ef4444" />
            <Indicator label="Infrastructure Deficit" value={school.infrastructure_deficit} color="#f97316" />
            <Indicator label="Material Shortage" value={school.material_shortage} color="#eab308" />
            <Indicator label="Geographic Difficulty" value={school.geographic_difficulty} color="#22c55e" />
            <Indicator label="Socioeconomic Index" value={school.socioeconomic_index} color="#3b82f6" />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Priority Rank</span>
              <span className="font-bold text-gray-800 dark:text-gray-200">#{school.priority_rank || '—'}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">Priority Score</span>
              <span className="font-bold text-gray-800 dark:text-gray-200">
                {((school.priority_score || 0) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Review Request */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">🔍 Request Re-ranking Review</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          If you believe your MCDA indicators are inaccurate, request an admin review.
        </p>

        {reviewSent && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-2 mb-4">
            ✅ Review request submitted!
          </div>
        )}

        <textarea
          className="input w-full h-24 resize-none"
          placeholder="Explain why you're requesting a re-ranking review (e.g. new infrastructure completed, corrected enrollment data…)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          onClick={() => reviewMutation.mutate(note)}
          disabled={reviewMutation.isPending || !note.trim()}
          className="btn-primary mt-3 disabled:opacity-50"
        >
          {reviewMutation.isPending ? 'Submitting…' : 'Submit Review Request'}
        </button>
      </div>

      {/* Past Review Requests */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">📋 Past Review Requests</h2>
        {(reviewsData?.results || []).length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">No review requests submitted yet.</p>
        ) : (
          <div className="space-y-3">
            {(reviewsData?.results || []).map((r) => (
              <div key={r.id} className="p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGES[r.status]}`}>
                    {r.status}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{r.note}</p>
                {r.admin_response && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 italic">
                    Admin: {r.admin_response}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
