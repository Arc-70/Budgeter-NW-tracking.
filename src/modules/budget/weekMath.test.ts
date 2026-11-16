import { describe, expect, it } from 'vitest'
import { daysBetween, limitStatus, weekStartOf } from './weekMath'

describe('weekStartOf', () => {
  it('finds the start of the week for any starting weekday', () => {
    expect(weekStartOf('2026-11-18', 1)).toBe('2026-11-16') // Monday weeks
    expect(weekStartOf('2026-11-16', 1)).toBe('2026-11-16')
    expect(weekStartOf('2026-11-18', 5)).toBe('2026-11-13') // Friday weeks
  })
})

describe('daysBetween', () => {
  it('counts days across a month end', () => {
    expect(daysBetween('2026-11-28', '2026-12-01')).toBe(3)
  })
})

describe('limitStatus', () => {
  it('warns near the limit and flags going over', () => {
    expect(limitStatus(100, 500)).toBe('ok')
    expect(limitStatus(450, 500)).toBe('near')
    expect(limitStatus(700, 500)).toBe('over')
    expect(limitStatus(700, null)).toBe('ok')
  })
})
