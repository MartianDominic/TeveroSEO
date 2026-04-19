# syntax=docker/dockerfile:1.7

# ---- Stage 1: builder ----
FROM node:22-alpine AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production

# NEXT_PUBLIC_* vars are inlined at build time - must be ARGs
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/clients
ARG NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/clients
ARG NEXT_PUBLIC_OPEN_SEO_URL
ARG NEXT_PUBLIC_AI_WRITER_URL

# Convert ARGs to ENVs so they're available during build
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL
ENV NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL
ENV NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL
ENV NEXT_PUBLIC_OPEN_SEO_URL=$NEXT_PUBLIC_OPEN_SEO_URL
ENV NEXT_PUBLIC_AI_WRITER_URL=$NEXT_PUBLIC_AI_WRITER_URL

RUN apk add --no-cache libc6-compat \
    && corepack enable

WORKDIR /app

# Copy monorepo root files for workspace resolution
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy workspace packages (dependencies of apps/web)
COPY packages/ ./packages/

# Copy the app
COPY apps/web/ ./apps/web/

# Install all deps (workspace-aware, frozen lockfile)
RUN pnpm install --frozen-lockfile

# Build the Next.js app (standalone output configured in next.config.ts)
RUN pnpm --filter @tevero/web build

# ---- Stage 2: runtime ----
FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3002

RUN apk add --no-cache tini \
    && addgroup -S nodejs -g 1001 \
    && adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Copy standalone output (Next.js copies all needed node_modules into .next/standalone)
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/public ./apps/web/public

USER nodejs

EXPOSE 3002

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
