FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy source code (volumes will override in dev)
COPY . .

# Install dependencies (will use workspace if available)
RUN pnpm install --no-frozen-lockfile || true

# Expose port
EXPOSE 3001

# Start dev server
CMD ["pnpm", "dev", "--host"]
