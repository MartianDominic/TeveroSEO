# TeveroSEO Pixel Integration Guide

> Complete guide for integrating the TeveroSEO analytics pixel on your website.

## Quick Start

Add this single line to your website's `<head>` section:

```html
<script async src="https://pixel.tevero.io/t.js" data-site="YOUR_SITE_ID"></script>
```

Replace `YOUR_SITE_ID` with your unique site identifier from the TeveroSEO dashboard.

That's it! The pixel will start collecting analytics immediately.

## What the Pixel Collects

| Data Type | Description | Example |
|-----------|-------------|---------|
| Pageviews | Page URL, referrer, timestamp | `/products`, `google.com` |
| Sessions | Unique visitor tracking via anonymous session ID | `sess_abc123` |
| Core Web Vitals | LCP, CLS, INP performance metrics | LCP: 2.1s |
| Scroll Depth | How far users scroll (25%, 50%, 75%, 100%) | 75% |
| Clicks | CTA and link click tracking | `a.signup-btn` |

### Privacy First

- **No cookies** - The pixel does not set any cookies
- **No PII** - We do not collect personal information
- **Anonymous sessions** - Session IDs are randomly generated
- **EU data processing** - All data processed in GDPR-compliant EU data centers
- **Data retention** - Raw events purged after 90 days; aggregates kept for 2 years

## Features

### Real-Time Analytics

View traffic and engagement metrics in your dashboard within seconds of page loads.

### Core Web Vitals Monitoring

Monitor your site's performance using Google's Core Web Vitals metrics:

- **LCP (Largest Contentful Paint)** - Loading performance
- **CLS (Cumulative Layout Shift)** - Visual stability
- **INP (Interaction to Next Paint)** - Interactivity

All metrics are calculated at the p75 (75th percentile) level, matching Google's methodology.

### SEO DOM Modifications

With your approval, TeveroSEO can apply SEO improvements directly to your pages:

- Meta title and description updates
- Schema markup injection
- Canonical URL management
- Open Graph tag optimization

All changes require explicit approval in the dashboard before going live.

## Installation Methods

### Method 1: Direct HTML (Recommended)

Add the script tag directly to your HTML `<head>`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your Website</title>
  
  <!-- TeveroSEO Pixel -->
  <script async src="https://pixel.tevero.io/t.js" data-site="YOUR_SITE_ID"></script>
  
  <!-- Your other head content -->
</head>
<body>
  <!-- Page content -->
</body>
</html>
```

### Method 2: Google Tag Manager

1. In GTM, create a new **Custom HTML** tag
2. Paste the script:
   ```html
   <script async src="https://pixel.tevero.io/t.js" data-site="YOUR_SITE_ID"></script>
   ```
3. Set trigger: **All Pages**
4. Publish your container

### Method 3: npm Package (SPAs)

For React, Vue, or other SPA frameworks:

```bash
npm install @tevero/pixel
```

```typescript
// React example
import { TeveroPixel } from '@tevero/pixel';

function App() {
  return (
    <>
      <TeveroPixel siteId="YOUR_SITE_ID" />
      {/* Your app */}
    </>
  );
}
```

## Advanced Configuration

### Disable Core Web Vitals

If you only want pageview tracking without CWV monitoring:

```html
<script 
  async 
  src="https://pixel.tevero.io/t.js" 
  data-site="YOUR_SITE_ID"
  data-no-cwv="true"
></script>
```

### Disable Click Tracking

```html
<script 
  async 
  src="https://pixel.tevero.io/t.js" 
  data-site="YOUR_SITE_ID"
  data-no-clicks="true"
></script>
```

### Disable Scroll Tracking

```html
<script 
  async 
  src="https://pixel.tevero.io/t.js" 
  data-site="YOUR_SITE_ID"
  data-no-scroll="true"
></script>
```

### Custom Events

Track custom events from your JavaScript:

```javascript
// After pixel is loaded
window.tevero?.track('signup_complete', {
  plan: 'pro',
  source: 'homepage'
});
```

### SPA Route Changes

The pixel automatically detects History API navigation. For frameworks that don't use the History API, manually notify route changes:

```javascript
// Call after route change
window.tevero?.pageview('/new-route');
```

## Platform-Specific Guides

### WordPress

Two options:

**Option A: Plugin (Recommended)**
1. Install "Insert Headers and Footers" plugin
2. Go to Settings > Insert Headers and Footers
3. Paste the script in the "Header" section
4. Save

**Option B: Theme Editor**
1. Go to Appearance > Theme File Editor
2. Select `header.php`
3. Paste script before `</head>`
4. Save (Note: theme updates will overwrite)

See: [WordPress Installation](./cms-script-installation-guide.md#wordpress-self-hosted)

### Shopify

1. Go to Online Store > Themes
2. Click Actions > Edit code
3. Open `theme.liquid` in Layout folder
4. Paste script before `</head>`
5. Save

See: [Shopify Installation](./cms-script-installation-guide.md#shopify)

### Wix

1. Go to Settings > Custom Code
2. Click "+ Add Code"
3. Paste script, select "Head", "All pages"
4. Apply

*Requires Premium plan*

See: [Wix Installation](./cms-script-installation-guide.md#wix)

### Squarespace

1. Go to Settings > Advanced > Code Injection
2. Paste script in "Header" field
3. Save

*Requires Business plan*

See: [Squarespace Installation](./cms-script-installation-guide.md#squarespace)

### Other Platforms

See our comprehensive [CMS Installation Guide](./cms-script-installation-guide.md) for:
- Webflow
- Weebly
- GoDaddy
- HubSpot CMS
- Ghost
- BigCommerce
- WooCommerce
- Magento

## Verification

After installation, verify the pixel is working:

1. Visit your website in a new browser tab
2. Return to TeveroSEO dashboard
3. Check "Connection Status" - should show "Connected"
4. View real-time analytics to confirm data is flowing

### Troubleshooting

**Pixel not detected:**
- Ensure script is in `<head>`, not `<body>`
- Verify `data-site` attribute matches your Site ID
- Check browser console for errors
- Disable ad blockers temporarily

**Missing CWV data:**
- CWV requires real user interactions (not just page loads)
- Wait 24 hours for sufficient data
- Ensure `data-no-cwv` is not set

**Double pageviews:**
- Check for duplicate script tags
- If using GTM, ensure direct script is removed

## Script Size & Performance

| Metric | Value |
|--------|-------|
| Script size (gzipped) | < 5KB |
| Script load time | < 100ms |
| First pageview latency | < 10ms |
| Memory footprint | < 1MB |

The pixel is designed to have minimal impact on your site's performance:
- **Async loading** - Does not block page rendering
- **Lazy CWV** - Web Vitals measured after load complete
- **Batched events** - Multiple events sent in single request
- **No external dependencies** - Self-contained, no jQuery required

## Data Access

### Dashboard

Access your analytics at: `https://app.tevero.io/dashboard/pixel/analytics`

### API

Fetch analytics programmatically:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://api.tevero.io/pixel/YOUR_SITE_ID/analytics?startDate=2026-04-01&endDate=2026-05-01"
```

See: [Platform Connection API](./platform-connection-api.md)

## Security

### Content Security Policy (CSP)

If your site uses CSP headers, add these directives:

```
script-src 'self' https://pixel.tevero.io;
connect-src 'self' https://api.tevero.io;
```

### Subresource Integrity (SRI)

For maximum security, use SRI with pinned hash:

```html
<script 
  async 
  src="https://pixel.tevero.io/t.js"
  data-site="YOUR_SITE_ID"
  integrity="sha384-[CURRENT_HASH]"
  crossorigin="anonymous"
></script>
```

Get the current hash from your dashboard settings.

## FAQ

**Q: Does the pixel affect my SEO?**
A: No. The pixel is async and does not affect Core Web Vitals or page speed scores.

**Q: Is it GDPR compliant?**
A: Yes. We don't collect PII, don't set cookies, and process all data in EU data centers.

**Q: Can I use it alongside Google Analytics?**
A: Yes. The TeveroSEO pixel works independently and does not conflict with GA.

**Q: What happens if my site goes down?**
A: The pixel gracefully handles errors. If your site is down, we simply don't receive events.

**Q: How long does it take to see data?**
A: Pageview data appears within seconds. CWV data requires real user visits (typically 24 hours for meaningful metrics).

## Support

Need help? Contact us:

- **Documentation:** https://docs.tevero.io
- **Email:** support@tevero.io
- **In-app chat:** Click the help icon in your dashboard

---

*Last updated: May 2026*
