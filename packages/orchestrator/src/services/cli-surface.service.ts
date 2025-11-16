/**
 * CLI Surface Service - Handles command-line interface workflow submission
 *
 * Responsibilities:
 * - Accept CLI commands and arguments
 * - Validate CLI input format
 * - Support offline execution mode
 * - Provide CLI-specific output formatting
 */

import { SurfaceRouterService, SurfaceRequest } from './surface-router.service'
import { logger } from '../utils/logger'

export interface CliCommand {
  command: string
  args: string[]
  flags: Record<string, string | boolean>
  cwd?: string
  env?: Record<string, string>
}

export interface CliResult {
  success: boolean
  workflow_id?: string
  message: string
  output?: string
}

export interface CliConfig {
  offline_mode?: boolean
  allow_local_cache?: boolean
  max_output_lines?: number
}

export class CliSurfaceService {
  private router: SurfaceRouterService
  private config: CliConfig
  private localCache: Map<string, any> = new Map()

  constructor(surfaceRouter: SurfaceRouterService, config?: CliConfig) {
    this.router = surfaceRouter
    this.config = {
      offline_mode: false,
      allow_local_cache: true,
      max_output_lines: 1000,
      ...config
    }

    logger.info('[CliSurface] Service initialized', {
      offline_mode: this.config.offline_mode,
      allow_local_cache: this.config.allow_local_cache
    })
  }

  /**
   * Handle CLI command
   */
  async handleCommand(command: CliCommand): Promise<CliResult> {
    const startTime = Date.now()

    logger.info('[CliSurface] Handling CLI command', {
      command: command.command,
      args_count: command.args.length,
      flags_count: Object.keys(command.flags).length
    })

    try {
      // Parse CLI command
      const parsed = this.parseCommand(command)

      // Check for help/info commands
      if (parsed.action === 'help' || command.flags.help) {
        return this.showHelp(parsed.subcommand)
      }

      if (parsed.action === 'version' || command.flags.version) {
        return this.showVersion()
      }

      // Validate command
      const validation = this.validateCommand(parsed)
      if (!validation.valid) {
        return {
          success: false,
          message: `Invalid command: ${validation.errors.join(', ')}`
        }
      }

      // Check offline mode
      if (this.config.offline_mode) {
        return this.handleOfflineCommand(parsed, command)
      }

      // Handle command based on type
      switch (parsed.action) {
        case 'workflow:create':
          return await this.createWorkflow(parsed, command)
        case 'workflow:list':
          return await this.listWorkflows(parsed, command)
        case 'workflow:status':
          return await this.getWorkflowStatus(parsed, command)
        case 'platform:list':
          return await this.listPlatforms(parsed, command)
        default:
          return { success: false, message: `Unknown command: ${parsed.action}` }
      }
    } catch (error) {
      logger.error('[CliSurface] Command handling failed', {
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Command execution failed'
      }
    }
  }

  /**
   * Create workflow via CLI
   */
  private async createWorkflow(
    parsed: any,
    command: CliCommand
  ): Promise<CliResult> {
    logger.info('[CliSurface] Creating workflow from CLI')

    try {
      // Extract workflow parameters from args and flags
      const workflowType = parsed.args[0] || command.flags.type || 'app'
      const workflowName = parsed.args[1] || command.flags.name || 'CLI Workflow'
      const description = command.flags.description as string || undefined
      const platform = command.flags.platform as string || undefined

      // Validate workflow type
      if (!['app', 'feature', 'bugfix'].includes(workflowType as string)) {
        return {
          success: false,
          message: `Invalid workflow type: ${workflowType}. Use: app, feature, bugfix`
        }
      }

      // Create surface request
      const surfaceRequest: SurfaceRequest = {
        surface_type: 'CLI',
        platform_id: platform,
        payload: {
          type: workflowType,
          name: workflowName,
          description,
          priority: (command.flags.priority as string) || 'medium',
          cli_command: command.command,
          cli_flags: this.flagsToRecord(command.flags),
          cwd: command.cwd
        },
        metadata: {
          timestamp: new Date().toISOString()
        }
      }

      // Route through surface router
      const context = await this.router.routeRequest(surfaceRequest)

      return {
        success: true,
        workflow_id: context.surface_id,
        message: `Workflow created successfully`,
        output: `
✓ Workflow ID: ${context.surface_id}
✓ Type: ${workflowType}
✓ Name: ${workflowName}
✓ Platform: ${platform || 'legacy'}
✓ Status: Submitted

Run 'sdlc workflow:status ${context.surface_id}' to check progress.
        `.trim()
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create workflow'
      }
    }
  }

  /**
   * List workflows via CLI
   */
  private async listWorkflows(parsed: any, command: CliCommand): Promise<CliResult> {
    logger.info('[CliSurface] Listing workflows from CLI')

    // TODO: Implement actual workflow listing
    return {
      success: true,
      message: 'Workflow listing endpoint ready for implementation',
      output: `
Workflows (local cache):
  No workflows found

Run 'sdlc workflow:create' to create a new workflow.
      `.trim()
    }
  }

  /**
   * Get workflow status via CLI
   */
  private async getWorkflowStatus(parsed: any, command: CliCommand): Promise<CliResult> {
    const workflowId = parsed.args[0]

    if (!workflowId) {
      return {
        success: false,
        message: 'Workflow ID required. Usage: sdlc workflow:status <workflow-id>'
      }
    }

    logger.info('[CliSurface] Getting workflow status', { workflow_id: workflowId })

    // TODO: Implement actual status retrieval
    return {
      success: true,
      message: 'Workflow status endpoint ready for implementation',
      output: `
Workflow: ${workflowId}
Status: pending
Current Stage: initialization
Progress: 0%

Last Updated: ${new Date().toISOString()}
      `.trim()
    }
  }

  /**
   * List platforms via CLI
   */
  private async listPlatforms(parsed: any, command: CliCommand): Promise<CliResult> {
    logger.info('[CliSurface] Listing platforms from CLI')

    // TODO: Implement actual platform listing
    return {
      success: true,
      message: 'Platform listing endpoint ready for implementation',
      output: `
Available Platforms:
  legacy          - Legacy platform (app, feature, bugfix)
  web-apps        - Web application platform (disabled)
  data-pipelines  - Data engineering platform (disabled)
  infrastructure  - Infrastructure automation (disabled)

Use 'sdlc workflow:create --platform <name>' to target a specific platform.
      `.trim()
    }
  }

  /**
   * Handle offline mode command
   */
  private async handleOfflineCommand(parsed: any, command: CliCommand): Promise<CliResult> {
    logger.info('[CliSurface] Handling offline command')

    if (parsed.action === 'workflow:create') {
      // In offline mode, just cache the workflow locally
      const workflowId = `offline-${Date.now()}`
      this.localCache.set(workflowId, {
        ...parsed,
        created_at: new Date().toISOString()
      })

      return {
        success: true,
        workflow_id: workflowId,
        message: 'Workflow cached locally for offline sync',
        output: `
✓ Offline Mode: Workflow cached
✓ ID: ${workflowId}
✓ Local cache entries: ${this.localCache.size}

When online, run 'sdlc sync' to submit all cached workflows.
        `.trim()
      }
    }

    return {
      success: false,
      message: 'This command is not available in offline mode'
    }
  }

  /**
   * Parse CLI command
   */
  private parseCommand(
    command: CliCommand
  ): {
    action: string
    subcommand?: string
    args: string[]
  } {
    // Parse command: "workflow:create" format
    const action = command.command
    const subcommand = command.args[0]
    const args = command.args.slice(1)

    return { action, subcommand, args }
  }

  /**
   * Validate command structure
   */
  private validateCommand(parsed: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!parsed.action) {
      errors.push('action is required')
    }

    const validActions = [
      'workflow:create',
      'workflow:list',
      'workflow:status',
      'platform:list',
      'help',
      'version'
    ]

    if (!validActions.includes(parsed.action)) {
      errors.push(`invalid action: ${parsed.action}`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Show help message
   */
  private showHelp(subcommand?: string): CliResult {
    const help = `
Agentic SDLC Command-Line Interface

Usage: sdlc <command> [args] [options]

Commands:
  workflow:create [type] [name]   Create a new workflow
  workflow:list                   List all workflows
  workflow:status <id>            Get workflow status
  platform:list                   List available platforms
  help                            Show this help message
  version                         Show version

Workflow Types:
  app                 Full application
  feature             New feature
  bugfix              Bug fix

Options:
  --type <type>       Workflow type (app|feature|bugfix)
  --name <name>       Workflow name
  --description <desc> Workflow description
  --priority <level>  Priority level (low|medium|high|critical)
  --platform <name>   Target platform
  --help              Show help for command
  --version           Show version info

Examples:
  sdlc workflow:create app "My App"
  sdlc workflow:create feature "Add login" --platform web-apps
  sdlc workflow:status abc123def
  sdlc platform:list
    `.trim()

    return {
      success: true,
      message: 'Help information',
      output: help
    }
  }

  /**
   * Show version
   */
  private showVersion(): CliResult {
    return {
      success: true,
      message: 'Version information',
      output: `
Agentic SDLC CLI v1.0.0
Built with TypeScript
      `.trim()
    }
  }

  /**
   * Convert flags to record format
   */
  private flagsToRecord(flags: Record<string, string | boolean>): Record<string, any> {
    const result: Record<string, any> = {}

    for (const [key, value] of Object.entries(flags)) {
      if (key !== 'help' && key !== 'version') {
        result[key] = value
      }
    }

    return result
  }

  /**
   * Get local cache statistics
   */
  getStats(): {
    offline_mode: boolean
    local_cache_entries: number
  } {
    return {
      offline_mode: this.config.offline_mode || false,
      local_cache_entries: this.localCache.size
    }
  }

  /**
   * Sync cached workflows when coming online
   */
  async syncCachedWorkflows(): Promise<{ synced: number; failed: number }> {
    logger.info('[CliSurface] Syncing cached workflows')

    let synced = 0
    let failed = 0

    for (const [workflowId, cached] of this.localCache.entries()) {
      try {
        // TODO: Submit cached workflow
        synced++
        this.localCache.delete(workflowId)
      } catch (error) {
        failed++
        logger.error('[CliSurface] Failed to sync workflow', {
          workflow_id: workflowId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    logger.info('[CliSurface] Sync complete', { synced, failed })
    return { synced, failed }
  }
}
