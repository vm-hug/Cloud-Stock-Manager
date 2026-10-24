# ==========================================
# Multi-Stage Dockerfile for Cloud Stock Management API
# Node.js + npm workspaces compatible
# ==========================================

# 1. Base stage
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production

# 2. Dependencies stage (installs all deps for building)
FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --include=dev

# 3. Builder stage
FROM dependencies AS builder
WORKDIR /app
COPY . .

# Generate Prisma client for API
RUN npm run prisma:generate --workspace=@cloud-stock/api

# Build shared package then API
RUN npm run build --workspace=@cloud-stock/shared
RUN npm run build --workspace=@cloud-stock/api

# 4. Production Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy package manifests & production node_modules
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules

# Copy built artifacts and Prisma files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER appuser

EXPOSE 5000

CMD ["node", "apps/api/dist/server.js"]
