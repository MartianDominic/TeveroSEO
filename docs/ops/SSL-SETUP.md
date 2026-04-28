# SSL/TLS Certificate Management

## Architecture

- **nginx** terminates SSL on ports 80/443
- **Certbot** manages Let's Encrypt certificates
- **Volumes**: `letsencrypt_conf` (certs), `letsencrypt_www` (ACME challenges)

Domains: `app.openseo.so`, `app.alwrity.com`, `seowith.tevero.lt`

## Initial Certificate Issuance

Run certbot in standalone mode before starting nginx (port 80 must be free):

```bash
# Stop nginx if running
docker compose -f docker-compose.vps.yml stop nginx

# Issue certificates for all domains
docker run --rm -it \
  -v teveroseo_letsencrypt_conf:/etc/letsencrypt \
  -v teveroseo_letsencrypt_www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d app.openseo.so -d app.alwrity.com -d seowith.tevero.lt \
  --agree-tos --email admin@tevero.lt --non-interactive

# Start nginx
docker compose -f docker-compose.vps.yml up -d nginx
```

For a single new domain:

```bash
docker run --rm -it \
  -v teveroseo_letsencrypt_conf:/etc/letsencrypt \
  -v teveroseo_letsencrypt_www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d NEW_DOMAIN.example.com \
  --agree-tos --email admin@tevero.lt --non-interactive
```

## Certificate Renewal

Add to VPS crontab (`crontab -e`):

```cron
0 3 * * * docker run --rm -v teveroseo_letsencrypt_conf:/etc/letsencrypt -v teveroseo_letsencrypt_www:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot --quiet && docker exec teveroseo-nginx-1 nginx -s reload
```

This runs daily at 3 AM. Certbot only renews certs expiring within 30 days.

## Adding a New Domain

1. **DNS**: Point domain to VPS IP (A record)
2. **nginx.conf**: Add HTTP/HTTPS server blocks (copy existing pattern)
3. **Issue cert**: Use standalone command above
4. **Restart nginx**: `docker compose -f docker-compose.vps.yml restart nginx`

## Troubleshooting

### Certificate not found

```bash
# List issued certificates
docker run --rm -v teveroseo_letsencrypt_conf:/etc/letsencrypt certbot/certbot certificates
```

### ACME challenge fails

```bash
# Verify nginx serves challenge directory
curl -I http://DOMAIN/.well-known/acme-challenge/test

# Check nginx logs
docker logs teveroseo-nginx-1 --tail 50
```

### SSL handshake errors

```bash
# Verify cert paths match nginx.conf
docker exec teveroseo-nginx-1 ls -la /etc/letsencrypt/live/

# Test SSL config
docker exec teveroseo-nginx-1 nginx -t
```

### Force renewal

```bash
docker run --rm -v teveroseo_letsencrypt_conf:/etc/letsencrypt certbot/certbot renew --force-renewal
docker exec teveroseo-nginx-1 nginx -s reload
```

### Missing SSL options file

If `/etc/letsencrypt/options-ssl-nginx.conf` is missing, download Let's Encrypt defaults:

```bash
docker exec teveroseo-nginx-1 sh -c \
  "curl -sSL https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > /etc/letsencrypt/options-ssl-nginx.conf"
```
