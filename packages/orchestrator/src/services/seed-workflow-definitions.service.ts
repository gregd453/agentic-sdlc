/**
 * Seed Workflow Definitions Service - Initializes workflow definitions for platforms
 *
 * Responsibilities:
 * - Seed workflow definitions (app, feature, bugfix) into database
 * - Associate definitions with platforms
 * - Handle idempotent seeding (don't duplicate)
 * - Validate definitions before seeding
 */

import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger'
import { SAMPLE_DEFINITIONS, WorkflowDefinitionFull } from '../types/workflow-definition-schema'

export class SeedWorkflowDefinitionsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Seed all workflow definitions for all platforms
   */
  async seedAllDefinitions(): Promise<void> {
    logger.info('[SeedWorkflowDefinitions] Starting workflow definitions seeding...')

    try {
      // Get all enabled platforms
      const platforms = await this.prisma.platform.findMany({
        where: { enabled: true }
      })

      logger.info('[SeedWorkflowDefinitions] Found platforms', {
        count: platforms.length,
        names: platforms.map(p => p.name)
      })

      // Seed definitions for each platform
      for (const platform of platforms) {
        await this.seedDefinitionsForPlatform(platform.id, platform.name)
      }

      logger.info('[SeedWorkflowDefinitions] Workflow definitions seeding complete')
    } catch (error) {
      logger.error('[SeedWorkflowDefinitions] Seeding failed', error)
      throw error
    }
  }

  /**
   * Seed definitions for a specific platform
   */
  async seedDefinitionsForPlatform(platformId: string, platformName: string): Promise<void> {
    logger.info('[SeedWorkflowDefinitions] Seeding definitions for platform', {
      platform_id: platformId,
      platform_name: platformName
    })

    try {
      // Define which definitions apply to this platform
      const definitionsToSeed = this.getDefinitionsForPlatform(platformName)

      for (const definitionName of Object.keys(definitionsToSeed)) {
        const definition = definitionsToSeed[definitionName]

        if (!definition) {
          logger.warn('[SeedWorkflowDefinitions] Definition is null', {
            definition_name: definitionName
          })
          continue
        }

        await this.seedDefinition(platformId, definitionName, definition)
      }
    } catch (error) {
      logger.error('[SeedWorkflowDefinitions] Failed to seed definitions for platform', {
        platform_id: platformId,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Seed a single workflow definition
   */
  private async seedDefinition(
    platformId: string,
    definitionName: string,
    definition: WorkflowDefinitionFull
  ): Promise<void> {
    try {
      // Check if definition already exists
      const existing = await this.prisma.workflowDefinition.findFirst({
        where: {
          platform_id: platformId,
          name: definitionName
        }
      })

      if (existing) {
        logger.info('[SeedWorkflowDefinitions] Definition already exists', {
          platform_id: platformId,
          definition_name: definitionName
        })
        return
      }

      // Create the definition
      await this.prisma.workflowDefinition.create({
        data: {
          platform_id: platformId,
          name: definitionName,
          version: definition.version || '1.0.0',
          description: definition.description,
          definition: definition as any, // Store full definition in JSON
          enabled: definition.enabled ?? true
        }
      })

      logger.info('[SeedWorkflowDefinitions] Created workflow definition', {
        platform_id: platformId,
        definition_name: definitionName,
        stages: definition.stages.length
      })
    } catch (error) {
      logger.error('[SeedWorkflowDefinitions] Failed to seed definition', {
        definition_name: definitionName,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Get definitions for a platform
   */
  private getDefinitionsForPlatform(platformName: string): Record<string, WorkflowDefinitionFull> {
    const definitions: Record<string, Record<string, WorkflowDefinitionFull>> = {
      legacy: {
        app: SAMPLE_DEFINITIONS.app as WorkflowDefinitionFull,
        feature: SAMPLE_DEFINITIONS.feature as WorkflowDefinitionFull,
        bugfix: SAMPLE_DEFINITIONS.bugfix as WorkflowDefinitionFull
      },
      'web-apps': {
        app: {
          ...SAMPLE_DEFINITIONS.app,
          platforms: ['web-apps']
        } as WorkflowDefinitionFull,
        feature: {
          ...SAMPLE_DEFINITIONS.feature,
          platforms: ['web-apps'],
          stages: [
            ...SAMPLE_DEFINITIONS.feature.stages,
            {
              name: 'deployment',
              display_name: 'Deploy to Web',
              agent_type: 'deployment',
              required: true,
              progress_weight: 10,
              timeout_ms: 300000
            }
          ]
        } as WorkflowDefinitionFull,
        bugfix: SAMPLE_DEFINITIONS.bugfix as WorkflowDefinitionFull
      },
      'data-pipelines': {
        pipeline: {
          name: 'pipeline',
          version: '1.0.0',
          description: 'Data pipeline workflow',
          workflow_types: ['pipeline'],
          platforms: ['data-pipelines'],
          enabled: true,
          stages: [
            {
              name: 'initialization',
              agent_type: 'scaffold',
              required: true,
              progress_weight: 10,
              timeout_ms: 60000
            },
            {
              name: 'schema_definition',
              agent_type: 'validation',
              required: true,
              progress_weight: 20,
              timeout_ms: 300000
            },
            {
              name: 'validation',
              agent_type: 'validation',
              required: true,
              progress_weight: 20,
              timeout_ms: 300000
            },
            {
              name: 'unit_testing',
              agent_type: 'e2e_test',
              required: true,
              progress_weight: 20,
              timeout_ms: 600000
            },
            {
              name: 'integration_testing',
              agent_type: 'integration',
              required: true,
              progress_weight: 15,
              timeout_ms: 600000
            },
            {
              name: 'deployment',
              agent_type: 'deployment',
              required: true,
              progress_weight: 15,
              timeout_ms: 300000
            }
          ],
          progress_calculation: 'weighted'
        } as WorkflowDefinitionFull
      },
      infrastructure: {
        terraform: {
          name: 'terraform',
          version: '1.0.0',
          description: 'Terraform infrastructure workflow',
          workflow_types: ['terraform'],
          platforms: ['infrastructure'],
          enabled: true,
          stages: [
            {
              name: 'initialization',
              agent_type: 'scaffold',
              required: true,
              progress_weight: 10,
              timeout_ms: 60000
            },
            {
              name: 'plan',
              agent_type: 'validation',
              required: true,
              progress_weight: 20,
              timeout_ms: 300000
            },
            {
              name: 'validation',
              agent_type: 'validation',
              required: true,
              progress_weight: 20,
              timeout_ms: 300000
            },
            {
              name: 'testing',
              agent_type: 'e2e_test',
              required: true,
              progress_weight: 20,
              timeout_ms: 600000
            },
            {
              name: 'deployment',
              agent_type: 'deployment',
              required: true,
              progress_weight: 30,
              timeout_ms: 600000
            }
          ],
          progress_calculation: 'weighted'
        } as WorkflowDefinitionFull
      }
    }

    return definitions[platformName] || definitions['legacy'] || {}
  }

  /**
   * Get seeding statistics
   */
  async getStats(): Promise<{
    platforms_with_definitions: number
    total_definitions: number
  }> {
    const [platformCount, definitionCount] = await Promise.all([
      this.prisma.platform.count({ where: { enabled: true } }),
      this.prisma.workflowDefinition.count()
    ])

    return {
      platforms_with_definitions: platformCount,
      total_definitions: definitionCount
    }
  }

  /**
   * Clear and re-seed (for testing)
   */
  async resetAndSeed(): Promise<void> {
    logger.info('[SeedWorkflowDefinitions] Resetting workflow definitions...')

    try {
      // Delete all definitions
      await this.prisma.workflowDefinition.deleteMany({})
      logger.info('[SeedWorkflowDefinitions] Deleted all workflow definitions')

      // Re-seed
      await this.seedAllDefinitions()
    } catch (error) {
      logger.error('[SeedWorkflowDefinitions] Reset and seed failed', error)
      throw error
    }
  }
}
