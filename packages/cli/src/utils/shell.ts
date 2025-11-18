/**
 * Shell command execution utility
 */

import { exec, execSync, spawn } from 'child_process'
import { promisify } from 'util'
import { logger } from './logger.js'

const execAsync = promisify(exec)

export interface ExecOptions {
  cwd?: string
  env?: Record<string, string>
  timeout?: number
  verbose?: boolean
  ignoreErrors?: boolean
}

export interface ExecResult {
  code: number
  stdout: string
  stderr: string
  success: boolean
}

export class ShellExecutor {
  /**
   * Execute a command asynchronously
   */
  async exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
    const { cwd = process.cwd(), env, timeout = 30000, verbose = false } = options

    if (verbose) {
      logger.debug(`Executing: ${command}`, { cwd, timeout })
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        env: { ...process.env, ...env },
        timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB
      })

      return {
        code: 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: true,
      }
    } catch (error: unknown) {
      const err = error as { code?: number; stdout?: string; stderr?: string }

      return {
        code: err.code || 1,
        stdout: (err.stdout || '').toString().trim(),
        stderr: (err.stderr || '').toString().trim(),
        success: false,
      }
    }
  }

  /**
   * Execute a command synchronously
   */
  execSync(command: string, options: ExecOptions = {}): ExecResult {
    const { cwd = process.cwd(), env, timeout = 30000, verbose = false } = options

    if (verbose) {
      logger.debug(`Executing (sync): ${command}`, { cwd, timeout })
    }

    try {
      const output = execSync(command, {
        cwd,
        env: { ...process.env, ...env },
        timeout,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10, // 10MB
      })

      return {
        code: 0,
        stdout: output.trim(),
        stderr: '',
        success: true,
      }
    } catch (error: unknown) {
      const err = error as { code?: number; stdout?: string; stderr?: string; message?: string }

      return {
        code: err.code || 1,
        stdout: (err.stdout || '').toString().trim(),
        stderr: (err.stderr || err.message || '').toString().trim(),
        success: false,
      }
    }
  }

  /**
   * Stream command output
   */
  stream(
    command: string,
    args: string[] = [],
    options: ExecOptions = {}
  ): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      const { cwd = process.cwd(), env, verbose = false } = options

      if (verbose) {
        logger.debug(`Streaming: ${command} ${args.join(' ')}`, { cwd })
      }

      const proc = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: 'inherit',
      })

      let stdout = ''
      let stderr = ''

      if (proc.stdout) {
        proc.stdout.on('data', data => {
          stdout += data.toString()
        })
      }

      if (proc.stderr) {
        proc.stderr.on('data', data => {
          stderr += data.toString()
        })
      }

      proc.on(LOG_LEVEL.ERROR, error => {
        reject(error)
      })

      proc.on('close', code => {
        resolve({
          code: code || 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: code === 0,
        })
      })
    })
  }

  /**
   * Run a shell command with pipes
   */
  async pipe(commands: string[], options: ExecOptions = {}): Promise<ExecResult> {
    const piped = commands.join(' | ')
    return this.exec(piped, options)
  }

  /**
   * Check if a command exists
   */
  commandExists(command: string): boolean {
    try {
      const result = this.execSync(`which ${command}`)
      return result.success
    } catch {
      return false
    }
  }

  /**
   * Get command output
   */
  async getOutput(command: string, options: ExecOptions = {}): Promise<string> {
    const result = await this.exec(command, options)
    return result.stdout
  }

  /**
   * Run multiple commands in sequence
   */
  async sequence(commands: string[], options: ExecOptions = {}): Promise<ExecResult[]> {
    const results: ExecResult[] = []

    for (const command of commands) {
      const result = await this.exec(command, options)
      results.push(result)

      if (!result.success && !options.ignoreErrors) {
        break
      }
    }

    return results
  }
}

// Export singleton instance
export const shell = new ShellExecutor()
