# Phase 95: Environment Variables

Required environment variables for the Unified Scraping Infrastructure.

## Geonode Residential Proxies

```env
# Geonode proxy endpoint
GEONODE_HOST=proxy.geonode.io
GEONODE_PORT=9000

# Username format: geonode_{user_id}-type-{proxy_type}
# The -type-residential suffix is PART OF the username, not a parameter
# When adding geo-targeting/sessions, append AFTER -type-residential
GEONODE_USERNAME=geonode_y9ZVNlVjdE-type-residential
GEONODE_PASSWORD=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Port Reference

| Port Range | Session Type | Use Case |
|------------|--------------|----------|
| 9000-9010 | Rotating | SERP scraping, price monitoring |
| 10000-10900 | Sticky | Site crawls, authenticated sessions |

### Username Parameter Append Order

Parameters are appended to the username (which already has `-type-residential`):

```
{base_username}-country-{code}-city-{name}-session-{id}-lifetime-{minutes}
```

**Examples:**
```
# Rotating US exit
geonode_y9ZVNlVjdE-type-residential-country-us

# Sticky NYC, 60-minute session
geonode_y9ZVNlVjdE-type-residential-country-us-city-newyork-session-crawl001-lifetime-60
```

## Webshare (Free Tier)

```env
# 10 free DC proxies per month, 1GB bandwidth
WEBSHARE_API_KEY=your_api_key_here
```

## DataForSEO

```env
# Existing API key
DATAFORSEO_LOGIN=your_login
DATAFORSEO_PASSWORD=your_password
```

## Camoufox Pool Configuration

```env
# Browser pool sizing (defaults for 24GB RAM VPS)
CAMOUFOX_MAX_INSTANCES=15        # Max concurrent browser instances
CAMOUFOX_MAX_REQUESTS=100        # Recycle instance after N requests
CAMOUFOX_MAX_AGE_MINUTES=30      # Recycle instance after N minutes
```

## Complete .env Example

```env
# === Geonode (Residential Proxies) ===
GEONODE_HOST=proxy.geonode.io
GEONODE_PORT=9000
GEONODE_USERNAME=geonode_y9ZVNlVjdE-type-residential
GEONODE_PASSWORD=34000f84-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# === Webshare (Free DC Proxies) ===
WEBSHARE_API_KEY=xxx

# === DataForSEO ===
DATAFORSEO_LOGIN=xxx
DATAFORSEO_PASSWORD=xxx

# === Camoufox Browser Pool ===
CAMOUFOX_MAX_INSTANCES=15
CAMOUFOX_MAX_REQUESTS=100
CAMOUFOX_MAX_AGE_MINUTES=30
```

## Security Notes

1. **Never commit actual credentials** - Use `.env.local` or secrets manager
2. **Rotate credentials** if exposed in logs or error messages
3. **Monitor bandwidth** - Geonode charges per GB ($0.77/GB on 50GB plan)
