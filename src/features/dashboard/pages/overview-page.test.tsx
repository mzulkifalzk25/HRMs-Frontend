import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api'
import type { HealthService, HealthStatus } from '@/services/health/health.service'
import { renderWithProviders } from '@/test/render'
import { OverviewPage } from './overview-page'

function service(getStatus: HealthService['getStatus']): HealthService {
  return { getStatus }
}

const mockOk: HealthStatus = { status: 'ok', source: 'mock', checkedAt: '2026-11-25T04:15:00Z' }

describe('OverviewPage system status', () => {
  it('shows a loading state while the request is pending', () => {
    renderWithProviders(<OverviewPage health={service(() => new Promise(() => {}))} />)
    expect(screen.getByText('Loading system status…')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'System status' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })

  it('shows success with an honest source label and Pakistan time', async () => {
    renderWithProviders(<OverviewPage health={service(async () => mockOk)} />)
    expect(await screen.findByText('All systems operational')).toBeInTheDocument()
    expect(screen.getByText(/mock services \(fictional data\)/)).toBeInTheDocument()
    expect(screen.getByText(/25 Nov 2026, 9:15 AM \(Pakistan time\)/)).toBeInTheDocument()
  })

  it('labels a real API source as such', async () => {
    renderWithProviders(
      <OverviewPage
        health={service(async () => ({ ...mockOk, source: 'api', status: 'degraded' }))}
      />,
    )
    expect(await screen.findByText('Running with degraded service')).toBeInTheDocument()
    expect(screen.getByText(/FormbaxHR API/)).toBeInTheDocument()
  })

  it('shows the API error message and recovers on retry', async () => {
    const getStatus = vi
      .fn<HealthService['getStatus']>()
      .mockRejectedValueOnce(
        new ApiError({ status: 0, code: 'network_error', message: 'Cannot reach the server.' }),
      )
      .mockResolvedValueOnce(mockOk)
    renderWithProviders(<OverviewPage health={service(getStatus)} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('All systems operational')).toBeInTheDocument()
    expect(getStatus).toHaveBeenCalledTimes(2)
  })

  it('never shows internal messages of unexpected errors', async () => {
    renderWithProviders(
      <OverviewPage
        health={service(async () => {
          throw new TypeError("Cannot read properties of undefined (reading 'status')")
        })}
      />,
    )
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong. Please try again.')
    expect(alert).not.toHaveTextContent('undefined')
  })
})
