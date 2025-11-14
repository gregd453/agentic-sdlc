import { test, expect } from '@playwright/test'

test.describe('Dashboard Overview', () => {
  test('should load dashboard page', async ({ page }) => {
    await page.goto('/')

    // Check title
    await expect(page.getByRole('heading', { name: 'Dashboard Overview' })).toBeVisible()

    // Check metric cards are present
    await expect(page.getByText('Total Workflows')).toBeVisible()
    await expect(page.getByText('Running')).toBeVisible()
    await expect(page.getByText('Completed')).toBeVisible()
    await expect(page.getByText('Failed')).toBeVisible()
  })

  test('should display active workflows table', async ({ page }) => {
    await page.goto('/')

    // Wait for the table to load
    await expect(page.getByRole('heading', { name: 'Active Workflows' })).toBeVisible()

    // Wait for table to appear (either with data or empty state)
    await page.locator('table').waitFor({ state: 'visible', timeout: 15000 })

    // Verify column headers
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Stage' })).toBeVisible()
  })

  test('should navigate to workflows page from header', async ({ page }) => {
    await page.goto('/')

    // Click Workflows link in navigation
    await page.getByRole('link', { name: 'Workflows' }).click()

    // Should navigate to workflows page
    await expect(page).toHaveURL('/workflows')
    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible()
  })
})
