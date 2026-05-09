# syntax=docker/dockerfile:1.7
# Thin runtime image. The TypeScript compile happens locally
# (`scripts/build-artifacts.sh`) — this stage only installs prod deps
# and ships the pre-built dist/.
#
# Build context: repo root.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/dashboard/package.json ./apps/dashboard/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspace @gpay/api-gateway --include-workspace-root

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/api-gateway/dist ./apps/api-gateway/dist
COPY deploy/migrations ./deploy/migrations
EXPOSE 3000
USER node
CMD ["node", "apps/api-gateway/dist/index.js"]
