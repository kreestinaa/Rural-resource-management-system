import api from './api'

export const verificationService = {
  getAll: (params = {}) => api.get('/schools/verification-requests/', { params }),
  submit: (data) => api.post('/schools/verification-requests/', data),
  approve: (id, data = {}) => api.post(`/schools/verification-requests/${id}/approve/`, data),
  reject: (id, data) => api.post(`/schools/verification-requests/${id}/reject/`, data),
}
