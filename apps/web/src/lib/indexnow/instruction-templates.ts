/**
 * IndexNow Manual Instruction Templates
 *
 * Platform-specific instruction generation system for manual IndexNow key deployment.
 * Used as fallback when auto-deployment fails.
 *
 * Features:
 * - Platform-specific step-by-step instructions
 * - Dynamic variable interpolation (API key, domain)
 * - Internationalization hooks via next-intl
 * - Screenshot-ready step descriptions
 * - Common error solutions
 */

// ============================================================================
// Types
// ============================================================================

export type Platform =
  | "wordpress"
  | "shopify"
  | "wix"
  | "squarespace"
  | "webflow"
  | "vercel"
  | "netlify"
  | "cpanel"
  | "ftp";

export type Difficulty = "easy" | "medium" | "hard";

export interface InstructionStep {
  /** Step number (1-based) */
  number: number;
  /** i18n key for step title */
  titleKey: string;
  /** i18n key for step description */
  descriptionKey: string;
  /** Screenshot filename (loaded from /public/instructions/{platform}/) */
  screenshot?: string;
  /** Code snippet to display (with variable placeholders) */
  code?: string;
  /** Whether this step has a copy button for code */
  hasCopyButton?: boolean;
  /** Warning message i18n key (optional) */
  warningKey?: string;
  /** Tip message i18n key (optional) */
  tipKey?: string;
  /** External help link */
  helpLink?: string;
  /** Video tutorial URL */
  videoUrl?: string;
}

export interface CommonError {
  /** i18n key for error title */
  titleKey: string;
  /** i18n key for error description */
  descriptionKey: string;
  /** i18n key for solution */
  solutionKey: string;
}

export interface VerificationStep {
  /** i18n key for verification instruction */
  instructionKey: string;
  /** URL pattern to check (with {domain} placeholder) */
  checkUrl: string;
  /** Expected response or content */
  expectedContent: string;
}

export interface PlatformInstructions {
  /** Platform identifier */
  platform: Platform;
  /** i18n key for platform display name */
  nameKey: string;
  /** Estimated time in minutes */
  estimatedMinutes: number;
  /** Difficulty level */
  difficulty: Difficulty;
  /** Whether paid plan is required */
  paidPlanRequired: boolean;
  /** Prerequisites i18n keys */
  prerequisiteKeys: string[];
  /** Installation steps */
  steps: InstructionStep[];
  /** Verification steps */
  verification: VerificationStep[];
  /** Common errors and solutions */
  commonErrors: CommonError[];
  /** Alternative method (e.g., FTP fallback for WordPress) */
  fallbackPlatform?: Platform;
}

export interface InstructionVariables {
  /** The IndexNow API key */
  apiKey: string;
  /** Client's domain (without protocol) */
  domain: string;
  /** Full domain with protocol */
  fullDomain: string;
  /** Client name (optional, for personalization) */
  clientName?: string;
  /** Search engine (bing, yandex, etc.) */
  searchEngine?: string;
}

// ============================================================================
// File Content Generator
// ============================================================================

/**
 * Generate the IndexNow key file content.
 * The file should contain only the API key, no extra characters.
 */
export function generateKeyFileContent(apiKey: string): string {
  return apiKey;
}

/**
 * Generate the key file name based on the API key.
 * IndexNow requires the filename to match the key.
 */
export function generateKeyFileName(apiKey: string): string {
  return `${apiKey}.txt`;
}

/**
 * Generate verification URL for IndexNow key.
 */
export function generateVerificationUrl(domain: string, apiKey: string): string {
  const normalizedDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${normalizedDomain}/${apiKey}.txt`;
}

// ============================================================================
// Platform Templates
// ============================================================================

export const PLATFORM_INSTRUCTIONS: Record<Platform, PlatformInstructions> = {
  // ---------------------------------------------------------------------------
  // WordPress
  // ---------------------------------------------------------------------------
  wordpress: {
    platform: "wordpress",
    nameKey: "indexnow.platforms.wordpress",
    estimatedMinutes: 3,
    difficulty: "easy",
    paidPlanRequired: false,
    prerequisiteKeys: [
      "indexnow.prereq.wpAdmin",
      "indexnow.prereq.fileManagerOrFtp",
    ],
    steps: [
      {
        number: 1,
        titleKey: "indexnow.wordpress.step1.title",
        descriptionKey: "indexnow.wordpress.step1.description",
        screenshot: "wp-dashboard.png",
      },
      {
        number: 2,
        titleKey: "indexnow.wordpress.step2.title",
        descriptionKey: "indexnow.wordpress.step2.description",
        screenshot: "wp-file-manager.png",
        tipKey: "indexnow.wordpress.step2.tip",
      },
      {
        number: 3,
        titleKey: "indexnow.wordpress.step3.title",
        descriptionKey: "indexnow.wordpress.step3.description",
        screenshot: "wp-public-html.png",
      },
      {
        number: 4,
        titleKey: "indexnow.wordpress.step4.title",
        descriptionKey: "indexnow.wordpress.step4.description",
        screenshot: "wp-create-file.png",
        code: "{apiKey}",
        hasCopyButton: true,
      },
      {
        number: 5,
        titleKey: "indexnow.wordpress.step5.title",
        descriptionKey: "indexnow.wordpress.step5.description",
        code: "{apiKey}.txt",
        hasCopyButton: true,
        warningKey: "indexnow.wordpress.step5.warning",
      },
    ],
    verification: [
      {
        instructionKey: "indexnow.verify.visitUrl",
        checkUrl: "https://{domain}/{apiKey}.txt",
        expectedContent: "{apiKey}",
      },
    ],
    commonErrors: [
      {
        titleKey: "indexnow.errors.404.title",
        descriptionKey: "indexnow.errors.404.description",
        solutionKey: "indexnow.errors.404.solution",
      },
      {
        titleKey: "indexnow.errors.wrongContent.title",
        descriptionKey: "indexnow.errors.wrongContent.description",
        solutionKey: "indexnow.errors.wrongContent.solution",
      },
      {
        titleKey: "indexnow.errors.htaccess.title",
        descriptionKey: "indexnow.errors.htaccess.description",
        solutionKey: "indexnow.errors.htaccess.solution",
      },
    ],
    fallbackPlatform: "ftp",
  },

  // ---------------------------------------------------------------------------
  // Shopify
  // ---------------------------------------------------------------------------
  shopify: {
    platform: "shopify",
    nameKey: "indexnow.platforms.shopify",
    estimatedMinutes: 2,
    difficulty: "easy",
    paidPlanRequired: false,
    prerequisiteKeys: [
      "indexnow.prereq.shopifyAdmin",
    ],
    steps: [
      {
        number: 1,
        titleKey: "indexnow.shopify.step1.title",
        descriptionKey: "indexnow.shopify.step1.description",
        screenshot: "shopify-admin.png",
      },
      {
        number: 2,
        titleKey: "indexnow.shopify.step2.title",
        descriptionKey: "indexnow.shopify.step2.description",
        screenshot: "shopify-content-files.png",
      },
      {
        number: 3,
        titleKey: "indexnow.shopify.step3.title",
        descriptionKey: "indexnow.shopify.step3.description",
        screenshot: "shopify-upload.png",
        tipKey: "indexnow.shopify.step3.tip",
      },
      {
        number: 4,
        titleKey: "indexnow.shopify.step4.title",
        descriptionKey: "indexnow.shopify.step4.description",
        screenshot: "shopify-theme-liquid.png",
        code: `{% if request.path == '/{apiKey}.txt' %}
  {apiKey}
{% endif %}`,
        hasCopyButton: true,
        warningKey: "indexnow.shopify.step4.warning",
      },
    ],
    verification: [
      {
        instructionKey: "indexnow.verify.visitUrl",
        checkUrl: "https://{domain}/{apiKey}.txt",
        expectedContent: "{apiKey}",
      },
    ],
    commonErrors: [
      {
        titleKey: "indexnow.errors.shopifyRedirect.title",
        descriptionKey: "indexnow.errors.shopifyRedirect.description",
        solutionKey: "indexnow.errors.shopifyRedirect.solution",
      },
      {
        titleKey: "indexnow.errors.liquidSyntax.title",
        descriptionKey: "indexnow.errors.liquidSyntax.description",
        solutionKey: "indexnow.errors.liquidSyntax.solution",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Wix
  // ---------------------------------------------------------------------------
  wix: {
    platform: "wix",
    nameKey: "indexnow.platforms.wix",
    estimatedMinutes: 3,
    difficulty: "medium",
    paidPlanRequired: true,
    prerequisiteKeys: [
      "indexnow.prereq.wixPremium",
      "indexnow.prereq.wixEditor",
    ],
    steps: [
      {
        number: 1,
        titleKey: "indexnow.wix.step1.title",
        descriptionKey: "indexnow.wix.step1.description",
        screenshot: "wix-dashboard.png",
      },
      {
        number: 2,
        titleKey: "indexnow.wix.step2.title",
        descriptionKey: "indexnow.wix.step2.description",
        screenshot: "wix-settings.png",
      },
      {
        number: 3,
        titleKey: "indexnow.wix.step3.title",
        descriptionKey: "indexnow.wix.step3.description",
        screenshot: "wix-custom-code.png",
        tipKey: "indexnow.wix.step3.tip",
      },
      {
        number: 4,
        titleKey: "indexnow.wix.step4.title",
        descriptionKey: "indexnow.wix.step4.description",
        code: `// Wix Velo: Add to routers.js
import { ok, notFound } from 'wix-router';

export function get_indexnow(request) {
  if (request.path[0] === '{apiKey}.txt') {
    return ok('{apiKey}', { 'Content-Type': 'text/plain' });
  }
  return notFound();
}`,
        hasCopyButton: true,
        warningKey: "indexnow.wix.step4.warning",
      },
    ],
    verification: [
      {
        instructionKey: "indexnow.verify.visitUrl",
        checkUrl: "https://{domain}/{apiKey}.txt",
        expectedContent: "{apiKey}",
      },
    ],
    commonErrors: [
      {
        titleKey: "indexnow.errors.wixPremium.title",
        descriptionKey: "indexnow.errors.wixPremium.description",
        solutionKey: "indexnow.errors.wixPremium.solution",
      },
      {
        titleKey: "indexnow.errors.wixVelo.title",
        descriptionKey: "indexnow.errors.wixVelo.description",
        solutionKey: "indexnow.errors.wixVelo.solution",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Squarespace
  // ---------------------------------------------------------------------------
  squarespace: {
    platform: "squarespace",
    nameKey: "indexnow.platforms.squarespace",
    estimatedMinutes: 5,
    difficulty: "hard",
    paidPlanRequired: true,
    prerequisiteKeys: [
      "indexnow.prereq.squarespaceBusiness",
      "indexnow.prereq.squarespaceAdmin",
    ],
    steps: [
      {
        number: 1,
        titleKey: "indexnow.squarespace.step1.title",
        descriptionKey: "indexnow.squarespace.step1.description",
        screenshot: "squarespace-settings.png",
        warningKey: "indexnow.squarespace.step1.warning",
      },
      {
        number: 2,
        titleKey: "indexnow.squarespace.step2.title",
        descriptionKey: "indexnow.squarespace.step2.description",
        screenshot: "squarespace-advanced.png",
      },
      {
        number: 3,
        titleKey: "indexnow.squarespace.step3.title",
        descriptionKey: "indexnow.squarespace.step3.description",
        screenshot: "squarespace-code-injection.png",
        tipKey: "indexnow.squarespace.step3.tip",
      },
      {
        number: 4,
        titleKey: "indexnow.squarespace.step4.title",
        descriptionKey: "indexnow.squarespace.step4.description",
        code: `<!-- Alternative: Create a page at /{apiKey}.txt -->
<!-- Squarespace doesn't support .txt file hosting directly -->
<!-- Consider using a redirect or external file hosting -->`,
        hasCopyButton: false,
      },
      {
        number: 5,
        titleKey: "indexnow.squarespace.step5.title",
        descriptionKey: "indexnow.squarespace.step5.description",
        helpLink: "https://support.squarespace.com/hc/en-us/articles/205815908",
      },
    ],
    verification: [
      {
        instructionKey: "indexnow.verify.visitUrl",
        checkUrl: "https://{domain}/{apiKey}.txt",
        expectedContent: "{apiKey}",
      },
    ],
    commonErrors: [
      {
        titleKey: "indexnow.errors.squarespaceNoTxt.title",
        descriptionKey: "indexnow.errors.squarespaceNoTxt.description",
        solutionKey: "indexnow.errors.squarespaceNoTxt.solution",
      },
      {
        titleKey: "indexnow.errors.squarespacePlan.title",
        descriptionKey: "indexnow.errors.squarespacePlan.description",
        solutionKey: "indexnow.errors.squarespacePlan.solution",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Webflow
  // ---------------------------------------------------------------------------
  webflow: {
    platform: "webflow",
    nameKey: "indexnow.platforms.webflow",
    estimatedMinutes: 3,
    difficulty: "medium",
    paidPlanRequired: true,
    prerequisiteKeys: [
      "indexnow.prereq.webflowCMS",
      "indexnow.prereq.webflowDesigner",
    ],
    steps: [
      {
        number: 1,
        titleKey: "indexnow.webflow.step1.title",
        descriptionKey: "indexnow.webflow.step1.description",
        screenshot: "webflow-dashboard.png",
      },
      {
        number: 2,
        titleKey: "indexnow.webflow.step2.title",
        descriptionKey: "indexnow.webflow.step2.description",
        screenshot: "webflow-assets.png",
      },
      {
        number: 3,
        titleKey: "indexnow.webflow.step3.title",
        descriptionKey: "indexnow.webflow.step3.description",
        screenshot: "webflow-upload.png",
        code: "{apiKey}",
        hasCopyButton: true,
        tipKey: "indexnow.webflow.step3.tip",
      },
      {
        number: 4,
        titleKey: "indexnow.webflow.step4.title",
        descriptionKey: "indexnow.webflow.step4.description",
        screenshot: "webflow-publish.png",
      },
    ],
    verification: [
      {
        instructionKey: "indexnow.verify.visitUrl",
        checkUrl: "https://{domain}/{apiKey}.txt",
        expectedContent: "{apiKey}",
      },
    ],
    commonErrors: [
      {
        titleKey: "indexnow.errors.webflowAsset.title",
        descriptionKey: "indexnow.errors.webflowAsset.description",
        solutionKey: "indexnow.errors.webflowAsset.solution",
      },
      {
        titleKey: "indexnow.errors.webflowPublish.title",
        descriptionKey: "indexnow.errors.webflowPublish.description",
        solutionKey: "indexnow.errors.webflowPublish.solution",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Vercel
  // ---------------------------------------------------------------------------
  vercel: {
    platform: "vercel",
    nameKey: "indexnow.platforms.vercel",
    estimatedMinutes: 2,
    difficulty: "easy",
    paidPlanRequired: false,
    prerequisiteKeys: [
      "indexnow.prereq.vercelProject",
      "indexnow.prereq.gitAccess",
    ],
    steps: [
      {
        number: 1,
        titleKey: "indexnow.vercel.step1.title",
        descriptionKey: "indexnow.vercel.step1.description",
        screenshot: "vercel-project.png",
      },
      {
        number: 2,
        titleKey: "indexnow.vercel.step2.title",
        descriptionKey: "indexnow.vercel.step2.description",
        code: `// Create file: public/{apiKey}.txt
// Content:
{apiKey}`,
        hasCopyButton: true,
      },
      {
        number: 3,
        titleKey: "indexnow.vercel.step3.title",
        descriptionKey: "indexnow.vercel.step3.description",
        code: `// Alternative: Add to vercel.json
{
  "rewrites": [
    {
      "source": "/{apiKey}.txt",
      "destination": "/api/indexnow-key"
    }
  ]
}`,
        hasCopyButton: true,
        tipKey: "indexnow.vercel.step3.tip",
      },
      {
        number: 4,
        titleKey: "indexnow.vercel.step4.title",
        descriptionKey: "indexnow.vercel.step4.description",
        screenshot: "vercel-deploy.png",
      },
    ],
    verification: [
      {
        instructionKey: "indexnow.verify.visitUrl",
        checkUrl: "https://{domain}/{apiKey}.txt",
        expectedContent: "{apiKey}",
      },
    ],
    commonErrors: [
      {
        titleKey: "indexnow.errors.vercelPublic.title",
        descriptionKey: "indexnow.errors.vercelPublic.description",
        solutionKey: "indexnow.errors.vercelPublic.solution",
      },
      {
        titleKey: "indexnow.errors.vercelCache.title",
        descriptionKey: "indexnow.errors.vercelCache.description",
        solutionKey: "indexnow.errors.vercelCache.solution",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Netlify
  // ---------------------------------------------------------------------------
  netlify: {
    platform: "netlify",
    nameKey: "indexnow.platforms.netlify",
    estimatedMinutes: 2,
    difficulty: "easy",
    paidPlanRequired: false,
    prerequisiteKeys: [
      "indexnow.prereq.netlifySite",
      "indexnow.prereq.gitAccess",
    ],
    steps: [
      {
        number: 1,
        titleKey: "indexnow.netlify.step1.title",
        descriptionKey: "indexnow.netlify.step1.description",
        screenshot: "netlify-dashboard.png",
      },
      {
        number: 2,
        titleKey: "indexnow.netlify.step2.title",
        descriptionKey: "indexnow.netlify.step2.description",
        code: `// Create file: public/{apiKey}.txt (or static/{apiKey}.txt for some frameworks)
// Content:
{apiKey}`,
        hasCopyButton: true,
      },
      {
        number: 3,
        titleKey: "indexnow.netlify.step3.title",
        descriptionKey: "indexnow.netlify.step3.description",
        code: `# Alternative: Add to _redirects file
/{apiKey}.txt  /indexnow-key.txt  200`,
        hasCopyButton: true,
        tipKey: "indexnow.netlify.step3.tip",
      },
      {
        number: 4,
        titleKey: "indexnow.netlify.step4.title",
        descriptionKey: "indexnow.netlify.step4.description",
        screenshot: "netlify-deploy.png",
      },
    ],
    verification: [
      {
        instructionKey: "indexnow.verify.visitUrl",
        checkUrl: "https://{domain}/{apiKey}.txt",
        expectedContent: "{apiKey}",
      },
    ],
    commonErrors: [
      {
        titleKey: "indexnow.errors.netlifyPath.title",
        descriptionKey: "indexnow.errors.netlifyPath.description",
        solutionKey: "indexnow.errors.netlifyPath.solution",
      },
      {
        titleKey: "indexnow.errors.netlifyBuild.title",
        descriptionKey: "indexnow.errors.netlifyBuild.description",
        solutionKey: "indexnow.errors.netlifyBuild.solution",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // cPanel (Generic)
  // ---------------------------------------------------------------------------
  cpanel: {
    platform: "cpanel",
    nameKey: "indexnow.platforms.cpanel",
    estimatedMinutes: 3,
    difficulty: "easy",
    paidPlanRequired: false,
    prerequisiteKeys: [
      "indexnow.prereq.cpanelAccess",
    ],
    steps: [
      {
        number: 1,
        titleKey: "indexnow.cpanel.step1.title",
        descriptionKey: "indexnow.cpanel.step1.description",
        screenshot: "cpanel-login.png",
      },
      {
        number: 2,
        titleKey: "indexnow.cpanel.step2.title",
        descriptionKey: "indexnow.cpanel.step2.description",
        screenshot: "cpanel-filemanager.png",
      },
      {
        number: 3,
        titleKey: "indexnow.cpanel.step3.title",
        descriptionKey: "indexnow.cpanel.step3.description",
        screenshot: "cpanel-publichtml.png",
        tipKey: "indexnow.cpanel.step3.tip",
      },
      {
        number: 4,
        titleKey: "indexnow.cpanel.step4.title",
        descriptionKey: "indexnow.cpanel.step4.description",
        screenshot: "cpanel-newfile.png",
        code: "{apiKey}.txt",
        hasCopyButton: true,
      },
      {
        number: 5,
        titleKey: "indexnow.cpanel.step5.title",
        descriptionKey: "indexnow.cpanel.step5.description",
        screenshot: "cpanel-edit.png",
        code: "{apiKey}",
        hasCopyButton: true,
        warningKey: "indexnow.cpanel.step5.warning",
      },
    ],
    verification: [
      {
        instructionKey: "indexnow.verify.visitUrl",
        checkUrl: "https://{domain}/{apiKey}.txt",
        expectedContent: "{apiKey}",
      },
    ],
    commonErrors: [
      {
        titleKey: "indexnow.errors.cpanelPath.title",
        descriptionKey: "indexnow.errors.cpanelPath.description",
        solutionKey: "indexnow.errors.cpanelPath.solution",
      },
      {
        titleKey: "indexnow.errors.cpanelPermissions.title",
        descriptionKey: "indexnow.errors.cpanelPermissions.description",
        solutionKey: "indexnow.errors.cpanelPermissions.solution",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // FTP (Generic)
  // ---------------------------------------------------------------------------
  ftp: {
    platform: "ftp",
    nameKey: "indexnow.platforms.ftp",
    estimatedMinutes: 5,
    difficulty: "medium",
    paidPlanRequired: false,
    prerequisiteKeys: [
      "indexnow.prereq.ftpCredentials",
      "indexnow.prereq.ftpClient",
    ],
    steps: [
      {
        number: 1,
        titleKey: "indexnow.ftp.step1.title",
        descriptionKey: "indexnow.ftp.step1.description",
        screenshot: "ftp-filezilla.png",
        helpLink: "https://filezilla-project.org/download.php",
      },
      {
        number: 2,
        titleKey: "indexnow.ftp.step2.title",
        descriptionKey: "indexnow.ftp.step2.description",
        screenshot: "ftp-connect.png",
        tipKey: "indexnow.ftp.step2.tip",
      },
      {
        number: 3,
        titleKey: "indexnow.ftp.step3.title",
        descriptionKey: "indexnow.ftp.step3.description",
        screenshot: "ftp-navigate.png",
      },
      {
        number: 4,
        titleKey: "indexnow.ftp.step4.title",
        descriptionKey: "indexnow.ftp.step4.description",
        code: `1. Create a new text file on your computer
2. Name it: {apiKey}.txt
3. Open it and paste this content:

{apiKey}

4. Save the file`,
        hasCopyButton: false,
      },
      {
        number: 5,
        titleKey: "indexnow.ftp.step5.title",
        descriptionKey: "indexnow.ftp.step5.description",
        screenshot: "ftp-upload.png",
        warningKey: "indexnow.ftp.step5.warning",
      },
    ],
    verification: [
      {
        instructionKey: "indexnow.verify.visitUrl",
        checkUrl: "https://{domain}/{apiKey}.txt",
        expectedContent: "{apiKey}",
      },
    ],
    commonErrors: [
      {
        titleKey: "indexnow.errors.ftpConnection.title",
        descriptionKey: "indexnow.errors.ftpConnection.description",
        solutionKey: "indexnow.errors.ftpConnection.solution",
      },
      {
        titleKey: "indexnow.errors.ftpDirectory.title",
        descriptionKey: "indexnow.errors.ftpDirectory.description",
        solutionKey: "indexnow.errors.ftpDirectory.solution",
      },
      {
        titleKey: "indexnow.errors.ftpPermissions.title",
        descriptionKey: "indexnow.errors.ftpPermissions.description",
        solutionKey: "indexnow.errors.ftpPermissions.solution",
      },
    ],
  },
};

// ============================================================================
// Instruction Generator
// ============================================================================

/**
 * Interpolate variables into a template string.
 * Replaces {variableName} with actual values.
 */
export function interpolateVariables(
  template: string,
  variables: InstructionVariables
): string {
  return template
    .replace(/{apiKey}/g, variables.apiKey)
    .replace(/{domain}/g, variables.domain)
    .replace(/{fullDomain}/g, variables.fullDomain)
    .replace(/{clientName}/g, variables.clientName || "")
    .replace(/{searchEngine}/g, variables.searchEngine || "bing");
}

/**
 * Generate complete instructions for a platform with interpolated variables.
 */
export function generateInstructions(
  platform: Platform,
  variables: InstructionVariables
): PlatformInstructions & { interpolatedSteps: InstructionStep[] } {
  const template = PLATFORM_INSTRUCTIONS[platform];

  if (!template) {
    throw new Error(`Unknown platform: ${platform}`);
  }

  const interpolatedSteps = template.steps.map((step) => ({
    ...step,
    code: step.code ? interpolateVariables(step.code, variables) : undefined,
  }));

  const interpolatedVerification = template.verification.map((v) => ({
    ...v,
    checkUrl: interpolateVariables(v.checkUrl, variables),
    expectedContent: interpolateVariables(v.expectedContent, variables),
  }));

  return {
    ...template,
    interpolatedSteps,
    verification: interpolatedVerification,
  };
}

/**
 * Get all supported platforms with basic info for UI selection.
 */
export function getSupportedPlatforms(): Array<{
  platform: Platform;
  nameKey: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  paidPlanRequired: boolean;
}> {
  return Object.values(PLATFORM_INSTRUCTIONS).map(({
    platform,
    nameKey,
    difficulty,
    estimatedMinutes,
    paidPlanRequired,
  }) => ({
    platform,
    nameKey,
    difficulty,
    estimatedMinutes,
    paidPlanRequired,
  }));
}
