# Vibe-Coded Platform Integration for IndexNow Key Deployment

> **Integration Strategies for AI-Generated Sites**
>
> Created: 2026-05-08
> Status: Research Complete
> Extends: Phase 97 IndexNow System SPEC.md

---

## Executive Summary

TeveroSEO clients increasingly use "vibe-coded" platforms (Bolt.new, v0.dev, Lovable, Replit, etc.) to build AI-generated sites. This document details how to auto-deploy IndexNow API key files to these platforms via their deployment APIs, with fallback to manual instructions.

**Key Insight:** IndexNow requires a verification file at `https://domain.com/{api-key}.txt` containing the key itself. For vibe-coded platforms, we need platform-aware deployment strategies.

---

## 1. Platform Detection Strategies

### 1.1 Detection Methods (Priority Order)

1. **HTTP Response Headers**
   ```
   X-Vercel-Id: iad1::xxxxx              -> Vercel
   X-Netlify:                             -> Netlify (header presence)
   CF-Ray: xxxxxxxx-IAD                   -> Cloudflare (could be Pages or CDN)
   Server: Replit                         -> Replit
   X-Railway-Request-Id:                  -> Railway
   X-Render-Origin-Server:                -> Render
   ```

2. **DNS CNAME Records**
   ```bash
   dig CNAME example.com
   # Results:
   cname.vercel-dns.com      -> Vercel
   *.netlify.app             -> Netlify
   pages.dev                 -> Cloudflare Pages
   *.railway.app             -> Railway
   *.onrender.com            -> Render
   *.replit.app              -> Replit
   ```

3. **A Record IP Ranges**
   ```
   76.76.21.21              -> Vercel (primary)
   75.2.60.5                -> Netlify
   172.66.x.x               -> Cloudflare
   ```

4. **Meta Tags / HTML Signatures**
   ```html
   <meta name="generator" content="v0.dev">
   <meta name="generator" content="Lovable">
   <!-- Built with Bolt.new -->
   ```

### 1.2 Detection Implementation

```typescript
// open-seo-main/src/server/services/platform-detector.ts

export type HostingPlatform =
  | "vercel"
  | "netlify"
  | "cloudflare-pages"
  | "replit"
  | "railway"
  | "render"
  | "bolt-host"
  | "lovable-cloud"
  | "unknown";

interface PlatformDetectionResult {
  platform: HostingPlatform;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  supportsApiDeployment: boolean;
  apiDeploymentMethod?: "rest" | "cli-only" | "none";
}

export async function detectHostingPlatform(
  domain: string
): Promise<PlatformDetectionResult> {
  const evidence: string[] = [];
  
  // 1. Check DNS records
  const dnsResult = await checkDnsRecords(domain);
  if (dnsResult.platform) {
    evidence.push(`DNS: ${dnsResult.evidence}`);
  }
  
  // 2. Check HTTP headers
  const headerResult = await checkHttpHeaders(domain);
  if (headerResult.platform) {
    evidence.push(`Headers: ${headerResult.evidence}`);
  }
  
  // 3. Check HTML signatures
  const htmlResult = await checkHtmlSignatures(domain);
  if (htmlResult.platform) {
    evidence.push(`HTML: ${htmlResult.evidence}`);
  }
  
  // Determine platform from evidence
  const platform = determinePlatform(dnsResult, headerResult, htmlResult);
  
  return {
    platform,
    confidence: evidence.length >= 2 ? "high" : evidence.length === 1 ? "medium" : "low",
    evidence,
    supportsApiDeployment: PLATFORM_API_SUPPORT[platform].hasApi,
    apiDeploymentMethod: PLATFORM_API_SUPPORT[platform].method,
  };
}

const PLATFORM_API_SUPPORT: Record<HostingPlatform, { hasApi: boolean; method: string }> = {
  "vercel": { hasApi: true, method: "rest" },
  "netlify": { hasApi: true, method: "rest" },
  "cloudflare-pages": { hasApi: false, method: "cli-only" },
  "replit": { hasApi: false, method: "none" },
  "railway": { hasApi: false, method: "cli-only" },
  "render": { hasApi: true, method: "rest" },
  "bolt-host": { hasApi: false, method: "none" },
  "lovable-cloud": { hasApi: false, method: "none" },
  "unknown": { hasApi: false, method: "none" },
};
```

---

## 2. Platform-Specific API Integration

### 2.1 Vercel (Full API Support)

**Capabilities:** Full REST API for file deployment and environment variables.

**Authentication:**
```
Authorization: Bearer <VERCEL_ACCESS_TOKEN>
```

**Deployment Strategy:** Create a new deployment with the IndexNow key file.

#### File Upload Process

```typescript
// Step 1: Upload the key file
async function uploadVercelKeyFile(
  token: string,
  teamId: string | null,
  apiKey: string
): Promise<string> {
  const keyContent = apiKey; // Plain text content
  const keyDigest = crypto.createHash("sha1").update(keyContent).digest("hex");
  
  const uploadUrl = new URL("https://api.vercel.com/v2/files");
  if (teamId) uploadUrl.searchParams.set("teamId", teamId);
  
  const response = await fetch(uploadUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "x-Vercel-Digest": keyDigest,
      "Content-Length": Buffer.byteLength(keyContent).toString(),
    },
    body: keyContent,
  });
  
  if (!response.ok) {
    throw new Error(`Vercel file upload failed: ${response.status}`);
  }
  
  return keyDigest;
}

// Step 2: Create deployment with the file
async function createVercelDeployment(
  token: string,
  projectId: string,
  teamId: string | null,
  apiKey: string,
  fileDigest: string
): Promise<{ deploymentId: string; url: string }> {
  const deployUrl = new URL("https://api.vercel.com/v13/deployments");
  if (teamId) deployUrl.searchParams.set("teamId", teamId);
  
  const response = await fetch(deployUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: projectId,
      files: [
        {
          file: `${apiKey}.txt`,
          sha: fileDigest,
          size: Buffer.byteLength(apiKey),
        },
      ],
      target: "production",
    }),
  });
  
  const data = await response.json();
  return {
    deploymentId: data.id,
    url: data.url,
  };
}
```

#### Environment Variable Injection (Alternative)

For sites using a build step, inject the key as an environment variable:

```typescript
async function injectVercelEnvVar(
  token: string,
  projectId: string,
  teamId: string | null,
  apiKey: string
): Promise<void> {
  const url = new URL(
    `https://api.vercel.com/v10/projects/${projectId}/env`
  );
  if (teamId) url.searchParams.set("teamId", teamId);
  
  await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: "INDEXNOW_API_KEY",
      value: apiKey,
      type: "plain",
      target: ["production", "preview"],
    }),
  });
}
```

**Note:** Using environment variables requires the site to have a route that serves the key file. This is more complex but works for dynamic sites.

---

### 2.2 Netlify (Full API Support)

**Capabilities:** REST API for file deployment via digest method or ZIP upload.

**Authentication:**
```
Authorization: Bearer <NETLIFY_ACCESS_TOKEN>
```

**Deployment Strategy:** Create a deploy with only the key file (partial deploy to existing site).

#### File Digest Method

```typescript
async function deployNetlifyKeyFile(
  token: string,
  siteId: string,
  apiKey: string
): Promise<{ deployId: string }> {
  const keyContent = apiKey;
  const keyDigest = crypto.createHash("sha1").update(keyContent).digest("hex");
  const filePath = `/${apiKey}.txt`;
  
  // Step 1: Create deploy with file digest
  const createResponse = await fetch(
    `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: {
          [filePath]: keyDigest,
        },
        draft: false,
      }),
    }
  );
  
  const createData = await createResponse.json();
  const deployId = createData.id;
  const requiredFiles = createData.required || [];
  
  // Step 2: Upload file if required
  if (requiredFiles.includes(keyDigest)) {
    await fetch(
      `https://api.netlify.com/api/v1/deploys/${deployId}/files${filePath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
        },
        body: keyContent,
      }
    );
  }
  
  return { deployId };
}
```

#### Deploy Hook Method (Simplest)

For sites with a Git-connected workflow, use deploy hooks with environment variables:

```typescript
async function triggerNetlifyDeployHook(
  hookUrl: string,
  apiKey: string
): Promise<void> {
  await fetch(hookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trigger_title: "IndexNow key deployment",
      // Note: Hook doesn't pass env vars directly; site must already have
      // INDEXNOW_API_KEY configured via Netlify dashboard or API
    }),
  });
}
```

---

### 2.3 Cloudflare Pages (CLI-Only, No REST API)

**Limitation:** Cloudflare Pages does NOT have a documented REST API for direct file uploads. The only supported methods are:

1. Wrangler CLI (`wrangler pages deploy`)
2. Dashboard drag-and-drop
3. Git integration

**Workaround Options:**

#### Option A: Workers API (Advanced)

If the client migrates to Cloudflare Workers (now recommended over Pages), there's an undocumented API:

```typescript
// WARNING: Undocumented, may break without notice
// Reference: https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/src/pages/upload.tsx

async function uploadCloudflareWorkerAsset(
  accountId: string,
  apiToken: string,
  scriptName: string,
  apiKey: string
): Promise<void> {
  // This requires reverse-engineering Wrangler's upload flow
  // Not recommended for production use
  throw new Error("Cloudflare Pages has no documented REST API for file uploads");
}
```

#### Option B: R2 + Custom Worker (Recommended)

Deploy the key file to R2 storage and serve via a Worker:

```typescript
// 1. Upload to R2
await r2Bucket.put(`${apiKey}.txt`, apiKey);

// 2. Worker serves the file
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith('.txt')) {
      const key = url.pathname.slice(1); // Remove leading /
      const object = await env.R2_BUCKET.get(key);
      if (object) {
        return new Response(object.body, {
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    }
    // ... rest of site
  }
};
```

**Recommendation:** For Cloudflare Pages clients, provide manual instructions.

---

### 2.4 Render (REST API Support)

**Capabilities:** REST API for triggering deploys and managing services, but NOT for direct file uploads.

**Strategy:** Environment variable injection + site rebuild

```typescript
async function configureRenderIndexNow(
  apiKey: string,
  serviceId: string,
  renderApiKey: string,
  indexNowKey: string
): Promise<void> {
  // Step 1: Add environment variable
  await fetch(
    `https://api.render.com/v1/services/${serviceId}/env-vars`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${renderApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          key: "INDEXNOW_API_KEY",
          value: indexNowKey,
        },
      ]),
    }
  );
  
  // Step 2: Trigger deploy
  await fetch(
    `https://api.render.com/v1/services/${serviceId}/deploys`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${renderApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clearCache: false,
      }),
    }
  );
}
```

**Requirement:** The site must have a route that serves `/{INDEXNOW_API_KEY}.txt`.

---

### 2.5 Railway (GraphQL API, Limited)

**Capabilities:** GraphQL API for deployments and environment variables, but no direct file upload.

**Strategy:** Environment variable injection + redeploy

```typescript
const RAILWAY_GRAPHQL = "https://backboard.railway.app/graphql/v2";

async function configureRailwayIndexNow(
  apiToken: string,
  projectId: string,
  environmentId: string,
  serviceId: string,
  indexNowKey: string
): Promise<void> {
  // Add environment variable
  await fetch(RAILWAY_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        mutation UpsertVariable($input: VariableUpsertInput!) {
          variableUpsert(input: $input)
        }
      `,
      variables: {
        input: {
          projectId,
          environmentId,
          serviceId,
          name: "INDEXNOW_API_KEY",
          value: indexNowKey,
        },
      },
    }),
  });
}
```

---

### 2.6 Replit, Bolt.host, Lovable Cloud (No API)

These platforms do NOT provide programmatic file deployment APIs:

| Platform | API Status | Best Approach |
|----------|------------|---------------|
| **Replit** | No public API for file writes | Manual instructions |
| **Bolt.host** | No API (August 2025 launch) | Manual instructions |
| **Lovable Cloud** | No API | Manual instructions + GitHub export |

**Recommendation:** Generate manual instructions with platform-specific steps.

---

## 3. Multi-Platform Deployment Service Architecture

### 3.1 Service Interface

```typescript
// open-seo-main/src/server/services/indexnow-platform-deployer.ts

export interface PlatformDeployerConfig {
  platform: HostingPlatform;
  credentials?: {
    vercel?: { token: string; teamId?: string; projectId: string };
    netlify?: { token: string; siteId: string };
    render?: { token: string; serviceId: string };
    railway?: { token: string; projectId: string; environmentId: string; serviceId: string };
  };
  domain: string;
}

export interface DeploymentResult {
  success: boolean;
  method: "api" | "manual";
  deploymentUrl?: string;
  verificationUrl: string;
  manualInstructions?: string[];
  error?: string;
}

export class IndexNowPlatformDeployer {
  async deployKeyFile(
    config: PlatformDeployerConfig,
    apiKey: string
  ): Promise<DeploymentResult> {
    const verificationUrl = `https://${config.domain}/${apiKey}.txt`;
    
    switch (config.platform) {
      case "vercel":
        return this.deployToVercel(config, apiKey, verificationUrl);
      case "netlify":
        return this.deployToNetlify(config, apiKey, verificationUrl);
      case "render":
        return this.deployToRender(config, apiKey, verificationUrl);
      case "railway":
        return this.deployToRailway(config, apiKey, verificationUrl);
      default:
        return this.generateManualInstructions(config, apiKey, verificationUrl);
    }
  }
  
  private async deployToVercel(
    config: PlatformDeployerConfig,
    apiKey: string,
    verificationUrl: string
  ): Promise<DeploymentResult> {
    if (!config.credentials?.vercel) {
      return this.generateManualInstructions(config, apiKey, verificationUrl);
    }
    
    try {
      const { token, teamId, projectId } = config.credentials.vercel;
      
      // Upload file
      const digest = await uploadVercelKeyFile(token, teamId || null, apiKey);
      
      // Create deployment
      const deployment = await createVercelDeployment(
        token, projectId, teamId || null, apiKey, digest
      );
      
      return {
        success: true,
        method: "api",
        deploymentUrl: deployment.url,
        verificationUrl,
      };
    } catch (error) {
      return {
        success: false,
        method: "manual",
        verificationUrl,
        manualInstructions: this.getVercelManualInstructions(apiKey),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
  
  private generateManualInstructions(
    config: PlatformDeployerConfig,
    apiKey: string,
    verificationUrl: string
  ): DeploymentResult {
    const instructions = this.getPlatformInstructions(config.platform, apiKey);
    
    return {
      success: false,
      method: "manual",
      verificationUrl,
      manualInstructions: instructions,
    };
  }
  
  private getPlatformInstructions(
    platform: HostingPlatform,
    apiKey: string
  ): string[] {
    const fileName = `${apiKey}.txt`;
    const fileContent = apiKey;
    
    switch (platform) {
      case "vercel":
        return this.getVercelManualInstructions(apiKey);
      case "netlify":
        return this.getNetlifyManualInstructions(apiKey);
      case "cloudflare-pages":
        return this.getCloudflareManualInstructions(apiKey);
      case "replit":
        return this.getReplitManualInstructions(apiKey);
      case "railway":
        return this.getRailwayManualInstructions(apiKey);
      case "render":
        return this.getRenderManualInstructions(apiKey);
      case "bolt-host":
        return this.getBoltManualInstructions(apiKey);
      case "lovable-cloud":
        return this.getLovableManualInstructions(apiKey);
      default:
        return this.getGenericManualInstructions(apiKey);
    }
  }
}
```

### 3.2 Platform-Specific Manual Instructions

```typescript
private getVercelManualInstructions(apiKey: string): string[] {
  return [
    `1. Open your Vercel project dashboard`,
    `2. Go to Settings > Environment Variables`,
    `3. Add: INDEXNOW_API_KEY = ${apiKey}`,
    `4. Create a file at /public/${apiKey}.txt with content: ${apiKey}`,
    `5. Or add an API route at /api/indexnow-key that returns the key`,
    `6. Redeploy your project`,
    `7. Verify: Visit https://yourdomain.com/${apiKey}.txt`,
  ];
}

private getNetlifyManualInstructions(apiKey: string): string[] {
  return [
    `1. In your project, create: public/${apiKey}.txt`,
    `2. File content should be: ${apiKey}`,
    `3. Commit and push to trigger deploy`,
    `4. Or use Netlify CLI: netlify deploy --prod`,
    `5. Verify: Visit https://yourdomain.com/${apiKey}.txt`,
  ];
}

private getCloudflareManualInstructions(apiKey: string): string[] {
  return [
    `1. In your project root, create: public/${apiKey}.txt`,
    `2. File content should be: ${apiKey}`,
    `3. Deploy using: wrangler pages deploy ./public`,
    `4. Or for Workers: Add file to assets directory`,
    `5. Verify: Visit https://yourdomain.com/${apiKey}.txt`,
  ];
}

private getReplitManualInstructions(apiKey: string): string[] {
  return [
    `1. In your Replit project, navigate to the public folder`,
    `2. Create a new file: ${apiKey}.txt`,
    `3. Add this content: ${apiKey}`,
    `4. Click "Run" to restart your app`,
    `5. Publish your deployment if using Replit Deployments`,
    `6. Verify: Visit https://yourdomain.com/${apiKey}.txt`,
  ];
}

private getBoltManualInstructions(apiKey: string): string[] {
  return [
    `1. In your Bolt.new project, open the file explorer`,
    `2. Navigate to the public/ directory (create if missing)`,
    `3. Create a new file: ${apiKey}.txt`,
    `4. Paste this content: ${apiKey}`,
    `5. Click "Publish" to deploy to bolt.host`,
    `6. Verify: Visit https://yourdomain.com/${apiKey}.txt`,
  ];
}

private getLovableManualInstructions(apiKey: string): string[] {
  return [
    `1. In your Lovable project, click "Code" to view files`,
    `2. Navigate to public/ directory`,
    `3. Click "+ New File" and name it: ${apiKey}.txt`,
    `4. Enter this content: ${apiKey}`,
    `5. Click "Deploy" to publish`,
    `6. Verify: Visit https://yourdomain.com/${apiKey}.txt`,
  ];
}

private getRailwayManualInstructions(apiKey: string): string[] {
  return [
    `1. Add INDEXNOW_API_KEY=${apiKey} to your Railway environment variables`,
    `2. Create public/${apiKey}.txt in your repo with content: ${apiKey}`,
    `3. Or create an API route that serves the key`,
    `4. Push changes to trigger redeploy`,
    `5. Verify: Visit https://yourdomain.com/${apiKey}.txt`,
  ];
}

private getRenderManualInstructions(apiKey: string): string[] {
  return [
    `1. In Render dashboard, go to your service > Environment`,
    `2. Add: INDEXNOW_API_KEY = ${apiKey}`,
    `3. In your code, create public/${apiKey}.txt with content: ${apiKey}`,
    `4. Push to trigger deploy, or click "Manual Deploy"`,
    `5. Verify: Visit https://yourdomain.com/${apiKey}.txt`,
  ];
}

private getGenericManualInstructions(apiKey: string): string[] {
  return [
    `1. Create a text file named: ${apiKey}.txt`,
    `2. File content should be exactly: ${apiKey}`,
    `3. Upload this file to your website root directory`,
    `4. The file must be accessible at: https://yourdomain.com/${apiKey}.txt`,
    `5. Ensure the file returns HTTP 200 and plain text content`,
  ];
}
```

---

## 4. AI Tool Generator Structures

### 4.1 Common Project Structures

Understanding common AI-generated project structures helps us place the key file correctly:

| Generator | Framework | Key File Location |
|-----------|-----------|-------------------|
| **v0.dev** | Next.js | `/public/${key}.txt` |
| **Bolt.new** | Vite/React | `/public/${key}.txt` |
| **Lovable** | React + Supabase | `/public/${key}.txt` |
| **Replit** | Various | `/public/${key}.txt` or root |
| **Create React App** | React | `/public/${key}.txt` |
| **Astro** | Astro | `/public/${key}.txt` |
| **SvelteKit** | SvelteKit | `/static/${key}.txt` |
| **Nuxt** | Nuxt.js | `/public/${key}.txt` |

### 4.2 Framework-Aware Placement

```typescript
type FrameworkType = "nextjs" | "vite" | "cra" | "astro" | "sveltekit" | "nuxt" | "remix" | "unknown";

function getKeyFilePath(framework: FrameworkType, apiKey: string): string {
  switch (framework) {
    case "sveltekit":
      return `/static/${apiKey}.txt`;
    case "nextjs":
    case "vite":
    case "cra":
    case "astro":
    case "nuxt":
    case "remix":
    default:
      return `/public/${apiKey}.txt`;
  }
}

async function detectFramework(domain: string): Promise<FrameworkType> {
  // Check for framework-specific headers or HTML patterns
  const html = await fetch(`https://${domain}`).then(r => r.text());
  
  if (html.includes("__next")) return "nextjs";
  if (html.includes("__sveltekit")) return "sveltekit";
  if (html.includes("__nuxt")) return "nuxt";
  if (html.includes("__remix")) return "remix";
  if (html.includes("/@vite/")) return "vite";
  
  return "unknown";
}
```

---

## 5. Integration with Phase 97 Architecture

### 5.1 Modified Client Onboarding Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   EXTENDED CLIENT ONBOARDING FLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Client Added to TeveroSEO                                              │
│              │                                                              │
│              ▼                                                              │
│  2. Admin enables IndexNow for client                                      │
│     POST /api/clients/{id}/indexnow/setup                                  │
│     Body: { domains: ["example.com"] }                                     │
│              │                                                              │
│              ▼                                                              │
│  3. System detects hosting platform                                        │
│     await detectHostingPlatform("example.com")                             │
│              │                                                              │
│              ├──► Platform: Vercel + has credentials?                      │
│              │         YES → Auto-deploy via API                           │
│              │                                                              │
│              ├──► Platform: Netlify + has credentials?                     │
│              │         YES → Auto-deploy via API                           │
│              │                                                              │
│              ├──► Platform: WordPress + has REST API access?               │
│              │         YES → Auto-deploy via WP REST API                   │
│              │                                                              │
│              └──► Any other platform                                       │
│                        │                                                    │
│                        ▼                                                    │
│                   Generate platform-specific manual instructions            │
│                   Show in dashboard with "Verify" button                    │
│                        │                                                    │
│                        ▼                                                    │
│                   User deploys key file manually                            │
│                   User clicks "Verify" button                               │
│                        │                                                    │
│                        ▼                                                    │
│                   GET https://example.com/{key}.txt                        │
│                   Check response = 200 AND content = key                   │
│                        │                                                    │
│                        ├──► Success → status: "verified"                   │
│                        └──► Failed → show error + instructions             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Database Schema Extension

```typescript
// Add to indexnow_config table
export const indexnowConfig = pgTable("indexnow_config", {
  // ... existing fields ...
  
  // Platform detection
  hostingPlatform: text("hosting_platform").$type<HostingPlatform>(),
  platformDetectedAt: timestamp("platform_detected_at", { withTimezone: true }),
  platformConfidence: text("platform_confidence").$type<"high" | "medium" | "low">(),
  
  // Platform credentials (encrypted, optional)
  platformCredentialsEncrypted: text("platform_credentials_encrypted"),
  
  // Deployment method used
  deploymentMethod: text("deployment_method").$type<"api" | "manual">(),
});
```

### 5.3 API Endpoints

```typescript
// POST /api/clients/:clientId/indexnow/detect-platform
// Detects hosting platform for a domain
router.post("/clients/:clientId/indexnow/detect-platform", async (req, res) => {
  const { domain } = req.body;
  const result = await detectHostingPlatform(domain);
  res.json(result);
});

// POST /api/clients/:clientId/indexnow/deploy-key
// Attempts API deployment, falls back to manual instructions
router.post("/clients/:clientId/indexnow/deploy-key", async (req, res) => {
  const { domain, platformCredentials } = req.body;
  const config = await getIndexNowConfig(req.params.clientId);
  
  const deployer = new IndexNowPlatformDeployer();
  const result = await deployer.deployKeyFile({
    platform: config.hostingPlatform,
    credentials: platformCredentials,
    domain,
  }, config.apiKey);
  
  res.json(result);
});

// POST /api/clients/:clientId/indexnow/verify
// Verifies key file is accessible
router.post("/clients/:clientId/indexnow/verify", async (req, res) => {
  const { domain } = req.body;
  const config = await getIndexNowConfig(req.params.clientId);
  
  const verificationUrl = `https://${domain}/${config.apiKey}.txt`;
  const response = await fetch(verificationUrl);
  const content = await response.text();
  
  const verified = response.status === 200 && content.trim() === config.apiKey;
  
  if (verified) {
    await updateVerificationStatus(config.id, domain, "verified");
  }
  
  res.json({ verified, url: verificationUrl });
});
```

---

## 6. Summary: Platform Support Matrix

| Platform | API Deploy | Env Var API | Best Method | Effort |
|----------|------------|-------------|-------------|--------|
| **Vercel** | Yes (full) | Yes | REST API file deploy | Low |
| **Netlify** | Yes (full) | Yes | REST API file digest | Low |
| **Render** | No | Yes | Env var + route | Medium |
| **Railway** | No | Yes (GraphQL) | Env var + route | Medium |
| **Cloudflare Pages** | No (CLI only) | No | Manual instructions | High |
| **Replit** | No | No | Manual instructions | High |
| **Bolt.host** | No | No | Manual instructions | High |
| **Lovable Cloud** | No | No | Manual instructions | High |

**Implementation Priority:**
1. **Vercel** - Largest user base, full API
2. **Netlify** - Large user base, full API
3. **Render** - Growing platform, partial API
4. **Railway** - Growing platform, GraphQL API
5. **Others** - Manual instructions only

---

## Sources

- [Vercel REST API Reference](https://vercel.com/docs/rest-api)
- [Vercel Upload Deployment Files](https://vercel.com/docs/rest-api/deployments/upload-deployment-files)
- [Vercel Environment Variables API](https://vercel.com/docs/rest-api/reference/endpoints/projects/create-one-or-more-environment-variables)
- [Netlify API Documentation](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/)
- [Netlify OpenAPI Reference](https://open-api.netlify.com/)
- [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Cloudflare Pages REST API](https://developers.cloudflare.com/pages/configuration/api/)
- [Render API Documentation](https://render.com/docs/api)
- [Railway API Documentation](https://docs.railway.com/deployments)
- [Replit Documentation](https://docs.replit.com/category/replit-deployments)
- [IndexNow Protocol Documentation](https://www.indexnow.org/documentation)
- [Bolt.new vs Lovable 2026 Comparison](https://www.nxcode.io/resources/news/bolt-new-vs-lovable-2026)
- [V0 vs Bolt vs Lovable Comparison](https://particula.tech/blog/lovable-vs-bolt-vs-v0-ai-app-builders)
- [How to Check Website Hosting Provider](https://webreveal.io/blog/how-to-check-website-hosting.html)
