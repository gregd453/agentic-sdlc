#compdef agentic-sdlc
#
# Zsh completion script for agentic-sdlc CLI
#
# Installation:
#   - macOS: cp _agentic-sdlc.zsh /usr/local/share/zsh/site-functions/_agentic-sdlc
#   - Linux: cp _agentic-sdlc.zsh /usr/share/zsh/site-functions/_agentic-sdlc
#   - Or add to ~/.zshrc: fpath=(./completions $fpath)
#

_agentic_sdlc() {
  local -a commands services periods envs tiers

  # Command definitions
  commands=(
    # Environment
    "start:Start all services"
    "up:Alias for start"
    "stop:Stop services gracefully"
    "down:Alias for stop"
    "restart:Restart services"
    "reload:Alias for restart"
    "reset:Reset environment (data loss)"
    "status:Show environment status"
    # Health & Diagnostics
    "health:Run comprehensive health check"
    "health\\:services:Check service health only"
    "health\\:database:Check database connectivity"
    "health\\:agents:Check agent registration"
    # Logs & Monitoring
    "logs:View and filter logs"
    "metrics:Show system metrics"
    # Testing
    "test:Run tests"
    "test\\:units:Run unit tests"
    "test\\:integration:Run integration tests"
    "test\\:e2e:Run E2E tests"
    "validate\\:ci:Validate before commit"
    # Deployment
    "deploy:Deploy to environment"
    "deploy\\:validate:Validate deployment"
    "deploy\\:rollback:Rollback deployment"
    # Database
    "db\\:setup:Setup database"
    "db\\:migrate:Run migrations"
    "db\\:reset:Reset database"
    "db\\:seed:Seed test data"
    "db\\:backup:Backup database"
    # Operations
    "workflows\\:list:List all workflows"
    "workflows\\:get:Get workflow details"
    "agents\\:list:List all agents"
    "agents\\:status:Check agent status"
    # Configuration
    "config:Show configuration"
    # Help
    "help:Show help information"
  )

  services=(
    "orchestrator"
    "dashboard"
    "analytics"
    "scaffold-agent"
    "validation-agent"
    "integration-agent"
    "deployment-agent"
    "e2e-agent"
  )

  periods=(
    "1h:Last hour"
    "24h:Last 24 hours"
    "7d:Last 7 days"
  )

  envs=(
    "staging:Staging environment"
    "production:Production environment"
  )

  tiers=(
    "1:Tier 1 tests"
    "2:Tier 2 tests"
    "3:Tier 3 tests"
    "4:Tier 4 tests"
  )

  local -a global_options
  global_options=(
    "-v,--verbose:Enable verbose output"
    "-j,--json:Output as JSON"
    "-y,--yaml:Output as YAML"
    "-h,--help:Show help"
    "--version:Show version"
  )

  # Dispatch to command-specific completions
  _arguments -s -S \
    "1: :_describe 'command' commands" \
    "*: :->args" \
    $global_options

  case $state in
    args)
      case $words[2] in
        start|up)
          _arguments \
            '--skip-build' \
            '--force-build' \
            '--wait:' \
            '--services:' \
            $global_options
          ;;
        stop|down)
          _arguments \
            '--force' \
            '--services:' \
            $global_options
          ;;
        restart|reload)
          _arguments \
            '--wait:' \
            $global_options
          ;;
        status)
          _arguments \
            '--watch' \
            '--interval:' \
            $global_options
          ;;
        reset)
          _arguments \
            '--confirm' \
            $global_options
          ;;
        health|health:services|health:database|health:agents)
          _arguments \
            '--verbose' \
            '--wait:' \
            $global_options
          ;;
        logs)
          _arguments \
            "--service:services:(${services[@]})" \
            '--follow' \
            '--lines:' \
            '--grep:' \
            $global_options
          ;;
        metrics)
          _arguments \
            "--service:services:(${services[@]})" \
            "--period:periods:(${periods[@]})" \
            $global_options
          ;;
        test|test:units|test:integration|test:e2e)
          _arguments \
            "--tier:tiers:(${tiers[@]})" \
            '--match:' \
            '--parallel' \
            '--timeout:' \
            $global_options
          ;;
        deploy|deploy:validate|deploy:rollback)
          _arguments \
            "--env:envs:(${envs[@]})" \
            '--dry-run' \
            '--approve' \
            $global_options
          ;;
      esac
      ;;
  esac
}

_agentic_sdlc
