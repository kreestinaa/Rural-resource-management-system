import api from './api'

export const schoolsService = {
  getAll: (params = {}) => api.get('/schools/', { params }),
  getById: (id) => api.get(`/schools/${id}/`),
  create: (data) => api.post('/schools/', data),
  update: (id, data) => api.patch(`/schools/${id}/`, data),
  delete: (id) => api.delete(`/schools/${id}/`),
  getRankings: (params = {}) => api.get('/schools/rankings/', { params }),
  computeRankings: (weights = {}) => api.post('/schools/rankings/compute/', weights),
  getDistricts: (province) =>
    api.get('/schools/districts/', { params: province ? { province } : {} }),
  getStats: () => api.get('/schools/stats/'),
  getSensitivity: () => api.get('/schools/sensitivity/'),
  getHistory: (id) => api.get(`/schools/${id}/history/`),
  // School self-service
  getMyProfile: () => api.get('/schools/my-profile/'),
  updateMyProfile: (data) => api.put('/schools/my-profile/', data),
  requestReview: (note) => api.post('/schools/request-review/', { note }),
  getMyReviewRequests: () => api.get('/schools/my-review-requests/'),
  getAllReviewRequests: () => api.get('/schools/review-requests/'),
  // CSV import
  importCSV: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/schools/import-csv/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
