import axios from 'axios'
import { useAuthStore } from '../store/auth.store'

// Response cache for GET requests (5-minute TTL)
const _cache = new Map()
const CACHE_TTL = 5 * 60 * 1000

function _cacheGet(key) {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null }
  return entry.data
}

function _cacheSet(key, data) {
  _cache.set(key, { data, ts: Date.now() })
}

export function clearApiCache(pattern) {
  if (!pattern) { _cache.clear(); return }
  for (const key of _cache.keys()) {
    if (key.includes(pattern)) _cache.delete(key)
  }
}

// In-flight request deduplication
const _inFlight = new Map()

// Axios instance
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor: 401 -> refresh or logout
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retried) {
      original._retried = true
      const { refreshToken, setTokens, logout } = useAuthStore.getState()
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/token/refresh/', {
            refresh: refreshToken,
          })
          setTokens(data.access, refreshToken)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch {
          logout()
          window.location.href = '/login'
          return Promise.reject(error)
        }
      }
      logout()
      window.location.href = '/login'
    }

    // Human-readable error message from backend envelope
    const serverMsg =
      error.response?.data?.error?.message ||
      error.response?.data?.detail ||
      error.response?.data?.message ||
      null

    if (serverMsg) {
      error.userMessage = serverMsg
    } else {
      const status = error.response?.status
      error.userMessage =
        status === 400 ? 'Invalid request. Please check your input.'
        : status === 403 ? 'You do not have permission to perform this action.'
        : status === 404 ? 'The requested resource was not found.'
        : status === 429 ? 'Too many requests. Please slow down.'
        : status === 500 ? 'Server error. Please try again later.'
        : error.code === 'ECONNABORTED' ? 'Request timed out. Check your connection.'
        : 'Something went wrong. Please try again.'
    }

    return Promise.reject(error)
  }
)

// Retry helper (exponential backoff, network errors only)
async function _withRetry(fn, retries = 2, delay = 500) {
  try {
    return await fn()
  } catch (err) {
    const isRetryable =
      !err.response || err.code === 'ECONNABORTED' || err.response?.status >= 500
    if (retries > 0 && isRetryable) {
      await new Promise((r) => setTimeout(r, delay))
      return _withRetry(fn, retries - 1, delay * 2)
    }
    throw err
  }
}

// Public helpers

/**
 * Cached + deduplicated GET.
 * Identical in-flight requests are coalesced into a single HTTP call.
 */
export async function apiGet(url, params = {}) {
  const key = url + JSON.stringify(params)

  const cached = _cacheGet(key)
  if (cached) return cached

  if (_inFlight.has(key)) return _inFlight.get(key)

  const req = _withRetry(() => api.get(url, { params }))
    .then((res) => {
      _cacheSet(key, res.data)
      _inFlight.delete(key)
      return res.data
    })
    .catch((err) => {
      _inFlight.delete(key)
      throw err
    })

  _inFlight.set(key, req)
  return req
}

export async function apiPost(url, data = {}) {
  return _withRetry(() => api.post(url, data)).then((r) => r.data)
}

export async function apiPut(url, data = {}) {
  return _withRetry(() => api.put(url, data)).then((r) => r.data)
}

export async function apiPatch(url, data = {}) {
  return _withRetry(() => api.patch(url, data)).then((r) => r.data)
}

export async function apiDelete(url) {
  return _withRetry(() => api.delete(url)).then((r) => r.data)
}

export default api
