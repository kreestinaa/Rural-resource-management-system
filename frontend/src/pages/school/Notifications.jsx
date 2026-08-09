import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsService } from '../../services/notifications.service'

const TYPE_STYLES = {
  allocation_result: { dot: 'bg-green-500', card: 'border-green-200 dark:border-green-800', badge: 'bg-green-100 text-green-700' },
  ranking_update: { dot: 'bg-blue-500', card: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-100 text-blue-700' },
  system_alert: { dot: 'bg-red-500', card: 'border-red-200 dark:border-red-800', badge: 'bg-red-100 text-red-700' },
  announcement: { dot: 'bg-gray-400', card: 'border-gray-200 dark:border-gray-700', badge: 'bg-gray-100 text-gray-600' },
}

const TYPE_ICONS = {
  allocation_result: '',
  ranking_update: '',
  system_alert: '',
  announcement: '',
}

export default function SchoolNotifications() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(null)   // notification opened in the modal

  const { data, isLoading } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: () => notificationsService.getAll().then((r) => r.data),
    refetchInterval: 15_000,        // poll every 15s — new notifications appear on their own
    refetchOnWindowFocus: true,     // and immediately when you come back to the tab
  })

  // Refresh both the list and the sidebar unread badge
  const refresh = () => {
    queryClient.invalidateQueries(['my-notifications'])
  }

  const markAllRead = useMutation({
    mutationFn: () => notificationsService.markRead([]),
    onSuccess: refresh,
  })

  const markOne = useMutation({
    mutationFn: (id) => notificationsService.markRead([id]),
    onSuccess: refresh,
  })

  const notifications = data?.results || []
  const unreadCount = data?.unread_count ?? 0

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-screen-lg mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 text-sm bg-blue-500 text-white rounded-full px-2 py-0.5 align-middle">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{notifications.length} total notifications</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 animate-pulse">Loading notifications…</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4"></div>
          <p className="text-gray-400">No notifications yet.</p>
          <p className="text-gray-300 text-sm mt-1">You'll be notified when allocation results are ready.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const styles = TYPE_STYLES[n.type] || TYPE_STYLES.announcement
            return (
              <div
                key={n.id}
                onClick={() => {
                  setSelected(n)
                  if (!n.is_read) markOne.mutate(n.id)
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelected(n)
                    if (!n.is_read) markOne.mutate(n.id)
                  }
                }}
                className={`bg-white dark:bg-gray-800 rounded-xl border-2 p-4 shadow-sm transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 ${
                  n.is_read
                    ? 'border-gray-100 dark:border-gray-700 opacity-75'
                    : styles.card
                }`}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="text-2xl">{TYPE_ICONS[n.type] || ''}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {!n.is_read && (
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} />
                        )}
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{n.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${styles.badge}`}>
                          {n.type.replace('_', ' ')}
                        </span>
                      </div>
                      {!n.is_read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markOne.mutate(n.id) }}
                          className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">Click to open →</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail modal — click a notification to open and read it in full */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-3xl flex-shrink-0">{TYPE_ICONS[selected.type] || ''}</span>
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-800 dark:text-gray-100 break-words">
                    {selected.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${(TYPE_STYLES[selected.type] || TYPE_STYLES.announcement).badge}`}>
                      {selected.type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(selected.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none flex-shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {selected.message}
              </p>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setSelected(null)}
                className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-xl py-2.5 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
