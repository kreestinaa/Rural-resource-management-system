/**
 * Client-side MCDA helpers - mirror the backend MCDAEngine so the frontend
 * (Sensitivity page, Rank Simulator) can preview scores without a round-trip.
 * Kept in sync with backend/schools/algorithms/mcda.py.
 */

export const DEFAULT_WEIGHTS = {
  student_teacher_ratio: 0.30,
  infrastructure_deficit: 0.25,
  material_shortage: 0.20,
  geographic_difficulty: 0.15,
  socioeconomic_index: 0.10,
}

// Min-Max normalize a list of numbers to [0,1]. All-equal -> 0.5 (neutral).
export function minMaxNormalize(values) {
  if (!values || values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min

  const result = []
  if (range === 0) {
    for (let i = 0; i < values.length; i++) result.push(0.5)
    return result
  }
  for (let i = 0; i < values.length; i++) {
    result.push((values[i] - min) / range)
  }
  return result
}

// Normalize a weights object so its values sum to 1.0.
export function normalizeWeights(weights) {
  const keys = Object.keys(weights)
  let total = 0
  for (const k of keys) total += weights[k]
  if (total <= 0) return weights
  const out = {}
  for (const k of keys) out[k] = weights[k] / total
  return out
}

// Compute MCDA priority scores. Returns [{id, score}] sorted by score desc.
export function computePriorityScores(schools, weights = DEFAULT_WEIGHTS) {
  if (!schools || schools.length === 0) return []
  const w = normalizeWeights(weights)
  const criteria = Object.keys(w)

  // normalize each indicator column
  const normalized = {}
  for (const c of criteria) {
    const column = []
    for (let i = 0; i < schools.length; i++) column.push(schools[i][c])
    normalized[c] = minMaxNormalize(column)
  }

  // weighted sum per school
  const results = []
  for (let i = 0; i < schools.length; i++) {
    let score = 0
    for (const c of criteria) score += w[c] * normalized[c][i]
    results.push({ id: schools[i].id, score: Math.round(score * 1e6) / 1e6 })
  }

  results.sort((a, b) => b.score - a.score)
  return results
}
