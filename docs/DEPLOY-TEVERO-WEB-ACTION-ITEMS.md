# Tevero Web (apps/web) Deployment - Human Action Items

**Domain**: `seowith.tevero.lt`  
**Status**: Code ready, pending VPS setup

---

## Pre-Deployment Checklist

### 1. DNS Configuration (Required)

Add an A record pointing `seowith.tevero.lt` to your VPS IP address.

```
Type: A
Name: seowith
Value: <VPS_IP_ADDRESS>
TTL: 300 (or default)
```

**Verify**: `dig seowith.tevero.lt +short` should return your VPS IP.

---

### 2. SSL Certificate (Required)

SSH to VPS and generate Let's Encrypt certificate:

```bash
ssh deploy@<VPS_HOST>

# Stop nginx temporarily (it's using port 80)
cd /home/deploy/TeveroSEO
docker compose -f docker-compose.vps.yml stop nginx

# Generate certificate
sudo certbot certonly --standalone -d seowith.tevero.lt

# Verify certificate exists
ls -la /etc/letsencrypt/live/seowith.tevero.lt/

# Restart nginx
docker compose -f docker-compose.vps.yml start nginx
```

**Expected files**:
- `/etc/letsencrypt/live/seowith.tevero.lt/fullchain.pem`
- `/etc/letsencrypt/live/seowith.tevero.lt/privkey.pem`

---

### 3. VPS .env File (Verify)

Ensure these variables exist in `/home/deploy/TeveroSEO/.env`:

```bash
# Already should exist (used by other services)
CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
```

No new variables required - tevero-web reuses existing Clerk credentials.

---

### 4. Auto-Renewal Cron (Recommended)

Add certbot auto-renewal for the new domain:

```bash
# Edit crontab
sudo crontab -e

# Add this line (renews at 3am daily, reloads nginx on success)
0 3 * * * certbot renew --quiet && docker exec $(docker ps -qf name=nginx) nginx -s reload
```

---

## Deployment

Once the above steps are complete, push to `main` branch. The GitHub Actions workflow will:

1. SSH to VPS
2. Pull latest code
3. Build and start `tevero-web` container
4. Verify health check passes

**Monitor**: Go to GitHub Actions → `deploy-web` workflow to watch progress.

---

## Post-Deployment Verification

```bash
# Check container is healthy
ssh deploy@<VPS_HOST>
docker compose -f /home/deploy/TeveroSEO/docker-compose.vps.yml ps tevero-web

# Test health endpoint
curl -s https://seowith.tevero.lt/api/health
# Expected: {"status":"healthy"}

# Test frontend loads
curl -sI https://seowith.tevero.lt/ | head -5
# Expected: HTTP/2 200
```

---

## Rollback (If Needed)

```bash
ssh deploy@<VPS_HOST>
cd /home/deploy/TeveroSEO

# Revert to previous commit
git checkout HEAD~1

# Rebuild container
docker compose -f docker-compose.vps.yml up -d --build tevero-web
```

---

## Files Created/Modified

| File | Change |
|------|--------|
| `apps/web/Dockerfile` | Created - multi-stage Next.js 15 build |
| `apps/web/app/api/health/route.ts` | Created - health check endpoint |
| `apps/web/next.config.ts` | Modified - added `outputFileTracingRoot` for monorepo |
| `.github/workflows/deploy-web.yml` | Created - GitHub Actions deployment |
| `docker-compose.vps.yml` | Modified - added tevero-web service |
| `docker/nginx/nginx.conf` | Modified - added seowith.tevero.lt server block |

---

## Architecture

```
GitHub push → deploy-web.yml → SSH to VPS → docker compose up tevero-web

nginx:443
  └── seowith.tevero.lt → tevero-web:3002 (Next.js 15)
                              ├── → ai-writer-backend:8000 (server-side)
                              └── → open-seo:3001 (server-side)
```
