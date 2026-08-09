import api from './api'

export const auditService = {
  getLogs: (params = {}) => api.get('/audit/logs/', { params }),
}
