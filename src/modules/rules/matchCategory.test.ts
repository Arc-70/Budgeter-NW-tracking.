import { describe, expect, it } from 'vitest'
import { matchCategory, type Rule } from './matchCategory'

const rules: Rule[] = [
  { id: '1', keyword: '7-Eleven', category_id: 'food' },
  { id: '2', keyword: 'bts', category_id: 'transport' },
  { id: '3', keyword: 'ข้าว', category_id: 'food' },
  { id: '4', keyword: 'grab', category_id: 'transport' },
  { id: '5', keyword: 'grab food', category_id: 'food' },
]

describe('matchCategory', () => {
  it('matches keywords anywhere in the text, ignoring case', () => {
    expect(matchCategory('snacks at 7-ELEVEN', rules)).toBe('food')
    expect(matchCategory('BTS to work', rules)).toBe('transport')
    expect(matchCategory('ข้าวมันไก่', rules)).toBe('food')
  })

  it('prefers the longest keyword when several match', () => {
    expect(matchCategory('Grab Food dinner', rules)).toBe('food')
    expect(matchCategory('grab home', rules)).toBe('transport')
  })

  it('returns nothing when no keyword matches', () => {
    expect(matchCategory('haircut', rules)).toBeNull()
    expect(matchCategory('', rules)).toBeNull()
  })
})
