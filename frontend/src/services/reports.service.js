import api from './api'

export const reportsService = {
  downloadAllocationCSV: (cycleId) =>
    api.get(`/reports/allocation/${cycleId}/csv/`, { responseType: 'blob' }),
  downloadSchoolsCSV: () =>
    api.get('/reports/schools/csv/', { responseType: 'blob' }),
  getSummary: (cycleId) => api.get(`/reports/summary/${cycleId}/`),
}

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
