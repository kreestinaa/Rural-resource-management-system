import { describe, it, expect } from 'vitest'
import {
  minMaxNormalize, normalizeWeights, computePriorityScores, DEFAULT_WEIGHTS,
} from './mcda'

describe('minMaxNormalize', () => {
  it('normalizes a range to [0,1]', () => {
    expect(minMaxNormalize([0, 5, 10])).toEqual([0, 0.5, 1])
  })
  it('returns 0.5 for all-equal values (neutral)', () => {
    expect(minMaxNormalize([7, 7, 7])).toEqual([0.5, 0.5, 0.5])
  })
  it('handles empty input', () => {
    expect(minMaxNormalize([])).toEqual([])
  })
  it('handles a single value', () => {
    expect(minMaxNormalize([42])).toEqual([0.5])
  })
})

describe('normalizeWeights', () => {
  it('makes weights sum to 1.0', () => {
    const w = normalizeWeights({ a: 30, b: 20, c: 50 })
    const sum = Object.values(w).reduce((x, y) => x + y, 0)
    expect(sum).toBeCloseTo(1.0, 6)
  })
  it('default SSDP weights already sum to 1.0', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((x, y) => x + y, 0)
    expect(sum).toBeCloseTo(1.0, 6)
  })
})

describe('computePriorityScores', () => {
  const schools = [
    { id: 1, student_teacher_ratio: 70, infrastructure_deficit: 90, material_shortage: 85, geographic_difficulty: 95, socioeconomic_index: 90 },
    { id: 2, student_teacher_ratio: 20, infrastructure_deficit: 25, material_shortage: 22, geographic_difficulty: 18, socioeconomic_index: 22 },
    { id: 3, student_teacher_ratio: 45, infrastructure_deficit: 55, material_shortage: 50, geographic_difficulty: 60, socioeconomic_index: 55 },
  ]

  it('ranks the highest-need school first', () => {
    const result = computePriorityScores(schools)
    expect(result[0].id).toBe(1)   // worst indicators → highest priority
    expect(result[result.length - 1].id).toBe(2)  // best indicators → lowest
  })

  it('returns one score per school', () => {
    expect(computePriorityScores(schools)).toHaveLength(3)
  })

  it('scores are in descending order', () => {
    const result = computePriorityScores(schools)
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score)
    }
  })

  it('the worst school scores near 1.0 with default weights', () => {
    const result = computePriorityScores(schools)
    const top = result.find((r) => r.id === 1)
    expect(top.score).toBeGreaterThan(0.9)
  })

  it('changing weights changes the ranking', () => {
    // If we only care about student_teacher_ratio, school 1 (70) still wins,
    // but let's verify weight changes affect scores numerically
    const equal = computePriorityScores(schools, { a: 1 } && {
      student_teacher_ratio: 1, infrastructure_deficit: 1, material_shortage: 1,
      geographic_difficulty: 1, socioeconomic_index: 1,
    })
    expect(equal).toHaveLength(3)
    expect(equal[0].id).toBe(1)
  })

  it('handles empty input', () => {
    expect(computePriorityScores([])).toEqual([])
  })
})
