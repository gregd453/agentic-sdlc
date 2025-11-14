import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('should navigate between all main pages', async ({ page }) => {
    await page.goto('/')

    // Start at Dashboard
    await expect(page.getByRole('heading', { name: 'Dashboard Overview' })).toBeVisible()

    // Navigate to Workflows
    await page.getByRole('link', { name: 'Workflows', exact: true }).click()
    await expect(page).toHaveURL('/workflows')
    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible()

    // Navigate to Traces
    await page.getByRole('link', { name: 'Traces' }).click()
    await expect(page).toHaveURL(/\/traces/)
    await expect(page.getByRole('heading', { name: 'Trace Visualization' })).toBeVisible({ timeout: 10000 })

    // Navigate to Agents
    await page.getByRole('link', { name: 'Agents' }).click()
    await expect(page).toHaveURL('/agents')
    await expect(page.getByRole('heading', { name: 'Agent Performance' })).toBeVisible()

    // Navigate back to Dashboard
    await page.getByRole('link', { name: 'Dashboard' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'Dashboard Overview' })).toBeVisible()
  })

  test('should highlight active navigation link', async ({ page }) => {
    await page.goto('/workflows')

    // Check that Workflows link has active styling
    const workflowsLink = page.getByRole('link', { name: 'Workflows', exact: true })
    await expect(workflowsLink).toHaveClass(/bg-primary-100/)
  })

  test('should handle 404 page', async ({ page }) => {
    await page.goto('/non-existent-page')

    // Should show 404 page
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
    await expect(page.getByText('Page not found')).toBeVisible()

    // Should have link back to dashboard
    await page.getByRole('link', { name: 'Go back to Dashboard' }).click()
    await expect(page).toHaveURL('/')
  })

  test('should display header on all pages', async ({ page }) => {
    const pages = ['/', '/workflows', '/agents']

    for (const url of pages) {
      await page.goto(url)
      await expect(page.getByRole('heading', { name: 'Agentic SDLC Dashboard' })).toBeVisible()
    }
  })
})
