/**
 * Test Service - Execute tests with tier-based organization
 * Supports unit, integration, E2E, and performance tests with parallel execution
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../utils/logger.js'

const execAsync = promisify(exec)

export interface TestResult {
  name: string
  tier: 1 | 2 | 3 | 4
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  output?: string
  error?: string
}

export interface TestRunResult {
  totalTests: number
  passed: number
  failed: number
  skipped: number
  duration: number
  results: TestResult[]
  coverage?: {
    lines: number
    statements: number
    functions: number
    branches: number
  }
}

export interface TestOptions {
  tier?: 1 | 2 | 3 | 4
  match?: string
  parallel?: boolean
  maxWorkers?: number
  timeout?: number
  coverage?: boolean
  watch?: boolean
}

export class TestService {
  private projectRoot: string
  private scriptsDir: string
  private testScriptsDir: string

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot
    this.scriptsDir = path.join(projectRoot, 'scripts')
    this.testScriptsDir = path.join(this.scriptsDir, 'tests')

    logger.debug('TestService initialized', {
      projectRoot: this.projectRoot,
      scriptsDir: this.scriptsDir,
      testScriptsDir: this.testScriptsDir,
    })
  }

  /**
   * Classify test script by tier based on naming convention
   * Tier 1: Unit tests (test-box-1 to test-box-15)
   * Tier 2: Integration tests (test-box-16 to test-box-30)
   * Tier 3: E2E tests (test-box-31 to test-box-40)
   * Tier 4: Performance tests (performance-*.sh)
   */
  private getTestTier(scriptName: string): 1 | 2 | 3 | 4 {
    if (scriptName.startsWith('performance-')) {
      return 4
    }

    const match = scriptName.match(/test-box-(\d+)/)
    if (!match) return 1

    const num = parseInt(match[1], 10)
    if (num <= 15) return 1
    if (num <= 30) return 2
    if (num <= 40) return 3
    return 4
  }

  /**
   * Discover all test scripts
   */
  private async discoverTests(): Promise<string[]> {
    try {
      if (!fs.existsSync(this.testScriptsDir)) {
        logger.warn('Test scripts directory does not exist', { dir: this.testScriptsDir })
        return []
      }

      const files = fs.readdirSync(this.testScriptsDir)
      const testScripts = files.filter((f) => f.endsWith('.sh')).sort()

      logger.debug('Discovered test scripts', { count: testScripts.length })
      return testScripts
    } catch (error) {
      logger.error('Failed to discover tests', (error as Error).message)
      throw error
    }
  }

  /**
   * Filter tests by tier and/or match pattern
   */
  private filterTests(
    scripts: string[],
    options: TestOptions
  ): string[] {
    let filtered = scripts

    // Filter by tier
    if (options.tier) {
      filtered = filtered.filter((script) => this.getTestTier(script) === options.tier)
    }

    // Filter by match pattern
    if (options.match) {
      const regex = new RegExp(options.match, 'i')
      filtered = filtered.filter((script) => regex.test(script))
    }

    return filtered
  }

  /**
   * Execute a single test script
   */
  private async executeTestScript(
    scriptName: string,
    timeout: number
  ): Promise<TestResult> {
    const scriptPath = path.join(this.testScriptsDir, scriptName)
    const startTime = Date.now()
    const tier = this.getTestTier(scriptName)

    try {
      // Make script executable
      fs.chmodSync(scriptPath, 0o755)

      // Execute with timeout
      const { stdout } = await execAsync(`bash "${scriptPath}"`, {
        cwd: this.projectRoot,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      })

      const duration = Date.now() - startTime

      logger.debug(`Test script passed: ${scriptName} (${duration}ms)`)

      return {
        name: scriptName,
        tier,
        status: 'passed',
        duration,
        output: stdout,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMsg = (error as Error).message

      // Check if it's a timeout
      if (errorMsg.includes('ETIMEDOUT')) {
        logger.warn('Test script timed out', {
          script: scriptName,
          timeout,
        })

        return {
          name: scriptName,
          tier,
          status: 'failed',
          duration,
          error: `Test timed out after ${timeout}ms`,
        }
      }

      logger.error(`Test script failed: ${scriptName} - ${errorMsg} (${duration}ms)`)

      return {
        name: scriptName,
        tier,
        status: 'failed',
        duration,
        error: errorMsg,
      }
    }
  }

  /**
   * Run vitest unit/integration tests
   */
  private async runVitest(
    options: TestOptions
  ): Promise<TestRunResult> {
    const startTime = Date.now()
    const args: string[] = ['run']

    if (options.match) {
      args.push('--grep', options.match)
    }

    if (options.coverage) {
      args.push('--coverage')
    }

    if (options.watch) {
      args.push('--watch')
    }

    try {
      const { stdout } = await execAsync(`pnpm vitest ${args.join(' ')}`, {
        cwd: this.projectRoot,
        timeout: options.timeout || 300000, // 5 minutes default
        maxBuffer: 10 * 1024 * 1024,
      })

      const duration = Date.now() - startTime

      // Parse vitest output for test counts
      // This is a simplified parsing - real implementation would parse JSON output
      const passedMatch = stdout.match(/✓.*?(\d+)/g)
      const failedMatch = stdout.match(/×.*?(\d+)/g)

      const passed = passedMatch ? passedMatch.length : 0
      const failed = failedMatch ? failedMatch.length : 0

      logger.info(`Vitest completed successfully: ${passed} passed, ${failed} failed, duration ${duration}ms`)

      return {
        totalTests: passed + failed,
        passed,
        failed,
        skipped: 0,
        duration,
        results: [],
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMsg = (error as Error).message

      logger.error(`Vitest failed: ${errorMsg} (${duration}ms)`)

      return {
        totalTests: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        results: [
          {
            name: 'vitest',
            tier: 1,
            status: 'failed',
            duration,
            error: errorMsg,
          },
        ],
      }
    }
  }

  /**
   * Run tests with specified options
   */
  async runTests(options: TestOptions = {}): Promise<TestRunResult> {
    logger.info('Starting test run', { options })

    const startTime = Date.now()
    const timeout = options.timeout || 60000 // 1 minute per test

    try {
      // Discover all test scripts
      const allTests = await this.discoverTests()

      if (allTests.length === 0) {
        logger.info('No test scripts found')
        return {
          totalTests: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: 0,
          results: [],
        }
      }

      // Filter tests
      const testsToRun = this.filterTests(allTests, options)

      if (testsToRun.length === 0) {
        logger.info('No tests matched filter criteria')
        return {
          totalTests: 0,
          passed: 0,
          failed: 0,
          skipped: allTests.length,
          duration: 0,
          results: allTests.map((name) => ({
            name,
            tier: this.getTestTier(name),
            status: 'skipped',
            duration: 0,
          })),
        }
      }

      // Execute tests
      let results: TestResult[]

      if (options.parallel) {
        // Run tests in parallel with max workers
        const maxWorkers = options.maxWorkers || 4
        results = await this.runTestsParallel(testsToRun, timeout, maxWorkers)
      } else {
        // Run tests sequentially
        results = await this.runTestsSequential(testsToRun, timeout)
      }

      // Aggregate results
      const passed = results.filter((r) => r.status === 'passed').length
      const failed = results.filter((r) => r.status === 'failed').length
      const skipped = results.filter((r) => r.status === 'skipped').length
      const totalDuration = Date.now() - startTime

      logger.info('Test run completed', {
        total: results.length,
        passed,
        failed,
        skipped,
        duration: totalDuration,
      })

      return {
        totalTests: results.length,
        passed,
        failed,
        skipped,
        duration: totalDuration,
        results,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error('Test run failed', (error as Error).message)

      return {
        totalTests: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        results: [
          {
            name: 'test-runner',
            tier: 1,
            status: 'failed',
            duration,
            error: (error as Error).message,
          },
        ],
      }
    }
  }

  /**
   * Run tests sequentially
   */
  private async runTestsSequential(
    scripts: string[],
    timeout: number
  ): Promise<TestResult[]> {
    const results: TestResult[] = []

    for (const script of scripts) {
      const result = await this.executeTestScript(script, timeout)
      results.push(result)
    }

    return results
  }

  /**
   * Run tests in parallel with concurrency limit
   */
  private async runTestsParallel(
    scripts: string[],
    timeout: number,
    maxWorkers: number
  ): Promise<TestResult[]> {
    const results: TestResult[] = []
    const executing: Promise<TestResult>[] = []

    for (const script of scripts) {
      // Start test execution
      const promise = this.executeTestScript(script, timeout).then((result) => {
        results.push(result)
        return result
      })

      executing.push(promise)

      // Limit concurrent executions
      if (executing.length >= maxWorkers) {
        await Promise.race(executing)
        executing.splice(
          executing.findIndex((p) => p === executing[0]),
          1
        )
      }
    }

    // Wait for all remaining tests
    await Promise.all(executing)

    return results
  }

  /**
   * Run specific test tier
   */
  async runTier(tier: 1 | 2 | 3 | 4, options?: Omit<TestOptions, 'tier'>): Promise<TestRunResult> {
    logger.info(`Running tier ${tier} tests`)
    return this.runTests({ ...options, tier })
  }

  /**
   * Run unit tests (Tier 1)
   */
  async runUnits(options?: Omit<TestOptions, 'tier'>): Promise<TestRunResult> {
    logger.info('Running unit tests')
    return this.runTier(1, options)
  }

  /**
   * Run integration tests (Tier 2)
   */
  async runIntegration(options?: Omit<TestOptions, 'tier'>): Promise<TestRunResult> {
    logger.info('Running integration tests')
    return this.runTier(2, options)
  }

  /**
   * Run E2E tests (Tier 3)
   */
  async runE2E(options?: Omit<TestOptions, 'tier'>): Promise<TestRunResult> {
    logger.info('Running E2E tests')
    return this.runTier(3, options)
  }

  /**
   * Run vitest tests with optional coverage
   */
  async runVitestTests(options: TestOptions = {}): Promise<TestRunResult> {
    logger.info('Running vitest tests')
    return this.runVitest(options)
  }
}
