import api from './api'

export const fiscalBudgetService = {
  getAll: () => api.get('/allocation/fiscal-budgets/'),
  getActive: () => api.get('/allocation/fiscal-budgets/active/'),
  getBreakdown: (id) => api.get(`/allocation/fiscal-budgets/${id}/breakdown/`),
  create: (data) => api.post('/allocation/fiscal-budgets/', data),
  update: (id, data) => api.patch(`/allocation/fiscal-budgets/${id}/`, data),
  // Discretionary grants (from approved resource-request letters)
  getMyGrants: () => api.get('/allocation/fiscal-budgets/my-grants/'),
  disburseGrant: (grantId) =>
    api.post(`/allocation/fiscal-budgets/grants/${grantId}/disburse/`),
}
