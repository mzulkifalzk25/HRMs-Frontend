// Smoke test for the temporary placeholder page (replaced by the app shell in P1-T14).
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App placeholder', () => {
  it('renders the product heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'FormbaxHR' })).toBeInTheDocument()
  })

  it('renders shadcn buttons with accessible names, including the icon-only button', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /check in/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Add employee' })).toBeInTheDocument()
  })
})
