import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schoolsService } from '../../services/schools.service'

const PROVINCES = [
  { value: '', label: 'All Provinces' },
  { value: 'bagmati', label: 'Bagmati' },
  { value: 'gandaki', label: 'Gandaki' },
  { value: 'province1', label: 'Koshi' },
  { value: 'madhesh', label: 'Madhesh' },
  { value: 'lumbini', label: 'Lumbini' },
  { value: 'karnali', label: 'Karnali' },
  { value: 'sudurpashchim', label: 'Sudurpashchim' },
]

const SCHOOL_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'primary', label: 'Primary' },
  { value: 'lower_secondary', label: 'Lower Secondary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'higher_secondary', label: 'Higher Secondary' },
]

const EMPTY_SCHOOL = {
  name: '', emis: '', province: 'bagmati', district: '',
  school_type: 'primary', is_rural: true,
  students: 0, teachers: 1, classrooms: 1,
  female_students: 0, female_teachers: 0,
  student_teacher_ratio: 0, infrastructure_deficit: 0,
  material_shortage: 0, geographic_difficulty: 0, socioeconomic_index: 0,
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

function SchoolForm({ initial = EMPTY_SCHOOL, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...initial })
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form) }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">School Name *</label>
          <input className="input w-full" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">EMIS Code *</label>
          <input className="input w-full" required value={form.emis} onChange={(e) => set('emis', e.target.value.toUpperCase())} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">District *</label>
          <input className="input w-full" required value={form.district} onChange={(e) => set('district', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Province</label>
          <select className="input w-full" value={form.province} onChange={(e) => set('province', e.target.value)}>
            {PROVINCES.filter(p => p.value).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">School Type</label>
          <select className="input w-full" value={form.school_type} onChange={(e) => set('school_type', e.target.value)}>
            {SCHOOL_TYPES.filter(t => t.value).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {[
          ['students', 'Students'], ['teachers', 'Teachers'], ['classrooms', 'Classrooms'],
          ['female_students', 'Female Students'], ['female_teachers', 'Female Teachers'],
        ].map(([k, label]) => (
          <div key={k}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <input type="number" min="0" className="input w-full" value={form[k]} onChange={(e) => set(k, parseInt(e.target.value) || 0)} />
          </div>
        ))}
        {[
          ['student_teacher_ratio', 'S:T Ratio (0-100)'],
          ['infrastructure_deficit', 'Infrastructure Deficit'],
          ['material_shortage', 'Material Shortage'],
          ['geographic_difficulty', 'Geographic Difficulty'],
          ['socioeconomic_index', 'Socioeconomic Index'],
        ].map(([k, label]) => (
          <div key={k}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <input type="number" min="0" max="100" step="0.1" className="input w-full" value={form[k]} onChange={(e) => set(k, parseFloat(e.target.value) || 0)} />
          </div>
        ))}
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="is_rural" checked={form.is_rural} onChange={(e) => set('is_rural', e.target.checked)} />
          <label htmlFor="is_rural" className="text-sm text-gray-700 dark:text-gray-300">Rural School</label>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save School'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
      </div>
    </form>
  )
}

function CreateLoginModal({ school, onClose }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { mutate, isPending } = useMutation({
    mutationFn: (data) => import('../../services/api').then(({ default: api }) =>
      api.post('/auth/register/', data)
    ),
    onSuccess: () => setSuccess(true),
    onError: (e) => setError(e.response?.data?.error || 'Failed to create account.'),
  })

  if (success) {
    return (
      <Modal title="Login Account Created" onClose={onClose}>
        <div className="text-center py-4">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-green-700 font-medium">Account created for {school.name}!</p>
          <p className="text-gray-500 text-sm mt-1">Username: <strong>{username}</strong></p>
          <button onClick={onClose} className="btn-primary mt-4 w-full">Close</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={`Create Login — ${school.name}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-500">EMIS: {school.emis}</p>
        {error && <div className="text-red-600 text-sm bg-red-50 rounded p-2">{error}</div>}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Username *</label>
          <input className="input w-full" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Password *</label>
          <input type="password" className="input w-full" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button
          disabled={isPending || !username || !password}
          onClick={() => mutate({ username, password, emis: school.emis, role: 'principal' })}
          className="btn-primary w-full disabled:opacity-50"
        >
          {isPending ? 'Creating…' : 'Create Account'}
        </button>
      </div>
    </Modal>
  )
}

function CSVImportModal({ onClose }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    try {
      const { data } = await schoolsService.importCSV(file)
      setResult(data)
    } catch (e) {
      setResult({ error: e.response?.data?.error || 'Import failed.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Import Schools from CSV" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
          <strong>CSV columns:</strong> name, emis, province, district, students, teachers,
          student_teacher_ratio, infrastructure_deficit, material_shortage,
          geographic_difficulty, socioeconomic_index
        </div>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
        >
          <div className="text-3xl mb-2">📁</div>
          <p className="text-sm text-gray-500">{file ? file.name : 'Click to select CSV file'}</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
        </div>
        {result && (
          <div className={`rounded-lg p-3 text-sm ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {result.error ? result.error : (
              <>
                <p>✅ Created: {result.created} schools</p>
                <p>🔄 Updated: {result.updated} schools</p>
                {result.errors?.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-orange-700">Errors ({result.errors.length}):</p>
                    <ul className="list-disc list-inside text-xs mt-1 text-orange-600">
                      {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {loading ? 'Importing…' : 'Import CSV'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Close</button>
        </div>
      </div>
    </Modal>
  )
}

export default function Schools() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [province, setProvince] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [isRural, setIsRural] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editSchool, setEditSchool] = useState(null)
  const [loginSchool, setLoginSchool] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['schools', page, search, province, schoolType, isRural],
    queryFn: () =>
      schoolsService.getAll({
        page,
        search: search || undefined,
        province: province || undefined,
        school_type: schoolType || undefined,
        is_rural: isRural !== '' ? isRural : undefined,
      }).then((r) => r.data),
    keepPreviousData: true,
  })

  const createMutation = useMutation({
    mutationFn: schoolsService.create,
    onSuccess: () => { queryClient.invalidateQueries(['schools']); setShowCreate(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => schoolsService.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['schools']); setEditSchool(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: schoolsService.delete,
    onSuccess: () => { queryClient.invalidateQueries(['schools']); setDeleteId(null) },
  })

  const schools = data?.results || []
  const totalPages = Math.ceil((data?.count || 0) / 20)

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">School Management</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.count ?? '…'} schools total</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
            ＋ Create School
          </button>
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-1.5">
            📁 Import CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            className="input col-span-1 sm:col-span-2 lg:col-span-1"
            placeholder="Search name, EMIS, district…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <select className="input" value={province} onChange={(e) => { setProvince(e.target.value); setPage(1) }}>
            {PROVINCES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select className="input" value={schoolType} onChange={(e) => { setSchoolType(e.target.value); setPage(1) }}>
            {SCHOOL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="input" value={isRural} onChange={(e) => { setIsRural(e.target.value); setPage(1) }}>
            <option value="">Rural & Urban</option>
            <option value="true">Rural Only</option>
            <option value="false">Urban Only</option>
          </select>
          <button
            onClick={() => { setSearch(''); setProvince(''); setSchoolType(''); setIsRural(''); setPage(1) }}
            className="btn-secondary text-sm"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-center py-16 text-gray-400 text-sm animate-pulse">Loading schools…</div>
        ) : schools.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No schools found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  {['School', 'EMIS', 'Province', 'District', 'Students', 'Rank', 'Type', 'Actions'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.id} className="border-t border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800 dark:text-gray-200 max-w-[200px] truncate">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.is_rural ? '🌾 Rural' : '🏙️ Urban'}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 font-mono text-xs">{s.emis}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 capitalize text-xs">{s.province}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-xs">{s.district}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{s.students}</td>
                    <td className="py-3 px-4">
                      {s.priority_rank ? (
                        <span className={`font-bold text-xs ${s.priority_rank <= 10 ? 'text-red-600' : s.priority_rank <= 50 ? 'text-orange-500' : 'text-gray-500'}`}>
                          #{s.priority_rank}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded capitalize">
                        {s.school_type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => setEditSchool(s)}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setLoginSchool(s)}
                          className="text-xs px-2 py-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100"
                        >
                          Login
                        </button>
                        <button
                          onClick={() => setDeleteId(s.id)}
                          className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <Modal title="Create New School" onClose={() => setShowCreate(false)}>
          <SchoolForm
            onSave={(data) => createMutation.mutate(data)}
            onCancel={() => setShowCreate(false)}
            saving={createMutation.isPending}
          />
          {createMutation.isError && (
            <p className="text-red-600 text-sm mt-2">
              {createMutation.error?.response?.data?.emis?.[0] || 'Failed to create school.'}
            </p>
          )}
        </Modal>
      )}

      {editSchool && (
        <Modal title={`Edit: ${editSchool.name}`} onClose={() => setEditSchool(null)}>
          <SchoolForm
            initial={editSchool}
            onSave={(data) => updateMutation.mutate({ id: editSchool.id, data })}
            onCancel={() => setEditSchool(null)}
            saving={updateMutation.isPending}
          />
        </Modal>
      )}

      {loginSchool && (
        <CreateLoginModal school={loginSchool} onClose={() => setLoginSchool(null)} />
      )}

      {showImport && <CSVImportModal onClose={() => { setShowImport(false); queryClient.invalidateQueries(['schools']) }} />}

      {deleteId && (
        <Modal title="Confirm Delete" onClose={() => setDeleteId(null)}>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Are you sure you want to delete this school? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Yes, Delete'}
            </button>
            <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
