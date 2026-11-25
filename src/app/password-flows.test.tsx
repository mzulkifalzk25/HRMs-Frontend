// Forgot / reset password and invitation flows against the mock service (P2-T05, P2-T06).
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MOCK_INVITED_EMAIL, MOCK_TOKENS } from '@/features/authentication/api/auth.mock'
import { renderApp } from '@/test/render'

async function choosePassword(password: string, confirm = password) {
  await userEvent.type(await screen.findByLabelText('New password'), password)
  await userEvent.type(screen.getByLabelText('Confirm new password'), confirm)
}

describe('forgot password', () => {
  it('shows the same confirmation for any email (no account enumeration)', async () => {
    await renderApp('/forgot-password')
    await userEvent.type(await screen.findByLabelText('Email'), 'nobody@formbaxhr.test')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If an account exists for that email address',
    )
    expect(screen.getByRole('link', { name: 'Valid reset link' })).toHaveAttribute(
      'href',
      `/reset-password?token=${MOCK_TOKENS.resetValid}`,
    )
  })

  it('validates the email first', async () => {
    await renderApp('/forgot-password')
    await userEvent.type(await screen.findByLabelText('Email'), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
  })
})

describe('reset password', () => {
  it.each([
    ['missing token', '/reset-password', 'This link is incomplete'],
    ['expired token', `/reset-password?token=${MOCK_TOKENS.resetExpired}`, 'This link has expired'],
    ['invalid token', '/reset-password?token=garbage', 'This link is not valid'],
  ])('explains a %s and offers a new link', async (_label, path, title) => {
    await renderApp(path)
    expect(await screen.findByRole('alert')).toHaveTextContent(title)
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('enforces the password rules and that both entries match', async () => {
    await renderApp(`/reset-password?token=${MOCK_TOKENS.resetValid}`)
    await choosePassword('1234567', '7654321')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText(/At least 8 characters\./)).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Password requirements' })).toHaveTextContent(/not met/)
  })

  it('changes the password, after which the new password signs in', async () => {
    const { authService } = await renderApp(`/reset-password?token=${MOCK_TOKENS.resetValid}`)
    await choosePassword('Brand new pass 9')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByRole('heading', { name: 'Password changed' })).toBeInTheDocument()
    await expect(
      authService.login({ email: 'employee@formbaxhr.test', password: 'Brand new pass 9' }),
    ).resolves.toBeTruthy()
  })
})

describe('accept invitation', () => {
  it('shows the invited account and activates it', async () => {
    const { authService } = await renderApp(`/invite?token=${MOCK_TOKENS.inviteValid}`)
    expect(await screen.findByText(MOCK_INVITED_EMAIL)).toBeInTheDocument()
    await choosePassword('First pass 2026')
    await userEvent.click(screen.getByRole('button', { name: 'Activate account' }))
    expect(
      await screen.findByRole('heading', { name: 'Your account is ready' }),
    ).toBeInTheDocument()
    await expect(
      authService.login({ email: MOCK_INVITED_EMAIL, password: 'First pass 2026' }),
    ).resolves.toBeTruthy()
  })

  it.each([
    ['used', MOCK_TOKENS.inviteUsed, 'This link was already used'],
    ['expired', MOCK_TOKENS.inviteExpired, 'This link has expired'],
    ['invalid', 'garbage', 'This link is not valid'],
  ])('explains a %s invitation and points to HR', async (_label, token, title) => {
    await renderApp(`/invite?token=${token}`)
    expect(await screen.findByRole('alert')).toHaveTextContent(title)
    expect(
      screen.getByText('Ask your HR administrator to send you a new invitation.'),
    ).toBeInTheDocument()
  })
})
