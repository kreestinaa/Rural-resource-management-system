import { createContext, useState, useCallback, useRef } from 'react'

export const ToastContext = createContext(null)

const STYLES = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-yellow-500 text-white',
  info: 'bg-blue-600 text-white',
}

const ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
}

let _nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_nextId
    setToasts((prev) => [...prev, { id, message, type }])
    if (duration > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  const success = useCallback((msg, d) => toast(msg, 'success', d), [toast])
  const error = useCallback((msg, d) => toast(msg, 'error', d), [toast])
  const warning = useCallback((msg, d) => toast(msg, 'warning', d), [toast])
  const info = useCallback((msg, d) => toast(msg, 'info', d), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg pointer-events-auto
                        animate-slide-in ${STYLES[t.type] || STYLES.info}`}
          >
            <span className="text-lg leading-none mt-0.5">{ICONS[t.type]}</span>
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-white/70 hover:text-white text-lg leading-none ml-1"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
