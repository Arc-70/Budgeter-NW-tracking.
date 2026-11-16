import { describe, expect, it } from 'vitest'
import { usernameToEmail, validatePin, validateUsername } from './credentials'

describe('credentials', () => {
  it('accepts valid usernames and rejects bad ones', () => {
    expect(validateUsername('Arc_70')).toBeNull()
    expect(validateUsername('ab')).not.toBeNull()
    expect(validateUsername('has space')).not.toBeNull()
  })

  it('requires a 6 digit PIN', () => {
    expect(validatePin('123456')).toBeNull()
    expect(validatePin('12345')).not.toBeNull()
    expect(validatePin('12345a')).not.toBeNull()
  })

  it('maps usernames to a stable lowercase email', () => {
    expect(usernameToEmail('  Arc ')).toBe('arc@budgeter-nw.app')
  })
})
