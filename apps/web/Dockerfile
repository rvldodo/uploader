# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/upload-engine/package.json packages/upload-engine/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @media-upload/web...
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/upload-engine packages/upload-engine
COPY apps/web apps/web
RUN pnpm --filter @media-upload/web build

# Nitro emits a self-contained server bundle; no node_modules needed at runtime.
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build /repo/apps/web/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
