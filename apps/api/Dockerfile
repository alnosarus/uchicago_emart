FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./

# Copy package manifests for dependency resolution
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build API
RUN cd apps/api && npx tsc

EXPOSE 3000

# Run migrations and start
CMD cd apps/api && npx prisma migrate deploy && node dist/index.js
