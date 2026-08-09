import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LogIn, Coins, RefreshCw, School, Calculator } from 'lucide-react'
import { auditService } from '../../services/audit.service'

// Colour + icon + label for each kind of audit action.
// Keeping this as one table makes it easy to add new action types later.
const ACTIONS = {
  user_login:               { color: 'bg-blue-100 text-blue-700',       icon: LogIn,      label: 'Login' },
  allocation_cycle_created: { color: 'bg-green-100 text-green-700',      icon: Coins,      label: 'Cycle Created' },
  allocation_cycle_updated: { color: 'bg-emerald-100 text-emerald-700', icon: RefreshCw,  label: 'Cycle Updated' },
  school_profile_updated:   { color: 'bg-yellow-100 text-yellow-700',   icon: School,     label: 'Profile Updated' },
  mcda_computed:            { color: 'bg-purple-100 text-purple-700',   icon: Calculator, label: 'MCDA Computed' },
}

const EMPTY_FILTERS = { action: '', username: '', date_from: '', date_to: '' }
const TABLE_HEADERS = ['Timestamp', 'User', 'Action', 'Model', 'Object ID', 'IP', 'Details']

export default function AuditLog() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, filters],
    queryFn: () =>
      auditService.getLogs({
        page,
        action: filters.action || undefined,
        username: filters.username || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      }).then((r) => r.data),
    keepPreviousData: true,
  })

  const logs = data?.results || []
  const totalPages = Math.ceil((data?.count || 0) / 20)

  // Update one filter and jump back to the first page of results.
  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const clearFilters = () => { setFilters(EMPTY_FILTERS); setPage(1) }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <p className="text-gray-500 text-sm mt-1">
          All system actions — {data?.count ?? '…'} records total
        </p>
      </div>

      <Filters filters={filters} onChange={setFilter} onClear={clearFilters} />

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <Message text="Loading logs…" muted />
        ) : logs.length === 0 ? (
          <Message text="No audit logs found." />
        ) : (
          <LogTable logs={logs} />
        )}

        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            count={data?.count}
            onPrev={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
          />
        )}
      </div>
    </div>
  )
}

// Filter bar
function Filters({ filters, onChange, onClear }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          className="input"
          placeholder="Filter by action…"
          value={filters.action}
          onChange={(e) => onChange('action', e.target.value)}
        />
        <input
          className="input"
          placeholder="Filter by username…"
          value={filters.username}
          onChange={(e) => onChange('username', e.target.value)}
        />
        <div>
          <label className="block text-xs text-gray-500 mb-1">From date</label>
          <input type="date" className="input w-full" value={filters.date_from} onChange={(e) => onChange('date_from', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To date</label>
          <input type="date" className="input w-full" value={filters.date_to} onChange={(e) => onChange('date_to', e.target.value)} />
        </div>
        <button onClick={onClear} className="btn-secondary text-sm self-end">Clear</button>
      </div>
    </div>
  )
}

// Table + one row
function LogTable({ logs }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            {TABLE_HEADERS.map((h) => (
              <th key={h} className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => <LogRow key={log.id} log={log} />)}
        </tbody>
      </table>
    </div>
  )
}

function LogRow({ log }) {
  const action = ACTIONS[log.action]
  const Icon = action?.icon

  return (
    <tr className="border-t border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">
        {new Date(log.timestamp).toLocaleString()}
      </td>
      <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200 text-xs">
        {log.username || <span className="text-gray-400">system</span>}
      </td>
      <td className="py-3 px-4">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${action?.color || 'bg-gray-100 text-gray-600'}`}>
          {Icon && <Icon size={12} />}
          {action?.label || log.action}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">{log.model_name || '—'}</td>
      <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400 font-mono">{log.object_id || '—'}</td>
      <td className="py-3 px-4 text-xs text-gray-400 font-mono">{log.ip_address || '—'}</td>
      <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">
        <Details details={log.details_json} />
      </td>
    </tr>
  )
}

// Collapsible JSON details for a log row (or a dash if empty).
function Details({ details }) {
  if (!details || Object.keys(details).length === 0) return '—'
  return (
    <details>
      <summary className="cursor-pointer text-blue-600 hover:text-blue-700">View</summary>
      <pre className="mt-1 text-xs bg-gray-50 dark:bg-gray-900 rounded p-2 whitespace-pre-wrap overflow-auto max-h-32">
        {JSON.stringify(details, null, 2)}
      </pre>
    </details>
  )
}

// Small shared bits
function Message({ text, muted }) {
  return (
    <div className={`text-center py-16 text-gray-400 text-sm ${muted ? 'animate-pulse' : ''}`}>{text}</div>
  )
}

function Pagination({ page, totalPages, count, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
      <span className="text-xs text-gray-500">Page {page} of {totalPages} ({count} records)</span>
      <div className="flex gap-2">
        <button disabled={page === 1} onClick={onPrev} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">Previous</button>
        <button disabled={page === totalPages} onClick={onNext} className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">Next</button>
      </div>
    </div>
  )
}
