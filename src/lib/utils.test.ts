import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('keeps a font size and a custom token text colour together', () => {
    expect(cn('text-sm', 'text-success-foreground')).toBe('text-sm text-success-foreground')
    expect(cn('text-xs', 'text-warning-subtle-foreground')).toBe(
      'text-xs text-warning-subtle-foreground',
    )
  })

  it('lets the last conflicting utility win, including custom tokens', () => {
    expect(cn('bg-primary', 'bg-success-subtle')).toBe('bg-success-subtle')
    expect(cn('border-border', 'border-destructive')).toBe('border-destructive')
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('rounded-lg', 'rounded-md')).toBe('rounded-md')
  })

  it('drops falsy values', () => {
    expect(cn('h-8', false, undefined, null, 'w-4')).toBe('h-8 w-4')
  })
})
