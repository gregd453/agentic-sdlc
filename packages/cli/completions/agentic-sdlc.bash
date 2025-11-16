#!/usr/bin/env bash
#
# Bash completion script for agentic-sdlc CLI
#
# Installation:
#   - macOS: cp agentic-sdlc.bash /usr/local/etc/bash_completion.d/agentic-sdlc
#   - Linux: cp agentic-sdlc.bash /etc/bash_completion.d/agentic-sdlc
#   - Or add to ~/.bashrc: source /path/to/agentic-sdlc.bash
#

_agentic_sdlc_completions() {
  local cur prev
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  # Available commands
  local commands=(
    # Environment
    "start" "up" "stop" "down" "restart" "reload" "reset" "status"
    # Health & Diagnostics
    "health" "health:services" "health:database" "health:agents"
    # Logs & Monitoring
    "logs" "metrics"
    # Testing (Phase 7B)
    "test" "test:units" "test:integration" "test:e2e" "validate:ci"
    # Deployment (Phase 7B)
    "deploy" "deploy:validate" "deploy:rollback"
    # Database (Phase 7B)
    "db:setup" "db:migrate" "db:reset" "db:seed" "db:backup"
    # Operations (Phase 7B)
    "workflows:list" "workflows:get" "agents:list" "agents:status"
    # Configuration
    "config"
    # Help
    "help"
  )

  # Global options
  local global_opts=(
    "-v" "--verbose"
    "-j" "--json"
    "-y" "--yaml"
    "-h" "--help"
    "--version"
  )

  # Command-specific options
  local start_opts=("--skip-build" "--wait" "--services" "--force-build")
  local stop_opts=("--force" "--services")
  local restart_opts=("--wait")
  local status_opts=("--watch" "--interval")
  local reset_opts=("--confirm")
  local health_opts=("--verbose" "--wait")
  local logs_opts=("--service" "--follow" "--lines" "--grep")
  local metrics_opts=("--service" "--period")
  local test_opts=("--tier" "--match" "--parallel" "--timeout")
  local deploy_opts=("--env" "--dry-run" "--approve")

  # Complete based on context
  case "$prev" in
    start|up)
      COMPREPLY=($(compgen -W "${start_opts[*]} ${global_opts[*]}" -- "$cur"))
      ;;
    stop|down)
      COMPREPLY=($(compgen -W "${stop_opts[*]} ${global_opts[*]}" -- "$cur"))
      ;;
    restart|reload)
      COMPREPLY=($(compgen -W "${restart_opts[*]} ${global_opts[*]}" -- "$cur"))
      ;;
    status)
      COMPREPLY=($(compgen -W "${status_opts[*]} ${global_opts[*]}" -- "$cur"))
      ;;
    reset)
      COMPREPLY=($(compgen -W "${reset_opts[*]} ${global_opts[*]}" -- "$cur"))
      ;;
    health|health:services|health:database|health:agents)
      COMPREPLY=($(compgen -W "${health_opts[*]} ${global_opts[*]}" -- "$cur"))
      ;;
    logs)
      COMPREPLY=($(compgen -W "${logs_opts[*]} ${global_opts[*]}" -- "$cur"))
      ;;
    metrics)
      COMPREPLY=($(compgen -W "${metrics_opts[*]} ${global_opts[*]}" -- "$cur"))
      ;;
    test|test:units|test:integration|test:e2e)
      COMPREPLY=($(compgen -W "${test_opts[*]} ${global_opts[*]}" -- "$cur"))
      ;;
    deploy|deploy:validate|deploy:rollback)
      COMPREPLY=($(compgen -W "${deploy_opts[*]} ${global_opts[*]}" -- "$cur"))
      ;;
    --service)
      COMPREPLY=($(compgen -W "orchestrator dashboard analytics scaffold validation integration deployment e2e" -- "$cur"))
      ;;
    --period)
      COMPREPLY=($(compgen -W "1h 24h 7d" -- "$cur"))
      ;;
    --env)
      COMPREPLY=($(compgen -W "staging production" -- "$cur"))
      ;;
    --tier)
      COMPREPLY=($(compgen -W "1 2 3 4" -- "$cur"))
      ;;
    *)
      # Complete commands
      COMPREPLY=($(compgen -W "${commands[*]} ${global_opts[*]}" -- "$cur"))
      ;;
  esac

  return 0
}

# Register completion function
complete -F _agentic_sdlc_completions agentic-sdlc
