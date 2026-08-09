// Feedback components: Alert, Progress, Skeleton

export function Alert({ type = 'info', title, message, dismissible, onDismiss, className = '' }) {
  const STYLES = {
    info:    'bg-blue-50   dark:bg-blue-950/30  border-blue-200  dark:border-blue-800  text-blue-800  dark:text-blue-300',
    success: 'bg-green-50  dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
    warning: 'bg-amber-50  dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
    error:   'bg-red-50    dark:bg-red-950/30   border-red-200   dark:border-red-800   text-red-800   dark:text-red-300',
  }
  const ICONS = { info: 'ℹ', success: '✓', warning: '⚠', error: '✕' }

  return (
    <div className={`flex gap-3 p-4 rounded-xl border animate-fade-in ${STYLES[type]} ${className}`}>
      <span className="flex-shrink-0 font-bold w-5 text-center">{ICONS[type]}</span>
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold text-sm mb-0.5">{title}</div>}
        {message && <div className="text-sm opacity-90">{message}</div>}
      </div>
      {dismissible && (
        <button onClick={onDismiss} className="flex-shrink-0 opacity-60 hover:opacity-100 text-lg leading-none">×</button>
      )}
    </div>
  )
}

export function Progress({ value = 0, max = 100, label, color = 'bg-primary-500', size = 'md', showPercent = true }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const HEIGHT = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' }
  return (
    <div className="space-y-1.5">
      {(label || showPercent) && (
        <div className="flex justify-between items-center text-sm">
          {label && <span className="text-slate-600 dark:text-slate-400">{label}</span>}
          {showPercent && <span className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">{pct.toFixed(0)}%</span>}
        </div>
      )}
      <div className={`w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden ${HEIGHT[size]}`}>
        <div
          className={`${HEIGHT[size]} ${color} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function Skeleton({ width, height, variant = 'rect', className = '' }) {
  const base = 'animate-shimmer bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 bg-[length:200%_100%]'
  const SHAPE = {
    rect:   'rounded-lg',
    circle: 'rounded-full',
    text:   'rounded h-4',
  }
  return (
    <div
      className={`${base} ${SHAPE[variant]} ${className}`}
      style={{ width: width || '100%', height: height || (variant === 'text' ? '1rem' : '1.5rem') }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" width="40px" height="40px" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
      <Skeleton height="80px" />
      <div className="space-y-2">
        <Skeleton variant="text" />
        <Skeleton variant="text" width="80%" />
      </div>
    </div>
  )
}
