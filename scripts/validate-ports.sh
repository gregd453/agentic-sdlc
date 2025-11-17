#!/bin/bash

#############################################################################
# Port Configuration Validator
#
# Validates that all required port environment variables are set and valid
# before starting services.
#
# Usage: ./scripts/validate-ports.sh
#############################################################################

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track validation status
ERRORS=0
WARNINGS=0

echo -e "${BLUE}════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Port Configuration Validator${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: package.json not found. Run from project root.${NC}"
  exit 1
fi

# Load environment if .env file exists
if [ -f ".env.development" ]; then
  echo -e "${BLUE}📁 Loading .env.development...${NC}"
  export $(cat .env.development | grep -v '^#' | grep -v '^$' | xargs)
  echo -e "${GREEN}✅ Environment loaded${NC}"
  echo ""
elif [ -f ".env" ]; then
  echo -e "${BLUE}📁 Loading .env...${NC}"
  export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
  echo -e "${GREEN}✅ Environment loaded${NC}"
  echo ""
else
  echo -e "${YELLOW}⚠️  No .env file found. Using system environment variables.${NC}"
  echo ""
fi

#############################################################################
# Validation Functions
#############################################################################

validate_port_variable() {
  local var_name="$1"
  local description="$2"

  local value="${!var_name}"

  if [ -z "$value" ]; then
    echo -e "${RED}❌ MISSING: ${var_name}${NC}"
    echo "   Description: $description"
    ERRORS=$((ERRORS + 1))
    return 1
  fi

  # Check if it's a valid number
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}❌ INVALID: ${var_name}=${value}${NC}"
    echo "   Error: Must be a number (got: '$value')"
    ERRORS=$((ERRORS + 1))
    return 1
  fi

  # Check if port is in valid range
  if (( value < 1 || value > 65535 )); then
    echo -e "${RED}❌ OUT OF RANGE: ${var_name}=${value}${NC}"
    echo "   Error: Port must be between 1 and 65535"
    ERRORS=$((ERRORS + 1))
    return 1
  fi

  echo -e "${GREEN}✅ ${var_name}=${value}${NC}"
  echo "   Description: $description"
  return 0
}

validate_text_variable() {
  local var_name="$1"
  local description="$2"

  local value="${!var_name}"

  if [ -z "$value" ]; then
    echo -e "${RED}❌ MISSING: ${var_name}${NC}"
    echo "   Description: $description"
    ERRORS=$((ERRORS + 1))
    return 1
  fi

  echo -e "${GREEN}✅ ${var_name}=${value}${NC}"
  echo "   Description: $description"
  return 0
}

#############################################################################
# Validate Service Ports (REQUIRED)
#############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Service Ports (REQUIRED)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

validate_port_variable "VITE_DASHBOARD_PORT" "Dashboard React dev server"
echo ""

validate_port_variable "ORCHESTRATOR_PORT" "Orchestrator API server"
echo ""

validate_port_variable "ANALYTICS_SERVICE_PORT" "Analytics Service API"
echo ""

#############################################################################
# Validate Redis Configuration (REQUIRED)
#############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Redis Configuration (REQUIRED)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

validate_text_variable "REDIS_HOST" "Redis server hostname"
echo ""

validate_port_variable "REDIS_PORT" "Redis server port"
echo ""

#############################################################################
# Validate Optional Configuration
#############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Optional Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -z "${HOST}" ]; then
  echo -e "${YELLOW}⚠️  HOST not set${NC}"
  echo "   Using default: 0.0.0.0"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}✅ HOST=${HOST}${NC}"
fi
echo ""

if [ -z "${VITE_HOST}" ]; then
  echo -e "${YELLOW}⚠️  VITE_HOST not set${NC}"
  echo "   Using default: 0.0.0.0"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "${GREEN}✅ VITE_HOST=${VITE_HOST}${NC}"
fi
echo ""

#############################################################################
# Port Availability Check
#############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Port Availability Check${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

check_port_available() {
  local port="$1"
  local service="$2"

  if command -v lsof &> /dev/null; then
    # macOS/Linux
    if lsof -i ":$port" > /dev/null 2>&1; then
      echo -e "${RED}❌ Port $port is already in use${NC}"
      echo "   Service: $service"
      echo "   Processes using this port:"
      lsof -i ":$port" | tail -n +2 | awk '{print "     - " $1 " (PID: " $2 ")"}'
      WARNINGS=$((WARNINGS + 1))
    else
      echo -e "${GREEN}✅ Port $port available${NC}"
      echo "   Service: $service"
    fi
  elif command -v netstat &> /dev/null; then
    # Windows/fallback
    if netstat -ano 2>/dev/null | grep -q ":$port "; then
      echo -e "${RED}❌ Port $port is already in use${NC}"
      echo "   Service: $service"
      WARNINGS=$((WARNINGS + 1))
    else
      echo -e "${GREEN}✅ Port $port available${NC}"
      echo "   Service: $service"
    fi
  else
    echo -e "${YELLOW}⚠️  Cannot check port availability (lsof/netstat not found)${NC}"
    echo "   Service: $service (Port: $port)"
    WARNINGS=$((WARNINGS + 1))
  fi
  echo ""
}

check_port_available "$VITE_DASHBOARD_PORT" "Dashboard"
check_port_available "$ORCHESTRATOR_PORT" "Orchestrator"
check_port_available "$ANALYTICS_SERVICE_PORT" "Analytics"
check_port_available "$REDIS_PORT" "Redis"

#############################################################################
# Summary
#############################################################################

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Validation Summary${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
  if [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All validations passed!${NC}"
    echo ""
    echo "Configuration is ready. You can now start services:"
    echo "  ./dev start"
    echo ""
    exit 0
  else
    echo -e "${YELLOW}⚠️  Validation passed with $WARNINGS warning(s)${NC}"
    echo ""
    echo "You can continue, but please review warnings above."
    echo ""
    exit 0
  fi
else
  echo -e "${RED}❌ Validation FAILED with $ERRORS error(s)${NC}"
  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Also $WARNINGS warning(s)${NC}"
  fi
  echo ""
  echo "Fix the errors above before starting services."
  echo ""
  echo "Need help? Check the documentation:"
  echo "  cat PORT_CONFIGURATION.md"
  echo ""
  exit 1
fi
