import api from './api'

export const resourceRequestService = {
  getAll: (params = {}) => api.get('/schools/resource-requests/', { params }),

  // submit expects a FormData with { subject, letter } — multipart for the file
  submit: (formData) =>
    api.post('/schools/resource-requests/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  approve: (id, data = {}) => api.post(`/schools/resource-requests/${id}/approve/`, data),
  reject: (id, data) => api.post(`/schools/resource-requests/${id}/reject/`, data),
}
