// Layout components: Card, PageHeader, Section, Divider

export function Card({ children, className = '', hover = false, padding = 'p-6' }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-slate-100
                     dark:border-slate-700 shadow-card ${padding}
                     ${hover ? 'transition-shadow duration-200 hover:shadow-card-hover' : ''}
                     ${className}`}>
      {children}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, breadcrumb }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in">
      <div>
        {breadcrumb && (
          <div className="text-xs text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1">
            {breadcrumb}
          </div>
        )}
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Section({ title, description, children, action, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">{title}</h2>}
            {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function Divider({ label, className = '' }) {
  if (!label) return <hr className={`border-slate-100 dark:border-slate-700 my-4 ${className}`} />
  return (
    <div className={`flex items-center gap-3 my-4 ${className}`}>
      <hr className="flex-1 border-slate-100 dark:border-slate-700" />
      <span className="text-xs text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">{label}</span>
      <hr className="flex-1 border-slate-100 dark:border-slate-700" />
    </div>
  )
}
