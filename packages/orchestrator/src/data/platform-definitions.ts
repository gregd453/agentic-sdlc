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
      workflowTypes: ['app', 'feature', 'bugfix'],
      stageSequences: {
        app: [
          'initialization',
          'scaffolding',
          'dependency_installation',
          'validation',
          'e2e_testing',
          'integration',
          'deployment',
          'monitoring'
        ],
        feature: ['initialization', 'scaffolding', 'dependency_installation', 'validation', 'e2e_testing'],
        bugfix: ['initialization', 'validation', 'e2e_testing'],
        service: ['initialization', 'scaffolding', 'dependency_installation', 'validation', 'integration', 'deployment']
      },
      supportedSurfaces: ['REST', 'DASHBOARD'],
      agentMapping: {
        scaffolding: 'scaffold',
        validation: 'validation',
        e2e_testing: 'e2e_test',
        integration: 'integration',
        deployment: 'deployment',
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
      workflowTypes: ['app', 'feature', 'bugfix'],
      stageSequences: {
        app: [
          'initialization',
          'scaffolding',
          'dependency_installation',
          'validation',
          'e2e_testing',
          'integration',
          'deployment',
          'monitoring'
        ],
        feature: ['initialization', 'scaffolding', 'dependency_installation', 'validation', 'e2e_testing', 'deployment'],
        bugfix: ['initialization', 'validation', 'e2e_testing', 'deployment']
      },
      supportedSurfaces: ['REST', 'WEBHOOK', 'DASHBOARD'],
      frameworks: ['React', 'Vue', 'Angular', 'Next.js'],
      agentMapping: {
        scaffolding: 'scaffold',
        validation: 'validation',
        e2e_testing: 'e2e_test',
        integration: 'integration',
        deployment: 'deployment'
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
          'validation',
          'unit_testing',
          'integration_testing',
          'performance_testing',
          'deployment'
        ],
        transformation: ['initialization', 'validation', 'unit_testing', 'deployment'],
        ingestion: ['initialization', 'connection_validation', 'schema_validation', 'deployment']
      },
      supportedSurfaces: ['REST', 'WEBHOOK', 'CLI'],
      technologies: ['Apache Spark', 'Airflow', 'dbt', 'Kafka'],
      agentMapping: {
        schema_definition: 'validation',
        validation: 'validation',
        unit_testing: 'e2e_test',
        integration_testing: 'integration',
        performance_testing: 'e2e_test',
        deployment: 'deployment'
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
        terraform: ['initialization', 'plan', 'validation', 'testing', 'deployment'],
        kubernetes: ['initialization', 'manifest_generation', 'validation', 'deployment'],
        docker: ['initialization', 'build', 'security_scan', 'push', 'deployment']
      },
      supportedSurfaces: ['REST', 'WEBHOOK', 'CLI'],
      technologies: ['Terraform', 'Kubernetes', 'Docker', 'CloudFormation'],
      agentMapping: {
        plan: 'validation',
        validation: 'validation',
        testing: 'e2e_test',
        deployment: 'deployment'
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
