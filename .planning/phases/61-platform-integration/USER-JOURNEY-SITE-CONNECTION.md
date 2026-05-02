# User Journey: Connecting a Site to TeveroSEO

## Overview

This document defines the complete user journey for connecting a website to TeveroSEO, with multiple paths tailored to different user types and technical capabilities.

---

## User Types

| Type | Description | Technical Level | Needs |
|------|-------------|-----------------|-------|
| **Technical Founder** | Can paste code, understands APIs | High | Direct API docs, copy-paste snippets |
| **Marketing Manager** | Knows their CMS, not code | Medium | Platform-specific guides with screenshots |
| **Business Owner** | Scared of technical stuff | Low | Developer handoff option, reassurance |
| **Developer** | Wants API docs, automation | Expert | REST API, OAuth docs, SDK |

---

## User Journey Decision Tree

```
[START] "Add Site" button clicked
    |
    v
[STEP 1] Enter website URL (domain only required)
    |
    |-- Input: "example.com" or "https://example.com"
    |-- Validation: URL format check
    |
    v
[STEP 2] Auto-detect CMS platform (15s timeout)
    |
    |-- WordPress: /wp-json/ API, /wp-content/, generator meta
    |-- Shopify: cdn.shopify.com, .myshopify.com
    |-- Wix: wixstatic.com, parastorage.com
    |-- Squarespace: static.squarespace.com, generator meta
    |-- Webflow: webflow.io, assets-global.website-files.com
    |-- Custom: No platform detected
    |
    v
[STEP 3] Show detection result with confidence indicator
    |
    +-- [HIGH CONFIDENCE] Platform detected with strong signals
    |       |
    |       v
    |   "We detected your site runs on [Platform]. Is this correct?"
    |       |
    |       +-- [YES] --> Continue to connection flow
    |       +-- [NO] --> Manual platform selection
    |
    +-- [LOW/MEDIUM CONFIDENCE] Weak or no signals
    |       |
    |       v
    |   "We couldn't determine your platform. Please select:"
    |       |
    |       v
    |   [WordPress] [Shopify] [Wix] [Squarespace] [Webflow] [Other/Custom]
    |
    v
[STEP 4] Connection method selection
    |
    +------------------------------------------------------+
    |                                                      |
    v                                                      v
[PATH A: DIY - "I'll do it myself"]             [PATH B: Developer Handoff]
    |                                                      |
    v                                                      v
[Platform-specific credential form]              [Generate instructions]
    |                                                      |
    |-- WordPress: Username + App Password                 |-- Email template
    |-- Shopify: Admin API Access Token                   |-- Copy-able instructions
    |-- Wix: Site ID + API Key                            |-- Deadline reminder
    |-- Squarespace: Site ID + API Key                    |
    |-- Webflow: Site ID + API Token                      v
    |-- Custom: Pixel installation                  [Wait for developer]
    |                                                      |
    v                                                      |
[STEP 5] Verify installation                              |
    |                                                      |
    +-- [SUCCESS] --> Connection active                   |
    |                                                      |
    +-- [FAILED] --> Troubleshoot                         |
            |                                              |
            v                                              |
        [STUCK?] --> Fallback to developer handoff -------+
                                                           |
                                                           v
                                              [Verification polling loop]
                                                           |
                                                           v
                                              [SUCCESS] --> Connection active
```

---

## Screen-by-Screen Flow

### Screen 1: URL Entry
| Element | Description |
|---------|-------------|
| Heading | "Add a new site" |
| Input | Domain/URL field with placeholder "example.com" |
| Validation | Realtime URL format validation |
| CTA | "Detect Platform" button |
| Secondary | "Skip detection" link for power users |

### Screen 2: Detection in Progress
| Element | Description |
|---------|-------------|
| Animation | Spinner with pulsing domain name |
| Text | "Analyzing [domain]..." |
| Timeout | 15 seconds max, then fallback to manual |

### Screen 3: Detection Result (High Confidence)
| Element | Description |
|---------|-------------|
| Icon | Platform logo (WordPress, Shopify, etc.) |
| Badge | "High Confidence" chip |
| Message | "We detected [Platform] on [domain]" |
| Signals | Expandable list of detection signals (for curious users) |
| CTA | "Connect [Platform]" button |
| Secondary | "Not [Platform]? Change" link |

### Screen 3b: Detection Result (Low Confidence)
| Element | Description |
|---------|-------------|
| Icon | Question mark or generic globe |
| Message | "We couldn't detect your platform" |
| Grid | Platform selection cards (6 options) |
| Each Card | Platform logo + name + brief description |

### Screen 4: Path Selection
| Element | Description |
|---------|-------------|
| Heading | "How would you like to connect?" |
| Option A | Card: "I'll do it myself" - "Follow our step-by-step guide" |
| Option B | Card: "Pass to developer" - "Generate instructions to send" |
| Estimate | Time estimates shown on each card |

### Screen 5A: DIY - Credential Entry (WordPress example)
| Element | Description |
|---------|-------------|
| Progress | Step indicator: Detect > Connect > Verify |
| Platform | Badge showing "WordPress" |
| Field 1 | "Username" text input |
| Field 2 | "Application Password" password input |
| Help Link | "How to create an Application Password" |
| CTA | "Test Connection" button |
| Info | "Your credentials are encrypted before storage" |

### Screen 5B: Developer Handoff
| Element | Description |
|---------|-------------|
| Heading | "Send to your developer" |
| Tabs | "Email" / "Slack" / "Copy Instructions" |
| Email Tab | Pre-filled email with platform-specific instructions |
| Copy Tab | Markdown/text instructions for copy-paste |
| Include | Magic link for OAuth if applicable |
| CTA | "Send Instructions" or "Copy to Clipboard" |
| Tracking | "We'll notify you when the connection is complete" |

### Screen 6: Verification
| Element | Description |
|---------|-------------|
| Animation | Connection test spinner |
| Steps | Show verification steps as they complete |
| Success | Green checkmark + "Connected successfully!" |
| Failure | Red X + specific error message + "Try again" button |
| Stuck | After 2 failures: "Need help? Pass to developer" |

### Screen 7: Success
| Element | Description |
|---------|-------------|
| Icon | Success checkmark |
| Message | "[Platform] connected successfully!" |
| Stats | "X pages detected, X posts found" (if applicable) |
| Enhancement | "Unlock more features" card (GSC/Analytics OAuth) |
| CTA | "Start SEO Audit" or "Go to Dashboard" |

---

## Platform-Specific Guides

### WordPress
**Method**: Application Password + REST API

**DIY Steps**:
1. Log in to your WordPress admin panel
2. Go to Users > Your Profile
3. Scroll to "Application Passwords"
4. Enter name: "TeveroSEO" and click "Add New"
5. Copy the generated password (spaces are normal)
6. Return to TeveroSEO and enter your username + password

**Time**: 3-5 minutes
**Skill level**: Medium

**Common issues**:
- Plugin conflicts disabling REST API
- Application Passwords disabled by hosting provider
- Multi-site configuration

### Shopify
**Method**: Custom App + Admin API

**DIY Steps**:
1. Go to Settings > Apps and sales channels > Develop apps
2. Click "Create an app" and name it "TeveroSEO"
3. Configure Admin API scopes: read_products, read_content, read_themes
4. Install the app and copy the Admin API access token
5. Enter the token in TeveroSEO

**Time**: 5-7 minutes
**Skill level**: Medium

**OAuth Alternative**: Full OAuth flow available for enhanced features

### Wix
**Method**: API Key + Site ID

**DIY Steps**:
1. Go to your Wix Dashboard
2. Navigate to Dev Center > OAuth Apps
3. Create a new OAuth app or API key
4. Copy the Site ID from your dashboard URL
5. Enter both values in TeveroSEO

**Time**: 5-7 minutes
**Skill level**: Medium

**OAuth Alternative**: Wix OAuth flow available

### Squarespace
**Method**: API Key

**DIY Steps**:
1. Go to Settings > Developer API Keys
2. Click "Generate New API Key"
3. Name it "TeveroSEO" and select read permissions
4. Copy the API key and Site ID
5. Enter both values in TeveroSEO

**Time**: 3-5 minutes
**Skill level**: Easy

### Webflow
**Method**: API Token

**DIY Steps**:
1. Go to Site Settings > Integrations
2. Scroll to "Site API Access"
3. Generate a new API token with read permissions
4. Copy the token and Site ID
5. Enter both values in TeveroSEO

**Time**: 3-5 minutes
**Skill level**: Easy

### Custom/Other
**Method**: Tracking Pixel

**DIY Steps**:
1. Copy the provided JavaScript snippet
2. Paste it before the closing </head> tag on your site
3. Verify installation using our pixel debugger

**Time**: 2-10 minutes (depends on CMS/access)
**Skill level**: Varies

---

## Developer Handoff Email Template

```
Subject: TeveroSEO Setup Request - [SITE_NAME]

Hi [DEVELOPER_NAME],

I need your help connecting [SITE_URL] to TeveroSEO for SEO monitoring.

Platform: [DETECTED_PLATFORM]
What's needed: [PLATFORM_SPECIFIC_REQUIREMENTS]

Option 1: Use this magic link (expires in 7 days):
[MAGIC_LINK_URL]

Option 2: Manual setup:
[PLATFORM_SPECIFIC_INSTRUCTIONS]

After completing the setup, you can verify it works here:
[VERIFICATION_URL]

Please complete this by [DEADLINE] if possible.

Questions? The TeveroSEO team can help at support@tevero.io

Thanks!
[USER_NAME]
```

---

## Edge Cases

### CMS Not Detected
**Cause**: Site uses custom/unknown platform, blocks crawlers, or returns errors

**Handling**:
1. Show manual platform selection UI
2. Include "Custom/Other" option with pixel installation
3. Offer "Not sure? Contact us" support link

### Multiple Domains
**Cause**: Site uses different domains (www vs non-www, staging vs production)

**Handling**:
1. Detection normalizes to canonical domain
2. If multiple found, ask user to confirm primary
3. Support adding multiple domains as separate connections

### Site Behind Password
**Cause**: Staging sites often have HTTP auth or maintenance mode

**Handling**:
1. Detection will fail with auth error
2. Show specific message: "Site requires authentication"
3. Offer: "Add staging credentials" or "Use production instead"

### Site Returns Errors
**Cause**: Site down, SSL issues, firewall blocking

**Handling**:
1. Retry once with different User-Agent
2. Show specific error (SSL expired, timeout, 4xx/5xx)
3. Offer: "Try again later" with retry button

### OAuth Scope Changes
**Cause**: User wants to add Search Console after initial API-only connection

**Handling**:
1. Show "Enhance connection" CTA on dashboard
2. Link to OAuth flow that adds scopes
3. Merge tokens without breaking existing connection

### Developer Never Completes
**Cause**: Instructions sent but no action taken

**Handling**:
1. Track time since handoff
2. Send reminder at 3 days, 7 days
3. Show "Still waiting" status in UI with re-send option
4. Offer to try DIY or contact support

---

## Time Estimates

| Path | Estimated Time | Variables |
|------|----------------|-----------|
| DIY - WordPress | 3-5 minutes | Plugin conflicts, hosting restrictions |
| DIY - Shopify | 5-7 minutes | App approval if needed |
| DIY - Wix | 5-7 minutes | Dev Center familiarity |
| DIY - Squarespace | 3-5 minutes | API key generation |
| DIY - Webflow | 3-5 minutes | Site settings access |
| DIY - Custom/Pixel | 2-10 minutes | CMS access, technical skill |
| Developer Handoff | 1-7 days | Developer availability, complexity |

---

## Enhancement Opportunities (Post-Connection)

After basic connection is established, offer these enhancements:

| Enhancement | Benefit | Trigger |
|-------------|---------|---------|
| Google Search Console OAuth | Keyword rankings, click data | Any connection |
| Google Analytics OAuth | Traffic data, user behavior | Any connection |
| Google Business Profile | Local SEO, reviews | Local business detected |
| Bing Webmaster OAuth | Bing rankings | Enterprise clients |
| Full CMS Write Access | Auto-publish content | Quality gate passed |

---

## Technical Implementation Notes

### Existing Components
- `ConnectionWizard.tsx` - 3-step wizard (Detect > Connect > Verify)
- `PlatformConnectionFlow.tsx` - Platform selection + OAuth handlers
- `PlatformCredentialsForm.tsx` - Dynamic credential forms per platform
- `PlatformDetector.ts` - Multi-probe fingerprinting service

### API Endpoints
- `POST /api/site-connections/detect` - Platform detection
- `POST /api/site-connections` - Create connection
- `POST /api/site-connections/[id]/verify` - Verify connection
- `GET /api/oauth/[platform]/authorize` - Start OAuth flow
- `GET /api/oauth/[platform]/callback` - OAuth callback

### Database Schema
- `site_connections` - Basic API/credential connections
- `platform_connections` - OAuth tokens with status tracking
- `onboarding_checklists` - Track completion steps

### Security
- Credentials encrypted with AES-256-GCM before storage
- OAuth tokens never exposed to frontend
- Rate limiting on detection endpoint (SSRF protection)
- CSRF protection on all state-changing endpoints
