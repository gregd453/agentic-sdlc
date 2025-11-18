import { AGENT_TYPES } from '@agentic-sdlc/shared-types';
/**
 * Platform Definitions - Seed data for platforms and surfaces
 *
 * These definitions are loaded during initialization to populate
 * the Platform and PlatformSurface tables.
 */

export const platformDefinitions = {
  legacy: {
    name: 'legacy',
    layer: 'APPLICATION',
    description: 'Legacy platform for backward compatibility with existing workflows',
    config: {
      workflowTypes: [WORKFLOW_TYPES.APP, WORKFLOW_TYPES.FEATURE, WORKFLOW_TYPES.BUGFIX],
      stageSequences: {
        app: [
          'initialization',
          'scaffolding',
          'dependency_installation',
          AGENT_TYPES.VALIDATION,
          'e2e_testing',
          AGENT_TYPES.INTEGRATION,
          AGENT_TYPES.DEPLOYMENT,
          'monitoring'
        ],
        feature: ['initialization', 'scaffolding', 'dependency_installation', AGENT_TYPES.VALIDATION, 'e2e_testing'],
        bugfix: ['initialization', AGENT_TYPES.VALIDATION, 'e2e_testing'],
        service: ['initialization', 'scaffolding', 'dependency_installation', AGENT_TYPES.VALIDATION, AGENT_TYPES.INTEGRATION, AGENT_TYPES.DEPLOYMENT]
      },
      supportedSurfaces: ['REST', 'DASHBOARD'],
      agentMapping: {
        scaffolding: AGENT_TYPES.SCAFFOLD,
        validation: AGENT_TYPES.VALIDATION,
        e2e_testing: AGENT_TYPES.E2E_TEST,
        integration: AGENT_TYPES.INTEGRATION,
        deployment: AGENT_TYPES.DEPLOYMENT,
        monitoring: 'monitoring'
      }
    },
    enabled: true
  },

  webApps: {
    name: 'web-apps',
    layer: 'APPLICATION',
    description: 'Platform for web application development and deployment',
    config: {
      workflowTypes: [WORKFLOW_TYPES.APP, WORKFLOW_TYPES.FEATURE, WORKFLOW_TYPES.BUGFIX],
      stageSequences: {
        app: [
          'initialization',
          'scaffolding',
          'dependency_installation',
          AGENT_TYPES.VALIDATION,
          'e2e_testing',
          AGENT_TYPES.INTEGRATION,
          AGENT_TYPES.DEPLOYMENT,
          'monitoring'
        ],
        feature: ['initialization', 'scaffolding', 'dependency_installation', AGENT_TYPES.VALIDATION, 'e2e_testing', AGENT_TYPES.DEPLOYMENT],
        bugfix: ['initialization', AGENT_TYPES.VALIDATION, 'e2e_testing', AGENT_TYPES.DEPLOYMENT]
      },
      supportedSurfaces: ['REST', 'WEBHOOK', 'DASHBOARD'],
      frameworks: ['React', 'Vue', 'Angular', 'Next.js'],
      agentMapping: {
        scaffolding: AGENT_TYPES.SCAFFOLD,
        validation: AGENT_TYPES.VALIDATION,
        e2e_testing: AGENT_TYPES.E2E_TEST,
        integration: AGENT_TYPES.INTEGRATION,
        deployment: AGENT_TYPES.DEPLOYMENT
      }
    },
    enabled: false // Not yet implemented
  },

  dataPipelines: {
    name: 'data-pipelines',
    layer: 'DATA',
    description: 'Platform for data pipeline development and orchestration',
    config: {
      workflowTypes: ['pipeline', 'transformation', 'ingestion'],
      stageSequences: {
        pipeline: [
          'initialization',
          'schema_definition',
          AGENT_TYPES.VALIDATION,
          'unit_testing',
          'integration_testing',
          'performance_testing',
          AGENT_TYPES.DEPLOYMENT
        ],
        transformation: ['initialization', AGENT_TYPES.VALIDATION, 'unit_testing', AGENT_TYPES.DEPLOYMENT],
        ingestion: ['initialization', 'connection_validation', 'schema_validation', AGENT_TYPES.DEPLOYMENT]
      },
      supportedSurfaces: ['REST', 'WEBHOOK', 'CLI'],
      technologies: ['Apache Spark', 'Airflow', 'dbt', 'Kafka'],
      agentMapping: {
        schema_definition: AGENT_TYPES.VALIDATION,
        validation: AGENT_TYPES.VALIDATION,
        unit_testing: AGENT_TYPES.E2E_TEST,
        integration_testing: AGENT_TYPES.INTEGRATION,
        performance_testing: AGENT_TYPES.E2E_TEST,
        deployment: AGENT_TYPES.DEPLOYMENT
      }
    },
    enabled: false // Not yet implemented
  },

  infrastructure: {
    name: 'infrastructure',
    layer: 'INFRASTRUCTURE',
    description: 'Platform for infrastructure-as-code and deployment management',
    config: {
      workflowTypes: ['terraform', 'kubernetes', 'docker'],
      stageSequences: {
        terraform: ['initialization', 'plan', AGENT_TYPES.VALIDATION, 'testing', AGENT_TYPES.DEPLOYMENT],
        kubernetes: ['initialization', 'manifest_generation', AGENT_TYPES.VALIDATION, AGENT_TYPES.DEPLOYMENT],
        docker: ['initialization', 'build', 'security_scan', 'push', AGENT_TYPES.DEPLOYMENT]
      },
      supportedSurfaces: ['REST', 'WEBHOOK', 'CLI'],
      technologies: ['Terraform', 'Kubernetes', 'Docker', 'CloudFormation'],
      agentMapping: {
        plan: AGENT_TYPES.VALIDATION,
        validation: AGENT_TYPES.VALIDATION,
        testing: AGENT_TYPES.E2E_TEST,
        deployment: AGENT_TYPES.DEPLOYMENT
      }
    },
    enabled: false // Not yet implemented
  }
}

export const surfaceDefinitions = {
  rest: {
    surfaceType: 'REST',
    description: 'RESTful API surface for HTTP-based workflow submission',
    config: {
      basePath: '/api/v1',
      enableSwagger: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100
      }
    },
    enabled: true
  },

  webhook: {
    surfaceType: 'WEBHOOK',
    description: 'Webhook surface for event-driven workflow triggers',
    config: {
      enableGitHub: true,
      enableGeneric: true,
      verificationRequired: true,
      retryPolicy: {
        maxRetries: 3,
        backoffMs: 1000
      }
    },
    enabled: true
  },

  cli: {
    surfaceType: 'CLI',
    description: 'Command-line interface surface for local workflow execution',
    config: {
      enableLocalExecution: true,
      allowOfflineMode: true,
      authRequired: false
    },
    enabled: false // Not yet implemented
  },

  dashboard: {
    surfaceType: 'DASHBOARD',
    description: 'Web-based dashboard for workflow monitoring and management',
    config: {
      enableRealtime: true,
      enableAnalytics: true,
      port: 3001
    },
    enabled: true
  },

  mobileApi: {
    surfaceType: 'MOBILE_API',
    description: 'Mobile-optimized API for iOS and Android applications',
    config: {
      enableOfflineSync: true,
      cacheStrategy: 'aggressive',
      payloadOptimization: true
    },
    enabled: false // Not yet implemented
  }
}

// Type for seeding
export interface PlatformSeedData {
  name: string
  layer: string
  description?: string
  config?: Record<string, any>
}

export interface SurfaceSeedData {
  platformName: string
  surfaceType: string
  config?: Record<string, any>
}
