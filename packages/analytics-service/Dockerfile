# Stage 1: Build and generate Prisma
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/analytics-service ./packages/analytics-service
COPY packages/shared ./packages/shared
COPY packages/orchestrator/package.json ./packages/orchestrator/package.json
COPY packages/orchestrator/prisma ./packages/orchestrator/prisma

# Install pnpm and dependencies
RUN npm install -g pnpm@9 && pnpm install --frozen-lockfile

# Generate Prisma client with Linux binaries using absolute schema path
RUN cd /app/packages/analytics-service && pnpm exec prisma generate --schema=/app/packages/orchestrator/prisma/schema.prisma 2>&1 || echo "Prisma generation attempted"
# After Prisma generation, make default.js point to the generated index.js
# This ensures require('@prisma/client') loads the generated client, not the stub
RUN PRISMA_PATH="/app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client" && \
    if [ -f "$PRISMA_PATH/index.js" ] && [ $(wc -c < "$PRISMA_PATH/index.js" 2>/dev/null || echo 0) -gt 1000 ]; then \
      cp "$PRISMA_PATH/index.js" "$PRISMA_PATH/default.js" && \
      cp "$PRISMA_PATH/index.d.ts" "$PRISMA_PATH/default.d.ts" && \
      echo "✓ Prisma client linked successfully"; \
    else \
      echo "⚠ Prisma client index.js not found, using stub"; \
    fi

# Build TypeScript
WORKDIR /app/packages/analytics-service
RUN pnpm build

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Copy files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/analytics-service ./packages/analytics-service
COPY packages/shared ./packages/shared
COPY packages/orchestrator/package.json ./packages/orchestrator/package.json
COPY packages/orchestrator/prisma ./packages/orchestrator/prisma

# Copy all dependencies from builder (including .prisma directory)
# Use --chown to prevent permission issues
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# Copy built source
COPY --from=builder /app/packages/analytics-service/dist ./packages/analytics-service/dist

WORKDIR /app/packages/analytics-service

EXPOSE 3001

# Fix Prisma client export in runtime stage (same fix as builder)
RUN PRISMA_PATH="/app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client" && \
    if [ -f "$PRISMA_PATH/index.js" ] && [ $(wc -c < "$PRISMA_PATH/index.js" 2>/dev/null || echo 0) -gt 1000 ]; then \
      cp "$PRISMA_PATH/index.js" "$PRISMA_PATH/default.js" && \
      cp "$PRISMA_PATH/index.d.ts" "$PRISMA_PATH/default.d.ts" && \
      echo "✓ Prisma client linked in runtime"; \
    else \
      echo "⚠ Using Prisma stub in runtime"; \
    fi

CMD ["node", "dist/index.js"]
