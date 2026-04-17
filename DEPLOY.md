# TeveroSEO — VPS Deployment Guide

## What you're deploying

One platform at **`app.tevero.lt`**. Users log in once, switch clients, write content, and run SEO audits — all in the same browser tab.

Internally the platform runs two backend processes (AI-Writer FastAPI and open-seo Node.js), but that is hidden behind nginx. You only interact with one URL.

### Why there are two DNS records

`app.tevero.lt` is the app users visit. `seo.tevero.lt` is backend plumbing.

The SEO audit view loads open-seo inside an iframe. Browsers require that iframe to be served over HTTPS on its own hostname — a different port on the same domain doesn't satisfy the requirement. So `seo.tevero.lt` exists purely so the iframe has a valid SSL cert. Users never type it; the app injects it automatically when you click "SEO Audit" in the sidebar.

A future refactor (routing `/seo/*` through nginx as a reverse proxy) would eliminate `seo.tevero.lt` entirely. Until then, two DNS records are needed.

---

## Prerequisites

- Ubuntu 22.04 VPS with root access
- Domain `tevero.lt` with DNS managed (Cloudflare or registrar)
- GitHub repository with Actions enabled
- Clerk account (free tier is fine — used by AI-Writer for auth)

---

## Step 1 — DNS records

In your DNS provider, add two A records pointing to your VPS IP:

| Name | Type | Value | TTL |
|------|------|-------|-----|
| `app` | A | `<VPS_IP>` | 300 |
| `seo` | A | `<VPS_IP>` | 300 |

Verify propagation before continuing (usually 2–5 min on Cloudflare):

```bash
dig +short app.tevero.lt   # should return your VPS IP
dig +short seo.tevero.lt   # should return your VPS IP
```

---

## Step 2 — VPS initial setup (run once as root)

```bash
# Install dependencies
apt update && apt install -y docker.io docker-compose-plugin git certbot

# Create a dedicated deploy user in the docker group
useradd -m -s /bin/bash deploy
usermod -aG docker deploy

# Authorise your SSH key for the deploy user
mkdir -p /home/deploy/.ssh
echo "ssh-ed25519 AAAA...your_public_key..." >> /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

Test that the deploy user can use Docker without sudo:

```bash
su - deploy -c "docker ps"
```

---

## Step 3 — Clone the repository

```bash
su - deploy
git clone https://github.com/MartianDominic/TeveroSEO /home/deploy/TeveroSEO
cd /home/deploy/TeveroSEO
```

---

## Step 4 — Update domain references

The nginx config and env example were written with placeholder domains. Replace them with your actual domains:

```bash
cd /home/deploy/TeveroSEO

# nginx config — replace placeholder domains
sed -i 's/app\.openseo\.so/seo.tevero.lt/g'   docker/nginx/nginx.conf
sed -i 's/app\.alwrity\.com/app.tevero.lt/g'   docker/nginx/nginx.conf

# Verify
grep "server_name" docker/nginx/nginx.conf
# Expected output:
#   server_name seo.tevero.lt;   (appears twice — HTTP redirect + HTTPS)
#   server_name app.tevero.lt;   (appears twice — HTTP redirect + HTTPS)
```

---

## Step 5 — Create the environment file

```bash
cp .env.vps.example .env.vps
```

Open `.env.vps` and fill in every value. Generate passwords with `openssl rand -base64 32`.

```env
# Postgres
POSTGRES_PASSWORD=<strong-random-password>
OPEN_SEO_DB_PASSWORD=<strong-random-password>
ALWRITY_DB_PASSWORD=<strong-random-password>

# open-seo auth (better-auth)
BETTER_AUTH_SECRET=<strong-random-secret>
BETTER_AUTH_URL=https://seo.tevero.lt
OPEN_SEO_AUTH_MODE=hosted

# open-seo cross-service DB access (reads AI-Writer's clients table)
ALWRITY_DATABASE_URL=postgresql://alwrity_user:<ALWRITY_DB_PASSWORD>@postgres:5432/alwrity

# AI-Writer
ENVIRONMENT=production
ALLOW_UNVERIFIED_JWT_DEV=false
DISABLE_SUBSCRIPTION=true
CLERK_SECRET_KEY=sk_live_...          # from Clerk dashboard → API Keys
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_live_...  # from Clerk dashboard → API Keys
REACT_APP_DISABLE_SUBSCRIPTION=true
REACT_APP_SEO_AUDIT_URL=https://seo.tevero.lt  # iframe points here

# Domain
AI_WRITER_DOMAIN=app.tevero.lt
```

`CLERK_SECRET_KEY` and `REACT_APP_CLERK_PUBLISHABLE_KEY` come from your Clerk dashboard under **Configure → API Keys**.

---

## Step 6 — Issue SSL certificates

Certbot needs port 80 free. The Docker stack isn't running yet so nothing is blocking it.

```bash
# Stop the system nginx if it's running (usually it isn't on a fresh VPS)
systemctl stop nginx 2>/dev/null || true

# Issue cert for the main app
certbot certonly --standalone \
  -d app.tevero.lt \
  --non-interactive --agree-tos \
  -m you@tevero.lt

# Issue cert for the SEO engine
certbot certonly --standalone \
  -d seo.tevero.lt \
  --non-interactive --agree-tos \
  -m you@tevero.lt
```

Now update nginx to reference the new cert paths (the current config still has the placeholder domain names in the cert paths):

```bash
sed -i 's|live/app\.openseo\.so|live/seo.tevero.lt|g'   docker/nginx/nginx.conf
sed -i 's|live/app\.alwrity\.com|live/app.tevero.lt|g'   docker/nginx/nginx.conf

# Verify
grep "ssl_certificate" docker/nginx/nginx.conf
# Expected:
#   ssl_certificate /etc/letsencrypt/live/seo.tevero.lt/fullchain.pem;
#   ssl_certificate /etc/letsencrypt/live/app.tevero.lt/fullchain.pem;
```

Download the Let's Encrypt options files nginx requires:

```bash
test -f /etc/letsencrypt/options-ssl-nginx.conf || \
  curl -sO https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
  --output-dir /etc/letsencrypt/

test -f /etc/letsencrypt/ssl-dhparams.pem || \
  curl -sO https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
  --output-dir /etc/letsencrypt/
```

---

## Step 7 — Commit the domain changes

The nginx config changes need to be in the repo so future `git pull` deployments pick them up.

```bash
cd /home/deploy/TeveroSEO
git add docker/nginx/nginx.conf
git commit -m "chore: set production domains (app.tevero.lt, seo.tevero.lt)"
git push
```

---

## Step 8 — First deployment

```bash
cd /home/deploy/TeveroSEO

# Build all images (5–10 min first time)
docker compose -f docker-compose.vps.yml --env-file .env.vps build

# Run database migrations before the app starts
docker compose -f docker-compose.vps.yml --env-file .env.vps \
  --profile migrate run --rm open-seo-migrate

# Start all 7 services
docker compose -f docker-compose.vps.yml --env-file .env.vps up -d
```

---

## Step 9 — Verify everything is healthy

```bash
# All 7 services should reach "healthy" within ~60 seconds
docker compose -f docker-compose.vps.yml --env-file .env.vps ps

# Smoke tests
curl https://seo.tevero.lt/healthz
# → {"status":"ok"}

curl https://app.tevero.lt/api/health
# → {"status":"ok"}
```

Open `https://app.tevero.lt` in a browser. You should see the AI-Writer login page.

---

## Step 10 — GitHub Actions auto-deploy

Every push to `main` auto-deploys to the VPS. The workflow requires four secrets.

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Your VPS IP address |
| `VPS_USER` | `deploy` |
| `VPS_SSH_PRIVATE_KEY` | Your ed25519 private key (the file content, not the path) |
| `KNOWN_HOSTS` | Output of `ssh-keyscan -H <VPS_IP>` (run this on any machine) |

To get `KNOWN_HOSTS`:

```bash
ssh-keyscan -H <VPS_IP>
# Copy the entire output as the secret value
```

After adding secrets, test by pushing a trivial change to `open-seo-main/`. The Actions tab should show a green `deploy-vps` run within a few minutes.

**What the workflow does on each push:**
1. SSH into the VPS as `deploy`
2. `git reset --hard origin/main` — pulls latest code
3. Runs DB migrations (`open-seo-migrate`) before swapping containers
4. Rebuilds and restarts only `open-seo` and `open-seo-worker` — postgres, redis, nginx, and AI-Writer keep running uninterrupted
5. Polls Docker healthchecks for 90 seconds to confirm healthy

AI-Writer deploys via a separate parallel workflow (`deploy-ai-writer.yml`) triggered by changes under `AI-Writer/`.

---

## Step 11 — Auto-renew SSL certificates

```bash
# Test that renewal works
certbot renew --dry-run

# Add a cron job: renew at 3am daily, reload nginx on success
cat > /etc/cron.d/certbot-renew << 'EOF'
0 3 * * * root certbot renew --quiet && \
  docker compose -f /home/deploy/TeveroSEO/docker-compose.vps.yml \
  --env-file /home/deploy/TeveroSEO/.env.vps \
  kill -s HUP nginx
EOF
```

---

## Architecture summary

```
Browser → app.tevero.lt (nginx :443)
           ├── /api/*          → ai-writer-backend:8000  (FastAPI)
           ├── /               → ai-writer-frontend:80   (React SPA)
           └── (iframe loads) seo.tevero.lt (nginx :443)
                               └── /                → open-seo:3001 (Node.js)

Internal network (no external ports):
  postgres:5432  — shared DB (alwrity + open_seo databases)
  redis:6379     — shared cache/queue
```

The user sees one app at one URL. The `seo.tevero.lt` hostname is an implementation detail that exists because browsers require iframes to have their own HTTPS certificate.

---

## Troubleshooting

**Services not healthy after startup:**
```bash
docker compose -f docker-compose.vps.yml --env-file .env.vps logs --tail=50 <service-name>
```

**nginx SSL errors:**
Check cert paths match exactly: `grep ssl_certificate docker/nginx/nginx.conf`

**Migrations failing:**
```bash
docker compose -f docker-compose.vps.yml --env-file .env.vps \
  --profile migrate run --rm open-seo-migrate
# Read the output — usually a missing env var or DB not yet healthy
```

**GitHub Actions failing on SSH:**
- Confirm `KNOWN_HOSTS` was generated with `ssh-keyscan -H <IP>` (the `-H` flag hashes the hostname — required)
- Confirm the deploy user's `authorized_keys` contains the public half of `VPS_SSH_PRIVATE_KEY`
