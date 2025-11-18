/**
 * Output formatter - handles different output formats (JSON, YAML, text/table)
 */

import chalk from 'chalk'
import { table } from 'table'
import { CommandResult } from '../types/index'

type OutputFormat = 'json' | 'yaml' | 'text' | 'table'

export class OutputFormatter {
  private format: OutputFormat = 'text'
  private colors: boolean = true

  constructor(format: OutputFormat = 'text', colors: boolean = true) {
    this.format = format
    this.colors = colors
  }

  /**
   * Format and output a command result
   */
  output(result: CommandResult, options?: { format?: OutputFormat }) {
    const format = options?.format || this.format

    switch (format) {
      case 'json':
        return this.outputJSON(result)
      case 'yaml':
        return this.outputYAML(result)
      case 'table':
        return this.outputTable(result)
      case 'text':
      default:
        return this.outputText(result)
    }
  }

  /**
   * Format as JSON
   */
  private outputJSON(result: CommandResult): string {
    return JSON.stringify(result, null, 2)
  }

  /**
   * Format as YAML
   */
  private outputYAML(result: CommandResult): string {
    return this.toYAML(result)
  }

  /**
   * Format as plain text with colors
   */
  private outputText(result: CommandResult): string {
    let output = ''

    if (result.success) {
      output += this.colors ? chalk.green('✅ Success') : '✅ Success'
    } else {
      output += this.colors ? chalk.red('❌ Failed') : '❌ Failed'
    }

    output += '\n'

    if (result.message) {
      output += this.colors
        ? chalk.gray(result.message)
        : result.message
      output += '\n'
    }

    if (result.data) {
      output += '\n'
      output += JSON.stringify(result.data, null, 2)
    }

    if (result.error && !result.success) {
      output += '\n'
      output += this.colors
        ? chalk.red(`Error: ${String(result.error)}`)
        : `Error: ${String(result.error)}`
    }

    if (result.duration !== undefined) {
      output += '\n'
      output += this.colors
        ? chalk.gray(`(${result.duration}ms)`)
        : `(${result.duration}ms)`
    }

    return output
  }

  /**
   * Format as ASCII table
   */
  private outputTable(result: CommandResult): string {
    if (!result.data || typeof result.data !== 'object') {
      return this.outputText(result)
    }

    const data = result.data as Record<string, unknown>
    const headers = Object.keys(data)
    const rows = [headers]

    // Convert data to table rows
    const values = Object.values(data)
    if (Array.isArray(values[0])) {
      const arrays = values as unknown[][]
      const maxLength = Math.max(...arrays.map(a => a.length || 0))
      for (let i = 0; i < maxLength; i++) {
        const row = arrays.map(a => String(a?.[i] ?? ''))
        rows.push(row)
      }
    } else {
      rows.push(values.map(v => String(v)))
    }

    return table(rows)
  }

  /**
   * Convert object to YAML string
   */
  private toYAML(obj: unknown, indent: number = 0): string {
    const spaces = ' '.repeat(indent)

    if (obj === null || obj === undefined) {
      return `${spaces}null`
    }

    if (typeof obj === 'string') {
      return `${spaces}'${obj}'`
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return `${spaces}${obj}`
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return `${spaces}[]`
      return obj
        .map((item, i) => {
          const isFirst = i === 0
          const content = this.toYAML(item, 0)
          return `${isFirst ? spaces : spaces.slice(0, -2)}- ${content.trim()}`
        })
        .join('\n')
    }

    if (typeof obj === 'object') {
      const pairs = Object.entries(obj).map(([key, value]) => {
        const content = this.toYAML(value, indent + 2)
        return `${spaces}${key}: ${content.trim()}`
      })
      return pairs.join('\n')
    }

    return String(obj)
  }

  /**
   * Format an error message
   */
  formatError(message: string, error?: Error | string): string {
    let output = this.colors ? chalk.red(`❌ ${message}`) : `❌ ${message}`

    if (error) {
      output += '\n'
      const errorMsg = typeof error === 'string' ? error : error.message
      output += this.colors ? chalk.gray(errorMsg) : errorMsg
    }

    return output
  }

  /**
   * Format a success message
   */
  formatSuccess(message: string): string {
    return this.colors ? chalk.green(`✅ ${message}`) : `✅ ${message}`
  }

  /**
   * Format a warning message
   */
  formatWarning(message: string): string {
    return this.colors ? chalk.yellow(`⚠️ ${message}`) : `⚠️ ${message}`
  }

  /**
   * Format an info message
   */
  formatInfo(message: string): string {
    return this.colors ? chalk.blue(`ℹ️  ${message}`) : `ℹ️  ${message}`
  }

  /**
   * Format a status list
   */
  formatStatusList(items: Array<{ name: string; status: string; message?: string }>): string {
    let output = ''

    for (const item of items) {
      const statusIcon =
        item.status === WORKFLOW_STATUS.RUNNING
          ? this.colors ? chalk.green('✓') : '✓'
          : item.status === 'stopped'
            ? this.colors ? chalk.red('✗') : '✗'
            : this.colors ? chalk.yellow('⚠') : '⚠'

      output += `${statusIcon} ${item.name}`

      if (item.message) {
        output += this.colors
          ? ` ${chalk.gray(`(${item.message}`)}`
          : ` (${item.message})`
      }

      output += '\n'
    }

    return output
  }

  /**
   * Escape special characters for output
   */
  escapeOutput(str: string): string {
    return str.replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI color codes
  }

  /**
   * Create a simple table from array of objects
   */
  formatObjectsAsTable<T extends Record<string, unknown>>(
    objects: T[],
    columns?: (keyof T)[]
  ): string {
    if (objects.length === 0) {
      return 'No items'
    }

    const cols = columns || (Object.keys(objects[0]) as (keyof T)[])
    const rows = [cols.map(c => String(c))]

    for (const obj of objects) {
      rows.push(cols.map(col => String(obj[col] ?? '')))
    }

    return table(rows)
  }
}

// Export singleton instance
export const formatter = new OutputFormatter()
