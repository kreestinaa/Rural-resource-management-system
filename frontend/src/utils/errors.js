/**
 * Turn ANY API error into a plain string safe to render in React.
 *
 * The backend (and DRF) can return errors in several shapes:
 *   "something failed"                          → string
 *   { error: "something failed" }               → string in .error
 *   { error: { code, message } }                → object in .error  ← crashed React
 *   { detail: "Not found." }                    → DRF default
 *   { amount: ["This field is required."] }     → DRF field validation
 *   { non_field_errors: [...] }                 → DRF
 *
 * Rendering an object directly as a React child throws:
 *   "Objects are not valid as a React child (found: object with keys {code, message})"
 * This helper guarantees we always hand React a string.
 */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback

  // Axios error -> the server's response body
  const data = err?.response?.data ?? err

  const fromValue = (v) => {
    if (v == null) return null
    if (typeof v === 'string') return v
    if (Array.isArray(v)) {
      const first = v.map(fromValue).find(Boolean)
      return first || null
    }
    if (typeof v === 'object') {
      // { code, message } or { message } or { detail }
      if (typeof v.message === 'string') return v.message
      if (typeof v.detail === 'string') return v.detail
      if (typeof v.error === 'string') return v.error
      // Nested: try the first renderable value inside
      for (const key of Object.keys(v)) {
        const nested = fromValue(v[key])
        if (nested) return nested
      }
    }
    return null
  }

  return (
    fromValue(data?.error) ||
    fromValue(data?.detail) ||
    fromValue(data?.non_field_errors) ||
    fromValue(data) ||
    (typeof err?.message === 'string' ? err.message : null) ||
    fallback
  )
}

export default getErrorMessage
