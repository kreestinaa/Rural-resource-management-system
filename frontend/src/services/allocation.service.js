import api from './api'

export const allocationService = {
  runAllocation: (data) => api.post('/allocation/cycles/run/', data),
  getCycles: (params = {}) => api.get('/allocation/cycles/', { params }),
  getCycle: (id) => api.get(`/allocation/cycles/${id}/`),
  getResults: (id, params = {}) =>
    api.get(`/allocation/cycles/${id}/results/`, { params }),
  getCycleResults: (id, params = {}) =>
    api.get(`/allocation/cycles/${id}/results/`, { params }),
  compareCycles: (ids) =>
    api.get('/allocation/cycles/compare/', { params: { ids: ids.join(',') } }),
  disburseResult: (resultId) =>
    api.post(`/allocation/results/${resultId}/disburse/`),
  getDisbursementSummary: (cycleId) =>
    api.get('/allocation/results/disbursement_summary/', {
      params: cycleId ? { cycle: cycleId } : {},
    }),
  getCycleResultsForDisbursement: (cycleId) =>
    api.get(`/allocation/cycles/${cycleId}/results/`, { params: { page_size: 500 } }),
}
