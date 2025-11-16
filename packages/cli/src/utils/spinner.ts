/**
 * Progress spinner and indicator utility
 */

import ora from 'ora'
import chalk from 'chalk'

export class Spinner {
  private spinner = ora()

  /**
   * Start spinner with message
   */
  start(message: string = 'Loading...'): void {
    this.spinner = ora({
      text: message,
      color: 'blue',
      spinner: 'dots',
    }).start()
  }

  /**
   * Succeed with message
   */
  succeed(message: string = 'Done!'): void {
    this.spinner.succeed(message)
  }

  /**
   * Fail with message
   */
  fail(message: string = 'Failed!'): void {
    this.spinner.fail(message)
  }

  /**
   * Warn with message
   */
  warn(message: string = 'Warning!'): void {
    this.spinner.warn(message)
  }

  /**
   * Update spinner message
   */
  text(message: string): void {
    this.spinner.text = message
  }

  /**
   * Stop spinner
   */
  stop(): void {
    this.spinner.stop()
  }

  /**
   * Clear spinner
   */
  clear(): void {
    this.spinner.clear()
  }
}

/**
 * Progress bar for sequential operations
 */
export class ProgressBar {
  private current: number = 0
  private total: number
  private message: string

  constructor(total: number, message: string = 'Progress') {
    this.total = total
    this.message = message
  }

  /**
   * Increment progress
   */
  increment(step: number = 1): void {
    this.current = Math.min(this.current + step, this.total)
    this.render()
  }

  /**
   * Set current progress
   */
  set(current: number): void {
    this.current = Math.min(current, this.total)
    this.render()
  }

  /**
   * Complete progress
   */
  complete(): void {
    this.current = this.total
    this.render()
  }

  /**
   * Render progress bar
   */
  private render(): void {
    const percent = (this.current / this.total) * 100
    const filled = Math.floor((this.current / this.total) * 20)
    const empty = 20 - filled

    const bar = `[${'='.repeat(filled)}${' '.repeat(empty)}]`
    const percentage = `${percent.toFixed(0)}%`

    console.log(`\r${this.message} ${bar} ${percentage}`)
  }
}

/**
 * Task list with checkmarks
 */
export class TaskList {
  private tasks: Array<{
    name: string
    done: boolean
    error?: string
  }> = []

  /**
   * Add task
   */
  addTask(name: string): void {
    this.tasks.push({ name, done: false })
  }

  /**
   * Mark task as done
   */
  done(index: number, error?: string): void {
    if (this.tasks[index]) {
      this.tasks[index].done = true
      this.tasks[index].error = error
    }
  }

  /**
   * Mark all remaining tasks as done
   */
  doneAll(startIndex: number = 0): void {
    for (let i = startIndex; i < this.tasks.length; i++) {
      this.tasks[i].done = true
    }
  }

  /**
   * Get task count
   */
  count(): number {
    return this.tasks.length
  }

  /**
   * Get completed count
   */
  completed(): number {
    return this.tasks.filter(t => t.done).length
  }

  /**
   * Render task list
   */
  render(): void {
    for (const task of this.tasks) {
      const icon = task.done
        ? task.error ? chalk.red('✗') : chalk.green('✓')
        : chalk.gray('○')
      const message = task.error ? chalk.red(task.name) : task.name
      const error = task.error ? chalk.red(` (${task.error})`) : ''
      console.log(`${icon} ${message}${error}`)
    }
  }

  /**
   * Export summary
   */
  summary(): { total: number; completed: number; failed: number } {
    const failed = this.tasks.filter(t => t.error).length
    return {
      total: this.tasks.length,
      completed: this.completed(),
      failed,
    }
  }
}

// Export singleton instances
export const spinner = new Spinner()
