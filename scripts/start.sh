#!/bin/bash
set -e

echo "🚀 Starting Agentic SDLC System"
echo "================================"

# Check if .env exists
if [ ! -f .env ]; then
    echo "📄 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update .env with your API keys before running agents"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Start infrastructure services
echo "🐳 Starting PostgreSQL and Redis..."
docker-compose up -d postgres redis

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if services are healthy
echo "🔍 Checking service health..."
docker-compose ps

# Generate Prisma client
echo "📚 Generating Prisma client..."
cd packages/orchestrator
pnpm exec prisma generate
cd ../..

# Run database migrations
echo "🗄️ Running database migrations..."
cd packages/orchestrator
pnpm exec prisma migrate deploy || true
cd ../..

# Start the orchestrator
echo "🎯 Starting Orchestrator..."
echo ""
echo "================================"
echo "Orchestrator starting on http://localhost:3000"
echo "API Documentation: http://localhost:3000/documentation"
echo "Press Ctrl+C to stop"
echo "================================"
echo ""

pnpm orchestrator:dev