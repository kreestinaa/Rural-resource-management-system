import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsService } from '../../services/notifications.service'

const TYPE_COLORS = {
  allocation_result: 'bg-green-100 text-green-700',
  ranking_update: 'bg-blue-100 text-blue-700',
  system_alert: 'bg-red-100 text-red-700',
  announcement: 'bg-gray-100 text-gray-600',
}

const TYPE_OPTIONS = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'allocation_result', label: 'Allocation Result' },
  { value: 'ranking_update', label: 'Ranking Update' },
  { value: 'system_alert', label: 'System Alert' },
]

export default function AdminNotifications() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ title: '', message: '', type: 'announcement' })
  const [sent, setSent] = useState(false)

  const { data: myNotifs } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: () => notificationsService.getAll().then((r) => r.data),
  })

  const { data: sentData } = useQuery({
    queryKey: ['sent-notifications'],
    queryFn: () => notificationsService.getSent().then((r) => r.data),
  })

  const broadcastMutation = useMutation({
    mutationFn: notificationsService.broadcast,
    onSuccess: () => {
      setSent(true)
      setForm({ title: '', message: '', type: 'announcement' })
      queryClient.invalidateQueries(['sent-notifications'])
      setTimeout(() => setSent(false), 4000)
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => notificationsService.markRead([]),
    onSuccess: () => queryClient.invalidateQueries(['my-notifications']),
  })

  const unreadCount = myNotifs?.unread_count ?? 0

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 text-sm bg-red-500 text-white rounded-full px-2 py-0.5 align-middle">
              {unreadCount}
            </span>
          )}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Broadcast announcements to all school users</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Broadcast Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">📢 Broadcast Announcement</h2>

          {sent && (
            <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-2 mb-4">
              ✅ Broadcast sent successfully!
            </div>
          )}

          {broadcastMutation.isError && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">
              {broadcastMutation.error?.response?.data?.error || 'Failed to send broadcast.'}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notification Type</label>
              <select
                className="input w-full"
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              >
                {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Title *</label>
              <input
                className="input w-full"
                placeholder="e.g. Budget Cycle 2081/82 Results Released"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Message *</label>
              <textarea
                className="input w-full h-28 resize-none"
                placeholder="Write your announcement here…"
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              />
            </div>
            <button
              onClick={() => broadcastMutation.mutate(form)}
              disabled={broadcastMutation.isPending || !form.title || !form.message}
              className="btn-primary w-full disabled:opacity-50"
            >
              {broadcastMutation.isPending ? 'Sending…' : '📢 Send to All School Users'}
            </button>
          </div>
        </div>

        {/* My Notifications */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200">My Notifications</h2>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(myNotifs?.results || []).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No notifications yet.</p>
            ) : (
              (myNotifs?.results || []).map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    n.is_read
                      ? 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'
                      : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{n.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[n.type] || 'bg-gray-100 text-gray-600'}`}>
                          {n.type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sent Broadcasts Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Sent Broadcasts History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                {['Title', 'Type', 'Recipients', 'Sent At'].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(sentData?.results || []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-400 text-sm">No broadcasts sent yet.</td>
                </tr>
              ) : (
                (sentData?.results || []).map((n, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-2 px-3 font-medium text-gray-800 dark:text-gray-200 max-w-[280px] truncate">{n.title}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[n.type] || 'bg-gray-100 text-gray-600'}`}>
                        {n.type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{n.recipient_count}</td>
                    <td className="py-2 px-3 text-gray-500 dark:text-gray-400 text-xs">
                      {new Date(n.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
