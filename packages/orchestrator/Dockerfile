# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy all root files and all packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

# Install dependencies (this will link all workspace packages)
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN cd /app/packages/orchestrator && pnpm exec prisma generate

# Build the application from workspace root
RUN cd /app && pnpm -r --filter @agentic-sdlc/orchestrator... run build

# Production stage
FROM node:20-alpine AS production

# Install pnpm
RUN npm install -g pnpm@9

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy workspace files from root
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

# Install dependencies (use builder's node_modules structure)
RUN pnpm install --frozen-lockfile --no-optional

# Copy all built packages from builder stage (includes dist folders)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# Set working directory to app root for proper module resolution
WORKDIR /app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => {if (r.statusCode !== 200) throw new Error()})"

# Run with dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application from workspace root so Node resolves modules correctly
CMD ["node", "packages/orchestrator/dist/index.js"]