import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '../store/auth.store'

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { label: 'One number (0–9)', test: (p) => /[0-9]/.test(p) },
  { label: 'One symbol (! @ # $ % & *)', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export default function Login() {
  const [tab, setTab] = useState('login')  // 'login' | 'register'
  const [form, setForm] = useState({ username: '', password: '', email: '', emis: '', role: 'principal' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { setTokens, setUser } = useAuthStore()
  const navigate = useNavigate()

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.post('/api/auth/login/', {
        username: form.username,
        password: form.password,
      })
      setTokens(data.access, data.refresh)

      // Fetch full user profile (role + school data)
      const me = await axios.get('/api/auth/me/', {
        headers: { Authorization: `Bearer ${data.access}` }
      })
      setUser(me.data)

      if (me.data.role === 'admin') {
        navigate('/admin/dashboard')
      } else {
        navigate('/school/dashboard')
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message
      setError(msg || 'Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await axios.post('/api/auth/register/', {
        username: form.username,
        password: form.password,
        email: form.email,
        emis: form.emis,
        role: form.role,
      })
      setSuccess('Account created! You can now login.')
      setTab('login')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg w-full max-w-md p-8">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏫</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rural Resource Allocation</h1>
  
        </div>

        {/* Tabs */}
        <div className="flex border border-gray-200 rounded-lg p-1 mb-6">
          <button
            onClick={() => { setTab('login'); setError(''); setSuccess('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'login' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🔐 Login
          </button>
          <button
            onClick={() => { setTab('register'); setError(''); setSuccess('') }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'register' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Register
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2 mb-4">
            ✅ {success}
          </div>
        )}

        {/* Login Form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={e => update('username', e.target.value)}
                className="input"
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                className="input"
                placeholder="Enter password"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary py-2.5 flex items-center justify-center gap-2">
              {loading ? '⏳ Signing in...' : '🔐 Sign In'}
            </button>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500 font-medium">Admin credentials</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Username: <strong>admin</strong> &nbsp;|&nbsp; Password: <strong>admin123</strong>
              </p>
            </div>
          </form>
        )}

        {/* Register Form */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                EMIS Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.emis}
                onChange={e => update('emis', e.target.value)}
                className="input"
                placeholder="e.g. NP12345"
                required
              />
          
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.username}
                onChange={e => update('username', e.target.value)}
                className="input"
                placeholder="Choose a username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                className="input"
                placeholder="Choose a strong password"
                required
              />
              {/* Live password strength checklist */}
              {form.password.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {PASSWORD_RULES.map(rule => {
                    const ok = rule.test(form.password)
                    return (
                      <li
                        key={rule.label}
                        className={`text-xs flex items-center gap-1.5 ${
                          ok ? 'text-green-600' : 'text-gray-400'
                        }`}
                      >
                        <span>{ok ? '✓' : '○'}</span>
                        {rule.label}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                className="input"
                placeholder="school@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={form.role}
                onChange={e => update('role', e.target.value)}
                className="input"
              >
                <option value="principal">Principal</option>
                <option value="admin_staff">Administrative Staff</option>
              </select>
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary py-2.5 flex items-center justify-center gap-2">
              {loading ? '⏳ Registering...' : '📝 Register School Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
