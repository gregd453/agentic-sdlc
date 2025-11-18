# ==========================================
# Development Dockerfile for Dashboard
# React frontend with Vite dev server
# ==========================================

FROM node:20.11.0-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Install concurrently globally
RUN npm install -g concurrently

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy source code
COPY . .

# Install dependencies
RUN pnpm install

# Expose port
EXPOSE 3050

# Health check (simple HTTP check)
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=15s \
  CMD wget --quiet --tries=1 --spider http://localhost:3050 || exit 1

# Start Vite dev server on port 3050
WORKDIR /app/packages/dashboard
CMD ["pnpm", "run", "dev"]
