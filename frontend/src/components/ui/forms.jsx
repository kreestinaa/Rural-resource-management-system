// Form components

const baseInput = `w-full border rounded-xl px-3 py-2.5 text-sm transition-all duration-150
  bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100
  border-slate-200 dark:border-slate-600
  placeholder:text-slate-400 dark:placeholder:text-slate-500
  focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
  disabled:opacity-50 disabled:cursor-not-allowed`

function FieldWrapper({ label, error, hint, required, children }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Input({ label, error, hint, required, className = '', ...props }) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <input
        className={`${baseInput} ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-400/30' : ''} ${className}`}
        {...props}
      />
    </FieldWrapper>
  )
}

export function Select({ label, options = [], error, hint, required, className = '', ...props }) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <select className={`${baseInput} cursor-pointer ${error ? 'border-red-400' : ''} ${className}`} {...props}>
        {options.map((opt) => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
    </FieldWrapper>
  )
}

export function Textarea({ label, error, hint, required, className = '', rows = 3, ...props }) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <textarea
        rows={rows}
        className={`${baseInput} resize-y ${error ? 'border-red-400' : ''} ${className}`}
        {...props}
      />
    </FieldWrapper>
  )
}

export function Checkbox({ label, description, className = '', ...props }) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer group ${className}`}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600
                   text-primary-600 focus:ring-primary-500 cursor-pointer"
        {...props}
      />
      <div>
        {label && <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900">{label}</span>}
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
    </label>
  )
}

export function RadioGroup({ label, options = [], value, onChange }) {
  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{label}</p>}
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150
            ${value === opt.value
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
        >
          <input
            type="radio"
            name={label}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="mt-0.5 text-primary-600 focus:ring-primary-500"
          />
          <div>
            <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{opt.label}</div>
            {opt.description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.description}</div>}
          </div>
        </label>
      ))}
    </div>
  )
}

export function RangeSlider({ label, min = 0, max = 1, step = 0.05, value, onChange, showValue = true, color = '#3b82f6', formatValue }) {
  const pct = ((value - min) / (max - min)) * 100
  const display = formatValue ? formatValue(value) : `${Math.round(value * 100)}%`
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {label && <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>}
        {showValue && (
          <span className="text-sm font-bold tabular-nums" style={{ color }}>{display}</span>
        )}
      </div>
      <div className="relative h-5 flex items-center">
        {/* Track background */}
        <div className="absolute inset-x-0 h-2 rounded-full bg-slate-100 dark:bg-slate-700" />
        {/* Filled portion */}
        <div
          className="absolute left-0 h-2 rounded-full transition-all duration-100"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-x-0 h-2 opacity-0 cursor-pointer w-full"
          style={{ zIndex: 10 }}
        />
        {/* Thumb */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md transition-all duration-100"
          style={{ left: `calc(${pct}% - 8px)`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export function FormGroup({ children, cols = 1, className = '' }) {
  const gridCls = { 1: '', 2: 'grid grid-cols-1 sm:grid-cols-2 gap-4', 3: 'grid grid-cols-1 sm:grid-cols-3 gap-4' }
  return <div className={`${gridCls[cols] || ''} ${className}`}>{children}</div>
}

export function FormActions({ children, align = 'right', className = '' }) {
  const alignCls = { left: 'justify-start', center: 'justify-center', right: 'justify-end', between: 'justify-between' }
  return (
    <div className={`flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-700 ${alignCls[align]} ${className}`}>
      {children}
    </div>
  )
}
