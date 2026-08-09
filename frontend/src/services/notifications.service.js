import api from './api'

export const notificationsService = {
  getAll: (params = {}) => api.get('/notifications/', { params }),
  markRead: (ids = []) => api.post('/notifications/mark-read/', { ids }),
  broadcast: (data) => api.post('/notifications/broadcast/', data),
  getSent: () => api.get('/notifications/sent/'),
}
