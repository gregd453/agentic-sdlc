import { test, expect } from '@playwright/test'

test.describe('Workflows Page', () => {
  test('should load workflows list page', async ({ page }) => {
    await page.goto('/workflows')

    // Check page title
    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible()

    // Check filters are present
    await expect(page.getByLabel('Status')).toBeVisible()
    await expect(page.getByLabel('Type')).toBeVisible()
  })

  test('should filter workflows by status', async ({ page }) => {
    await page.goto('/workflows')

    // Select "Running" status filter
    await page.getByLabel('Status').selectOption('running')

    // Wait for potential data refresh
    await page.waitForTimeout(500)

    // Verify filter is applied
    await expect(page.getByLabel('Status')).toHaveValue('running')
  })

  test('should filter workflows by type', async ({ page }) => {
    await page.goto('/workflows')

    // Select "Feature" type filter
    await page.getByLabel('Type').selectOption('feature')

    // Wait for potential data refresh
    await page.waitForTimeout(500)

    // Verify filter is applied
    await expect(page.getByLabel('Type')).toHaveValue('feature')
  })

  test('should display workflows table with correct columns', async ({ page }) => {
    await page.goto('/workflows')

    // Wait for table to appear (either with data or empty state)
    await page.locator('table').waitFor({ state: 'visible', timeout: 15000 })

    // Check all column headers are present
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Stage' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Progress' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Trace ID' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Created' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible()
  })
})
