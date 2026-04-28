# Architecture Patterns: VPS Self-Hosting Migration

**Domain:** Self-hosted VPS, Docker Compose, multi-app infrastructure
**Researched:** 2026-04-17
**Overall confidence:** HIGH — patterns verified against official Docker docs, existing AI-Writer codebase, TanStack Start official docs

---

## 1. Shared Docker Compose Architecture

### Service Map

```
VPS
├── nginx            (ports 80, 443 — public)
├── certbot          (no ports — background renewal)
├── open-seo         (port 3001 — internal only)
├── ai-writer-frontend (port 3000 internal — nginx proxies to it)
├── ai-writer-backend  (port 8000 internal — nginx proxies /api/)
├── postgres         (port 5432 — internal only)
└── redis            (port 6379 — internal only)
```

All services join a single named external network `vps-network`. Nginx is the only service with public ports.

### docker-compose.vps.yml

This file lives at the root of the open-seo-main repo (or a dedicated `infra/` directory on the VPS). AI-Writer services are referenced here by build context relative path **only when both repos are cloned side-by-side on the VPS**. The recommended layout on the VPS is:

```
/srv/tevero/
├── open-seo-main/          ← open-seo app + this compose file
├── AI-Writer/              ← ai-writer app (cloned separately)
├── nginx/                  ← shared nginx config
│   └── conf.d/
│       ├── open-seo.conf
│       └── ai-writer.conf
├── certbot/                ← shared certbot data
│   ├── conf/
│   └── www/
└── .env                    ← top-level secrets (do NOT commit)
```

```yaml
# docker-compose.vps.yml
# Unified VPS compose — runs both open-seo and AI-Writer on shared infra.
# Invoke from /srv/tevero/open-seo-main/:
#   docker compose -f docker-compose.vps.yml up -d

version: "3.9"

services:

  # ── Nginx reverse proxy ─────────────────────────────────────────────
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ../nginx/conf.d:/etc/nginx/conf.d:ro
      - ../certbot/conf:/etc/letsencrypt:ro
      - ../certbot/www:/var/www/certbot:ro
    depends_on:
      - open-seo
      - ai-writer-frontend
      - ai-writer-backend
    networks:
      - vps-network
    # Auto-reload nginx every 6h so renewed certs are picked up without restart
    command: >
      /bin/sh -c
      'while :; do sleep 6h & wait $${!}; nginx -s reload; done & nginx -g "daemon off;"'

  # ── Certbot auto-renewal ─────────────────────────────────────────────
  certbot:
    image: certbot/certbot
    restart: unless-stopped
    volumes:
      - ../certbot/conf:/etc/letsencrypt
      - ../certbot/www:/var/www/certbot
    entrypoint: >
      /bin/sh -c
      'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'

  # ── open-seo (TanStack Start / Node.js) ──────────────────────────────
  open-seo:
    build:
      context: .
      dockerfile: Dockerfile.vps
    restart: unless-stopped
    env_file:
      - .env.open-seo
    environment:
      NODE_ENV: production
      PORT: "3001"
    expose:
      - "3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - vps-network
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:3001/healthz || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # ── AI-Writer frontend (React/CRA, served by nginx inside container) ──
  ai-writer-frontend:
    build:
      context: ../AI-Writer/frontend
      args:
        REACT_APP_CLERK_PUBLISHABLE_KEY: ${REACT_APP_CLERK_PUBLISHABLE_KEY}
        REACT_APP_API_BASE_URL: /api
        REACT_APP_DISABLE_SUBSCRIPTION: ${REACT_APP_DISABLE_SUBSCRIPTION:-true}
    restart: unless-stopped
    expose:
      - "80"
    networks:
      - vps-network

  # ── AI-Writer backend (FastAPI) ───────────────────────────────────────
  ai-writer-backend:
    build:
      context: ../AI-Writer/backend
    restart: unless-stopped
    env_file:
      - .env.ai-writer
    environment:
      HOST: "0.0.0.0"
      PORT: "8000"
      ENVIRONMENT: production
      DATABASE_URL: "postgresql://alwrity:${POSTGRES_PASSWORD}@postgres:5432/alwrity"
      REDIS_URL: "redis://redis:6379/1"
    expose:
      - "8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ai_writer_workspace:/app/workspace
    networks:
      - vps-network
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:8000/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  # ── Shared PostgreSQL (two databases: open_seo + alwrity) ────────────
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/postgres/init-databases.sh:/docker-entrypoint-initdb.d/init-databases.sh:ro
    expose:
      - "5432"
    networks:
      - vps-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Redis (BullMQ + KV replacement for open-seo) ─────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    expose:
      - "6379"
    networks:
      - vps-network
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
  ai_writer_workspace:

networks:
  vps-network:
    driver: bridge
```

### Port Allocation Summary

| Service | Internal port | Exposed publicly |
|---------|--------------|-----------------|
| nginx | 80, 443 | Yes (host ports) |
| open-seo | 3001 | No (expose only) |
| ai-writer-frontend | 80 | No (expose only) |
| ai-writer-backend | 8000 | No (expose only) |
| postgres | 5432 | No |
| redis | 6379 | No |

Use `expose:` not `ports:` for internal services — this keeps them unreachable from the host network while remaining accessible within `vps-network`.

### Dependency Order

```
postgres (healthy) ─┬─> open-seo
                    └─> ai-writer-backend
redis    (healthy) ─┬─> open-seo
                    └─> ai-writer-backend
open-seo, ai-writer-frontend, ai-writer-backend ──> nginx
```

---

## 2. Nginx Routing — Two Subdomains, One Instance

### Directory layout on VPS

```
/srv/tevero/nginx/conf.d/
├── open-seo.conf       ← seo.yourdomain.com
└── ai-writer.conf      ← app.yourdomain.com
```

Nginx loads all `*.conf` files from `conf.d/`. Each file is one `server_name`. This replaces the single `app.conf` in AI-Writer's existing nginx config.

### open-seo.conf

```nginx
# open-seo.conf — seo.yourdomain.com

server {
    listen 80;
    server_name seo.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name seo.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/seo.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seo.yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # TanStack Start Node.js app
    location / {
        proxy_pass         http://open-seo:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

### ai-writer.conf

```nginx
# ai-writer.conf — app.yourdomain.com

server {
    listen 80;
    server_name app.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name app.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # FastAPI backend
    location /api/ {
        proxy_pass         http://ai-writer-backend:8000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;   # AI gen requests are slow
    }

    # React frontend (CRA, nginx-served static files)
    location / {
        proxy_pass         http://ai-writer-frontend:80;
        proxy_set_header   Host $host;
    }
}
```

### SSL Bootstrap

The existing `AI-Writer/certbot/init-letsencrypt.sh` handles one domain. For two subdomains, run the bootstrap script twice — once per subdomain — with the shared certbot volume. Or modify the script to request both certs in sequence:

```bash
# Run once for each subdomain on first deploy:
DOMAIN=seo.yourdomain.com bash infra/init-letsencrypt.sh
DOMAIN=app.yourdomain.com bash infra/init-letsencrypt.sh
```

The certbot service's renewal loop handles both certs automatically after that, because `certbot renew` renews all certs in `/etc/letsencrypt/renewal/`.

---

## 3. PostgreSQL Multi-Database Init Script

A single PostgreSQL container runs both `open_seo` and `alwrity` databases. Init scripts in `/docker-entrypoint-initdb.d/` only run on first container start (empty data volume). They are skipped on all subsequent starts.

### infra/postgres/init-databases.sh

```bash
#!/bin/bash
# Creates two databases with dedicated users on the shared postgres instance.
# Runs once at container init (empty data dir only).
set -e

# Function: create_database <db_name> <db_user> <db_password>
create_database() {
    local database=$1
    local user=$2
    local password=$3

    echo "Creating database '$database' with owner '$user'..."

    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
        CREATE USER ${user} WITH PASSWORD '${password}';
        CREATE DATABASE ${database} OWNER ${user};
        GRANT ALL PRIVILEGES ON DATABASE ${database} TO ${user};
EOSQL
}

# open-seo database — credentials sourced from container environment
create_database "open_seo" "open_seo" "${OPEN_SEO_DB_PASSWORD}"

# alwrity database — credentials sourced from container environment
create_database "alwrity" "alwrity" "${POSTGRES_PASSWORD}"

echo "Both databases initialized."
```

### Postgres service env vars (add to docker-compose.vps.yml postgres service)

```yaml
  postgres:
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}          # superuser password
      OPEN_SEO_DB_PASSWORD: ${OPEN_SEO_DB_PASSWORD}   # passed to init script
```

### Application connection strings

```
# open-seo
DATABASE_URL=postgresql://open_seo:${OPEN_SEO_DB_PASSWORD}@postgres:5432/open_seo

# ai-writer-backend
DATABASE_URL=postgresql://alwrity:${POSTGRES_PASSWORD}@postgres:5432/alwrity
```

Each app connects as its own user with access only to its own database. The `postgres` superuser is only used by the init script.

**Critical:** If the `postgres_data` volume already exists (e.g., migrating from the standalone AI-Writer compose), the init script will NOT run. In that case, create the `open_seo` database manually:

```bash
docker compose -f docker-compose.vps.yml exec postgres \
  psql -U postgres -c "CREATE USER open_seo WITH PASSWORD 'yourpassword';"
docker compose -f docker-compose.vps.yml exec postgres \
  psql -U postgres -c "CREATE DATABASE open_seo OWNER open_seo;"
```

---

## 4. CI/CD GitHub Actions — SSH Deploy Workflow

### Pattern: git pull + docker compose up on VPS

No image registry required. The VPS pulls source code and builds images locally. This is appropriate for a single-server setup.

### .github/workflows/deploy-vps.yml

```yaml
name: Deploy to VPS

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_PRIVATE_KEY }}
          port: 22
          # Increase command timeout for docker build (default is 30s per command)
          command_timeout: 10m
          script: |
            set -e

            echo "==> Pulling open-seo-main..."
            cd /srv/tevero/open-seo-main
            git pull origin main

            echo "==> Building and restarting services..."
            docker compose -f docker-compose.vps.yml up --build -d --remove-orphans

            echo "==> Pruning unused images..."
            docker image prune -f

            echo "==> Verifying open-seo health..."
            for i in $(seq 1 12); do
              STATUS=$(docker compose -f docker-compose.vps.yml ps open-seo --format json \
                | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health',''))" 2>/dev/null || echo "")
              if [ "$STATUS" = "healthy" ]; then
                echo "open-seo is healthy."
                break
              fi
              echo "Waiting for open-seo ($i/12)..."
              sleep 10
            done

            echo "==> Deployment complete."
```

### GitHub Secrets Required

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Server IP or hostname (e.g. `203.0.113.10`) |
| `VPS_USER` | SSH user on VPS (e.g. `deploy` or `ubuntu`) |
| `VPS_SSH_PRIVATE_KEY` | Contents of the deploy SSH private key |

### One-time VPS Setup

```bash
# On your local machine — generate a dedicated deploy keypair (no passphrase):
ssh-keygen -t ed25519 -f ~/.ssh/deploy_vps -N ""

# On the VPS — authorize the public key:
cat ~/.ssh/deploy_vps.pub >> ~/.ssh/authorized_keys  # or use ssh-copy-id

# In GitHub repo — Settings > Secrets > Actions > New secret:
# VPS_SSH_PRIVATE_KEY = cat ~/.ssh/deploy_vps
```

### AI-Writer CI/CD (same pattern, different repo)

Add `.github/workflows/deploy-vps.yml` to the AI-Writer repo with the same secrets but target `AI-Writer/` directory. The two workflows are independent — each deploys its own service only. The shared compose file is what ties them together at the VPS level.

```yaml
# In AI-Writer repo deploy workflow, change the script to:
script: |
  set -e
  cd /srv/tevero/AI-Writer
  git pull origin main
  cd /srv/tevero/open-seo-main
  docker compose -f docker-compose.vps.yml up --build ai-writer-frontend ai-writer-backend -d
  docker image prune -f
```

This rebuilds only the AI-Writer services without touching open-seo or postgres.

---

## 5. Environment Variable Management

### Strategy

- All secrets live in `.env.*` files on the VPS only — never committed to git
- `docker-compose.vps.yml` is committed — it references env var names but not values
- Each service gets only the env vars it needs (principle of least privilege)
- Provide `.env.example.*` files in the repo to document required vars

### File layout on VPS

```
/srv/tevero/open-seo-main/
├── .env.open-seo          ← open-seo secrets (not committed)
├── .env.ai-writer         ← ai-writer secrets (not committed)
├── .env.open-seo.example  ← template (committed, no values)
└── .env.ai-writer.example ← template (committed, no values)
```

### .env.open-seo (all values required on VPS)

```bash
# Database
DATABASE_URL=postgresql://open_seo:REPLACE@postgres:5432/open_seo
OPEN_SEO_DB_PASSWORD=REPLACE

# Redis (BullMQ + KV)
REDIS_URL=redis://:REPLACE@redis:6379/0
REDIS_PASSWORD=REPLACE

# Auth
BETTER_AUTH_SECRET=REPLACE
BETTER_AUTH_URL=https://seo.yourdomain.com

# External APIs
DATAFORSEO_API_KEY=REPLACE

# Cloudflare R2 (kept as HTTP SDK — no binding needed)
CLOUDFLARE_ACCOUNT_ID=REPLACE
R2_ACCESS_KEY_ID=REPLACE
R2_SECRET_ACCESS_KEY=REPLACE
R2_BUCKET_NAME=REPLACE
R2_ENDPOINT=https://ACCOUNTID.r2.cloudflarestorage.com

# Billing
AUTUMN_SECRET_KEY=REPLACE
```

### .env.ai-writer (all values required on VPS)

```bash
# Database
POSTGRES_PASSWORD=REPLACE

# Redis
REDIS_URL=redis://:REPLACE@redis:6379/1

# Auth (Clerk)
REACT_APP_CLERK_PUBLISHABLE_KEY=REPLACE
CLERK_SECRET_KEY=REPLACE

# Other AI-Writer secrets
OPENAI_API_KEY=REPLACE
```

### Shared secrets (postgres password, redis password)

These must be consistent between `docker-compose.vps.yml` environment blocks and both `.env.*` files. Use the same variable names:

```bash
# In docker-compose.vps.yml, postgres service:
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

# In .env.open-seo and .env.ai-writer both reference the same postgres instance
# but with separate DB users/passwords, so the superuser POSTGRES_PASSWORD
# only needs to be in the compose file's env, not in app env files.
```

To pass shared vars to docker compose without duplicating files, create a `.env` at the root of `open-seo-main/` (the compose working directory) for compose-level interpolation:

```bash
# /srv/tevero/open-seo-main/.env  (compose interpolation file — not committed)
POSTGRES_PASSWORD=REPLACE
OPEN_SEO_DB_PASSWORD=REPLACE
REDIS_PASSWORD=REPLACE
REACT_APP_CLERK_PUBLISHABLE_KEY=REPLACE
REACT_APP_DISABLE_SUBSCRIPTION=false
```

Docker Compose automatically reads `.env` in the working directory for `${VAR}` interpolation in the compose file itself. Per-service env_file (`.env.open-seo`, `.env.ai-writer`) passes those vars into the container's environment.

### Dockerfile for open-seo (production Node.js, replacing current Dockerfile.selfhost)

The current `Dockerfile.selfhost` runs `vite preview` which is **not production-grade** and uses the Cloudflare plugin. After migrating to the Node adapter, use this:

```dockerfile
# Dockerfile.vps — multi-stage build for open-seo production Node.js
FROM node:22-alpine AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build output goes to .output/server/index.mjs (Nitro/Node adapter)
RUN pnpm run build

# ── Production stage ────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Copy only the built output — no dev dependencies in production image
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./

EXPOSE 3001

# Run Drizzle migrations then start the server
CMD ["sh", "-c", "node .output/server/index.mjs"]
```

Note: Drizzle migrations should be run as a separate `docker compose run` step in CI before `up --build`, not baked into the container CMD. This avoids the case where a failed migration kills the main container.

```yaml
# In the deploy workflow, before `up --build`:
docker compose -f docker-compose.vps.yml run --rm open-seo \
  node -e "require('./src/db/migrate.js')"
# Or use drizzle-kit migrate via a dedicated migration entrypoint
```

---

## Component Boundaries

| Component | Responsibility | Network Dependencies |
|-----------|---------------|----------------------|
| nginx | TLS termination, subdomain routing, ACME challenge | open-seo, ai-writer-frontend, ai-writer-backend |
| certbot | Certificate issuance and renewal | nginx (shared volumes) |
| open-seo | TanStack Start SSR app, BullMQ job queue, Drizzle ORM | postgres (open_seo db), redis (db 0) |
| ai-writer-frontend | CRA React SPA, served as static files | None (static) |
| ai-writer-backend | FastAPI, SQLAlchemy/Alembic | postgres (alwrity db), redis (db 1) |
| postgres | Two logical databases (open_seo, alwrity) | None |
| redis | BullMQ queues (db 0) + FastAPI cache (db 1) | None |

Redis database isolation: open-seo uses `redis://…/0`, AI-Writer backend uses `redis://…/1`. Same instance, zero interference.

---

## Architecture Diagram

```
Internet
    │
    ▼
[nginx :80/:443]
    │
    ├── seo.yourdomain.com  ──────────────> [open-seo :3001]
    │                                             │
    │                                       ┌─────┴──────┐
    │                                   [postgres]    [redis db 0]
    │                                   open_seo db   BullMQ queues
    │
    └── app.yourdomain.com ──/api/──────> [ai-writer-backend :8000]
                           └─────────> [ai-writer-frontend :80]
                                             │
                                       ┌─────┴──────┐
                                   [postgres]    [redis db 1]
                                   alwrity db    FastAPI cache

[certbot] ──renews certs──> /etc/letsencrypt (shared volume) ──> nginx
```

---

## Scalability Considerations

| Concern | At current scale (1 VPS) | If outgrown |
|---------|--------------------------|-------------|
| Postgres isolation | Two DBs, one container — fine | Split to two PG containers, update URLs |
| Redis contention | Two logical DBs on one instance — fine | Separate Redis containers per app |
| Build time | Both apps build on VPS during deploy — acceptable | Pre-build images in CI, push to GHCR |
| Nginx config | Two conf.d files — trivially extensible | No change needed |
| SSL certs | One certbot container, two certs — fine | No change needed |

---

## Critical Pitfalls

1. **Init scripts run only once.** `docker-entrypoint-initdb.d` scripts are skipped if the postgres data volume already exists. When migrating from the existing AI-Writer compose (which has a `postgres_data` volume for `alwrity`), you must manually create the `open_seo` database. Do not assume the init script will run.

2. **`vite preview` is not a production server.** The current `Dockerfile.selfhost` uses `vite preview`. This must be replaced with `node .output/server/index.mjs` once the Cloudflare Vite plugin is removed and the Nitro Node adapter is in place.

3. **Cloudflare Vite plugin must be removed before building for VPS.** The `@cloudflare/vite-plugin` in `vite.config.ts` targets the Workers runtime. Building with it in place produces a Worker bundle, not a Node.js bundle. Remove it and the `cloudflare()` plugin call before the VPS Dockerfile build step.

4. **`expose:` vs `ports:` in compose.** Internal services must use `expose:` not `ports:`. Using `ports:` for postgres or redis publishes them to `0.0.0.0` on the host, creating security exposure. Only nginx uses `ports:`.

5. **nginx conf.d must not have the old single-file mount.** The existing AI-Writer VPS compose mounts a single file `./nginx/conf.d/app.conf:/etc/nginx/conf.d/default.conf`. The unified compose must mount the entire `conf.d/` directory instead, so nginx loads all virtual host files.

6. **SSH key must be added to `known_hosts` or `StrictHostKeyChecking no` must be set** in the GitHub Actions workflow. `appleboy/ssh-action` handles this automatically but only if the host key is trusted. Add the server's public key to GitHub's `known_hosts` secret or rely on the action's default behavior which disables strict checking (acceptable for single-server deploys).

---

## Sources

- TanStack Start hosting guide: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
- Docker PostgreSQL multiple databases: https://github.com/mrts/docker-postgresql-multiple-databases
- Docker Compose env vars best practices: https://docs.docker.com/compose/how-tos/environment-variables/best-practices/
- Docker Compose secrets: https://docs.docker.com/compose/how-tos/use-secrets/
- appleboy/ssh-action: https://github.com/appleboy/ssh-action
- Nginx multi-domain Docker VPS: https://blog.ssdnodes.com/blog/hosting-multiple-sites-on-a-single-vps-using-docker-nginx-and-certbot/
- Certbot + nginx elegant pattern: https://blog.jarrousse.org/2022/04/09/an-elegant-way-to-use-docker-compose-to-obtain-and-renew-a-lets-encrypt-ssl-certificate-with-certbot-and-configure-the-nginx-service-to-use-it/
- GitHub Actions SSH Docker Compose: https://docs.servicestack.net/ssh-docker-compose-deploment
- Automated Docker Compose deployment: https://ecostack.dev/posts/automated-docker-compose-deployment-github-actions/
- Existing AI-Writer compose reference: /home/dominic/Documents/TeveroSEO/AI-Writer/docker-compose.yml
- Existing AI-Writer nginx config: /home/dominic/Documents/TeveroSEO/AI-Writer/nginx/conf.d/app.conf
- Existing AI-Writer certbot bootstrap: /home/dominic/Documents/TeveroSEO/AI-Writer/certbot/init-letsencrypt.sh
