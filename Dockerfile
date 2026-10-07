# Multi-Stage Production Dockerfile for BuildTrack AMS
# Node.js 22 LTS on Alpine Linux for minimal attack surface and small image size

# ==========================================
# Stage 1: Build Frontend and Server Bundle
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install package dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy full application source code
COPY . .

# Compile frontend static assets (Vite) and backend bundle (esbuild)
RUN npm run build

# Prune development dependencies for lean production container
RUN npm prune --production

# ==========================================
# Stage 2: Production Execution Environment
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

# Install runtime utilities, MySQL client, and curl for health check
RUN apk add --no-cache curl dumb-init mariadb-client

ENV NODE_ENV=production
ENV PORT=3000

# Create dedicated directory for configuration persistence
RUN mkdir -p /app/data && chown -R node:node /app

# Copy production artifacts from builder stage
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/server.ts ./server.ts

# Configure default MySQL database environment variables
ENV MYSQL_HOST=127.0.0.1
ENV MYSQL_PORT=3306
ENV MYSQL_USER=root
ENV MYSQL_DATABASE=buildtrack_ams

# Drop root privileges and run as unprivileged node user
USER node

# Expose standard container port
EXPOSE 3000

# Health check to ensure Express and Vite static server are responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Launch with dumb-init for proper signal handling and zombie reaping
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.cjs"]
