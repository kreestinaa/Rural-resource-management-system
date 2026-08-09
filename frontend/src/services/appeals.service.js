import api from './api'

export const appealsService = {
  getAll: (params = {}) => api.get('/schools/appeals/', { params }),
  submit: (data) => api.post('/schools/appeals/', data),
  markUnderReview: (id) => api.post(`/schools/appeals/${id}/mark_under_review/`),
  accept: (id, data) => api.post(`/schools/appeals/${id}/accept/`, data),
  reject: (id, data) => api.post(`/schools/appeals/${id}/reject/`, data),
}
