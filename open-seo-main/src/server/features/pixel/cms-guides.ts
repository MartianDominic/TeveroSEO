/**
 * CMS Installation Guides
 * Phase 66-03: Platform-specific installation guides
 *
 * Step-by-step guides for installing TeveroSEO pixel on 14+ platforms.
 * Per DESIGN.md Section 6 and 9:
 * - 3-5 steps per platform
 * - Simple language (5th-8th grade level)
 * - Screenshots and copy-pasteable code
 * - GTM fallback for unsupported platforms
 */

// ============================================================================
// Types
// ============================================================================

export interface GuideStep {
  number: number;
  title: string;
  content: string; // Alias for description for compatibility
  description: string; // 5th-8th grade reading level
  screenshot?: string; // Path to screenshot image
  code?: string; // Copy-pasteable code
  helpLink?: string; // Video or chat link
}

export interface InstallationGuide {
  platform: string;
  name: string; // Display name
  steps: GuideStep[];
  estimatedTime: string;
  difficulty: "easy" | "medium" | "hard";
  paidPlanRequired: boolean;
  fallbackToGtm: boolean;
}

// ============================================================================
// Pixel Code Template
// ============================================================================

const PIXEL_SCRIPT = `<script async src="https://pixel.tevero.io/t.js" data-site="{{SITE_ID}}"></script>`;

// ============================================================================
// CMS Guides
// ============================================================================

export const CMS_GUIDES: Record<string, InstallationGuide> = {
  // -------------------------------------------------------------------------
  // WordPress (self-hosted)
  // -------------------------------------------------------------------------
  wordpress_self_hosted: {
    platform: "wordpress_self_hosted",
    name: "WordPress",
    estimatedTime: "2 min",
    difficulty: "easy",
    paidPlanRequired: false,
    fallbackToGtm: true,
    steps: [
      {
        number: 1,
        title: "Log into your WordPress admin",
        description:
          "Go to yoursite.com/wp-admin and sign in with your username and password.",
        screenshot: "/guides/wordpress/step-1.png",
      },
      {
        number: 2,
        title: 'Go to Appearance, then Theme Editor',
        description:
          'In the left menu, click "Appearance" then "Theme Editor" (or "Theme File Editor").',
        screenshot: "/guides/wordpress/step-2.png",
      },
      {
        number: 3,
        title: "Find header.php",
        description:
          'On the right side, look for "header.php" (or "Theme Header") and click it.',
        screenshot: "/guides/wordpress/step-3.png",
      },
      {
        number: 4,
        title: "Add the TeveroSEO helper",
        description:
          "Find the <head> tag near the top. Paste this line right after it:",
        code: PIXEL_SCRIPT,
        screenshot: "/guides/wordpress/step-4.png",
      },
      {
        number: 5,
        title: "Save your changes",
        description:
          'Click "Update File" at the bottom. That\'s it! You\'re all done.',
        helpLink: "/help/wordpress",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // WordPress.com (hosted)
  // -------------------------------------------------------------------------
  wordpress_com: {
    platform: "wordpress_com",
    name: "WordPress.com",
    estimatedTime: "3 min",
    difficulty: "medium",
    paidPlanRequired: true,
    fallbackToGtm: true,
    steps: [
      {
        number: 1,
        title: "Log into WordPress.com",
        description:
          "Go to wordpress.com and sign in to your account. Note: You need a Business or eCommerce plan.",
        screenshot: "/guides/wordpress-com/step-1.png",
      },
      {
        number: 2,
        title: 'Go to Tools, then Plugins',
        description:
          'Click "Tools" in the left menu, then "Plugins". If you don\'t see Plugins, you may need to upgrade your plan.',
        screenshot: "/guides/wordpress-com/step-2.png",
      },
      {
        number: 3,
        title: "Install Insert Headers plugin",
        description:
          'Search for "Insert Headers and Footers" and click "Install". Then click "Activate".',
        screenshot: "/guides/wordpress-com/step-3.png",
      },
      {
        number: 4,
        title: "Add the TeveroSEO helper",
        description:
          'Go to Settings, then "Insert Headers and Footers". Paste this in the Header box:',
        code: PIXEL_SCRIPT,
        screenshot: "/guides/wordpress-com/step-4.png",
      },
      {
        number: 5,
        title: "Save your changes",
        description: 'Click "Save". Done! The helper is now active on your site.',
        helpLink: "/help/wordpress-com",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Shopify
  // -------------------------------------------------------------------------
  shopify: {
    platform: "shopify",
    name: "Shopify",
    estimatedTime: "2 min",
    difficulty: "easy",
    paidPlanRequired: false,
    fallbackToGtm: true,
    steps: [
      {
        number: 1,
        title: "Log into Shopify admin",
        description:
          "Go to yourstore.myshopify.com/admin and sign in.",
        screenshot: "/guides/shopify/step-1.png",
      },
      {
        number: 2,
        title: 'Go to Online Store, then Themes',
        description:
          'In the left menu, click "Online Store" then "Themes".',
        screenshot: "/guides/shopify/step-2.png",
      },
      {
        number: 3,
        title: "Edit your theme code",
        description:
          'Click the three dots (...) next to your theme, then choose "Edit code".',
        screenshot: "/guides/shopify/step-3.png",
      },
      {
        number: 4,
        title: "Add the TeveroSEO helper",
        description:
          'Find and click "theme.liquid" in the left panel. Find <head> near the top and paste this line right after it:',
        code: PIXEL_SCRIPT,
        screenshot: "/guides/shopify/step-4.png",
      },
      {
        number: 5,
        title: "Save your changes",
        description:
          'Click "Save" in the top right. That\'s it! Your store is now connected.',
        helpLink: "/help/shopify",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Wix
  // -------------------------------------------------------------------------
  wix: {
    platform: "wix",
    name: "Wix",
    estimatedTime: "2 min",
    difficulty: "easy",
    paidPlanRequired: true,
    fallbackToGtm: true,
    steps: [
      {
        number: 1,
        title: "Log into Wix",
        description:
          "Go to wix.com and sign in. Note: You need a Premium plan to add custom tracking.",
        screenshot: "/guides/wix/step-1.png",
      },
      {
        number: 2,
        title: "Go to Settings",
        description:
          'Click the Settings icon (gear) in the left menu of your dashboard.',
        screenshot: "/guides/wix/step-2.png",
      },
      {
        number: 3,
        title: "Find Custom Code",
        description:
          'Scroll down and click "Custom Code" under Advanced Settings.',
        screenshot: "/guides/wix/step-3.png",
      },
      {
        number: 4,
        title: "Add the TeveroSEO helper",
        description:
          'Click "Add Code" at the top. Paste this code, set it to load in "Head" and on "All pages":',
        code: PIXEL_SCRIPT,
        screenshot: "/guides/wix/step-4.png",
      },
      {
        number: 5,
        title: "Save and publish",
        description:
          'Click "Apply" and then publish your site. Done!',
        helpLink: "/help/wix",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Squarespace
  // -------------------------------------------------------------------------
  squarespace: {
    platform: "squarespace",
    name: "Squarespace",
    estimatedTime: "2 min",
    difficulty: "easy",
    paidPlanRequired: true,
    fallbackToGtm: true,
    steps: [
      {
        number: 1,
        title: "Log into Squarespace",
        description:
          "Go to squarespace.com and sign in. Note: You need a Business or Commerce plan.",
        screenshot: "/guides/squarespace/step-1.png",
      },
      {
        number: 2,
        title: "Go to Website Settings",
        description:
          'Click "Settings" in the left menu of your site dashboard.',
        screenshot: "/guides/squarespace/step-2.png",
      },
      {
        number: 3,
        title: "Find Code Injection",
        description:
          'Click "Advanced" then "Code Injection".',
        screenshot: "/guides/squarespace/step-3.png",
      },
      {
        number: 4,
        title: "Add the TeveroSEO helper",
        description:
          'In the "Header" box, paste this code:',
        code: PIXEL_SCRIPT,
        screenshot: "/guides/squarespace/step-4.png",
      },
      {
        number: 5,
        title: "Save your changes",
        description:
          'Click "Save" at the top. That\'s it!',
        helpLink: "/help/squarespace",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Webflow
  // -------------------------------------------------------------------------
  webflow: {
    platform: "webflow",
    name: "Webflow",
    estimatedTime: "2 min",
    difficulty: "easy",
    paidPlanRequired: false,
    fallbackToGtm: true,
    steps: [
      {
        number: 1,
        title: "Log into Webflow",
        description: "Go to webflow.com and open your project.",
        screenshot: "/guides/webflow/step-1.png",
      },
      {
        number: 2,
        title: "Go to Project Settings",
        description:
          'Click the gear icon in the left panel to open Project Settings.',
        screenshot: "/guides/webflow/step-2.png",
      },
      {
        number: 3,
        title: "Find Custom Code",
        description:
          'Click the "Custom Code" tab at the top.',
        screenshot: "/guides/webflow/step-3.png",
      },
      {
        number: 4,
        title: "Add the TeveroSEO helper",
        description:
          'In the "Head Code" box, paste this:',
        code: PIXEL_SCRIPT,
        screenshot: "/guides/webflow/step-4.png",
      },
      {
        number: 5,
        title: "Save and publish",
        description:
          'Click "Save Changes" then publish your site. Done!',
        helpLink: "/help/webflow",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Weebly
  // -------------------------------------------------------------------------
  weebly: {
    platform: "weebly",
    name: "Weebly",
    estimatedTime: "2 min",
    difficulty: "easy",
    paidPlanRequired: false,
    fallbackToGtm: true,
    steps: [
      {
        number: 1,
        title: "Log into Weebly",
        description: "Go to weebly.com and sign in to edit your site.",
        screenshot: "/guides/weebly/step-1.png",
      },
      {
        number: 2,
        title: "Go to Settings",
        description:
          'Click "Settings" in the top menu bar.',
        screenshot: "/guides/weebly/step-2.png",
      },
      {
        number: 3,
        title: "Find SEO settings",
        description:
          'Click "SEO" in the left sidebar.',
        screenshot: "/guides/weebly/step-3.png",
      },
      {
        number: 4,
        title: "Add the TeveroSEO helper",
        description:
          'Find "Header Code" and paste this:',
        code: PIXEL_SCRIPT,
        screenshot: "/guides/weebly/step-4.png",
      },
      {
        number: 5,
        title: "Save and publish",
        description:
          'Click "Save" and then "Publish". That\'s it!',
        helpLink: "/help/weebly",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // GoDaddy
  // -------------------------------------------------------------------------
  godaddy: {
    platform: "godaddy",
    name: "GoDaddy Website Builder",
    estimatedTime: "3 min",
    difficulty: "medium",
    paidPlanRequired: false,
    fallbackToGtm: true,
    steps: [
      {
        number: 1,
        title: "Log into GoDaddy",
        description: "Go to godaddy.com and sign in to your account.",
        screenshot: "/guides/godaddy/step-1.png",
      },
      {
        number: 2,
        title: "Go to your website",
        description:
          'Click "My Products" then "Manage" next to your website.',
        screenshot: "/guides/godaddy/step-2.png",
      },
      {
        number: 3,
        title: "Open Website Builder",
        description:
          'Click "Edit Website" or "Edit Site" to open the builder.',
        screenshot: "/guides/godaddy/step-3.png",
      },
      {
        number: 4,
        title: "Add the TeveroSEO helper",
        description:
          'Go to Settings (gear icon), find "Site-wide Code" or "Header", and paste:',
        code: PIXEL_SCRIPT,
        screenshot: "/guides/godaddy/step-4.png",
      },
      {
        number: 5,
        title: "Publish your site",
        description:
          'Click "Done" then "Publish". Done!',
        helpLink: "/help/godaddy",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // HubSpot CMS
  // -------------------------------------------------------------------------
  hubspot: {
    platform: "hubspot",
    name: "HubSpot CMS",
    estimatedTime: "2 min",
    difficulty: "easy",
    paidPlanRequired: true,
    fallbackToGtm: true,
    steps: [
      {
        number: 1,
        title: "Log into HubSpot",
        description:
          "Go to hubspot.com and sign in. Note: CMS Hub Professional or higher is needed.",
        screenshot: "/guides/hubspot/step-1.png",
      },
      {
        number: 2,
        title: "Go to Settings",
        description:
          'Click the gear icon in the top right to open Settings.',
        screenshot: "/guides/hubspot/step-2.png",
      },
      {
        number: 3,
        title: "Find Website Pages",
        description:
          'In the left menu, click "Website" then "Pages".',
        screenshot: "/guides/hubspot/step-3.png",
      },
      {
        number: 4,
        title: "Add the TeveroSEO helper",
        description:
          'Click "Site Header HTML" and paste this code:',
        code: PIXEL_SCRIPT,
        screenshot: "/guides/hubspot/step-4.png",
      },
      {
        number: 5,
        title: "Save your changes",
        description: 'Click "Save". The helper is now active on all pages.',
        helpLink: "/help/hubspot",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Ghost
  // -------------------------------------------------------------------------
  ghost: {
    platform: "ghost",
    name: "Ghost",
    estimatedTime: "2 min",
    difficulty: "easy",
    paidPlanRequired: false,
    fallbackToGtm: true,
    steps: [
      {
        number: 1,
        title: "Log into Ghost admin",
        description: "Go to yoursite.com/ghost and sign in.",
        screenshot: "/guides/ghost/step-1.png",
      },
      {
        number: 2,
        title: "Go to Settings",
        description:
          'Click the gear icon at the bottom of the left sidebar.',
        screenshot: "/guides/ghost/step-2.png",
      },
      {
        number: 3,
        title: "Find Code Injection",
        description:
          'Scroll down and click "Code injection" under Advanced.',
        screenshot: "/guides/ghost/step-3.png",
      },
      {
        number: 4,
        title: "Add the TeveroSEO helper",
        description:
          'In the "Site Header" box, paste this code:',
        code: PIXEL_SCRIPT,
        screenshot: "/guides/ghost/step-4.png",
      },
      {
        number: 5,
        title: "Save your changes",
        description: 'Click "Save". Done!',
        helpLink: "/help/ghost",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // BigCommerce
  // -------------------------------------------------------------------------
  bigcommerce: {
    platform: "bigcommerce",
    name: "BigCommerce",
    estimatedTime: "2 min",
    difficulty: "easy",
    paidPlanRequired: false,
    fallbackToGtm: true,
    steps: [
      {
        number: 1,
        title: "Log into BigCommerce",
        description: "Go to your BigCommerce admin panel and sign in.",
        screenshot: "/guides/bigcommerce/step-1.png",
      },
      {
        number: 2,
        title: "Go to Storefront",
        description:
          'Click "Storefront" in the left menu.',
        screenshot: "/guides/bigcommerce/step-2.png",
      },
      {
        number: 3,
        title: "Open Script Manager",
        description:
          'Click "Script Manager" in the submenu.',
        screenshot: "/guides/bigcommerce/step-3.png",
      },
      {
        number: 4,
        title: "Add the TeveroSEO helper",
        description:
          'Click "Create a Script". Name it "TeveroSEO", set location to "Head" and paste:',
        code: PIXEL_SCRIPT,
        screenshot: "/guides/bigcommerce/step-4.png",
      },
      {
        number: 5,
        title: "Save your changes",
        description:
          'Click "Save". The helper is now running on your store.',
        helpLink: "/help/bigcommerce",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // WooCommerce
  // -------------------------------------------------------------------------
  woocommerce: {
    platform: "woocommerce",
    name: "WooCommerce",
    estimatedTime: "2 min",
    difficulty: "easy",
    paidPlanRequired: false,
    fallbackToGtm: true,
    steps: [
      {
        number: 1,
        title: "Log into WordPress admin",
        description:
          "Go to yoursite.com/wp-admin and sign in. WooCommerce runs on WordPress.",
        screenshot: "/guides/woocommerce/step-1.png",
      },
      {
        number: 2,
        title: 'Go to Appearance, then Theme Editor',
        description:
          'Click "Appearance" then "Theme Editor" in the left menu.',
        screenshot: "/guides/woocommerce/step-2.png",
      },
      {
        number: 3,
        title: "Find header.php",
        description:
          'Click "header.php" (Theme Header) on the right side.',
        screenshot: "/guides/woocommerce/step-3.png",
      },
      {
        number: 4,
        title: "Add the TeveroSEO helper",
        description:
          "Find <head> and paste this line right after it:",
        code: PIXEL_SCRIPT,
        screenshot: "/guides/woocommerce/step-4.png",
      },
      {
        number: 5,
        title: "Save your changes",
        description:
          'Click "Update File". Done! Your store is connected.',
        helpLink: "/help/woocommerce",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Magento
  // -------------------------------------------------------------------------
  magento: {
    platform: "magento",
    name: "Magento",
    estimatedTime: "5 min",
    difficulty: "hard",
    paidPlanRequired: false,
    fallbackToGtm: true,
    steps: [
      {
        number: 1,
        title: "Log into Magento admin",
        description:
          "Go to yourstore.com/admin and sign in. This requires some technical know-how.",
        screenshot: "/guides/magento/step-1.png",
      },
      {
        number: 2,
        title: 'Go to Content, then Design',
        description:
          'Click "Content" in the left menu, then "Configuration" under Design.',
        screenshot: "/guides/magento/step-2.png",
      },
      {
        number: 3,
        title: "Edit your store view",
        description:
          'Find your store view and click "Edit" next to it.',
        screenshot: "/guides/magento/step-3.png",
      },
      {
        number: 4,
        title: "Add the TeveroSEO helper",
        description:
          'Expand "HTML Head" section and paste this in the "Miscellaneous" box:',
        code: PIXEL_SCRIPT,
        screenshot: "/guides/magento/step-4.png",
      },
      {
        number: 5,
        title: "Save and clear cache",
        description:
          'Click "Save Configuration" then go to System > Cache Management and click "Flush Magento Cache".',
        helpLink: "/help/magento",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Custom HTML
  // -------------------------------------------------------------------------
  custom_html: {
    platform: "custom_html",
    name: "Custom Website",
    estimatedTime: "1 min",
    difficulty: "easy",
    paidPlanRequired: false,
    fallbackToGtm: false,
    steps: [
      {
        number: 1,
        title: "Open your HTML file",
        description:
          "Open the main HTML file of your website (usually index.html) in a text editor.",
        screenshot: "/guides/custom/step-1.png",
      },
      {
        number: 2,
        title: "Find the head section",
        description:
          "Look for <head> near the top of the file.",
        screenshot: "/guides/custom/step-2.png",
      },
      {
        number: 3,
        title: "Add the TeveroSEO helper",
        description:
          "Paste this line right after <head>:",
        code: PIXEL_SCRIPT,
        screenshot: "/guides/custom/step-3.png",
      },
      {
        number: 4,
        title: "Save and upload",
        description:
          "Save the file and upload it to your web server. That's it! You're all done.",
        helpLink: "/help/custom",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // GTM Fallback (Universal Workaround)
  // -------------------------------------------------------------------------
  gtm_fallback: {
    platform: "gtm_fallback",
    name: "Google Tag Manager (Any Platform)",
    estimatedTime: "3 min",
    difficulty: "medium",
    paidPlanRequired: false,
    fallbackToGtm: false,
    steps: [
      {
        number: 1,
        title: "Log into Google Tag Manager",
        description:
          "Go to tagmanager.google.com and sign in. Create a container if you don't have one.",
        screenshot: "/guides/gtm/step-1.png",
      },
      {
        number: 2,
        title: "Create a new tag",
        description:
          'Click "Tags" in the left menu, then click "New" to create a new tag.',
        screenshot: "/guides/gtm/step-2.png",
      },
      {
        number: 3,
        title: 'Add Custom HTML tag',
        description:
          'Click "Tag Configuration" and choose "Custom HTML". Paste this code:',
        code: PIXEL_SCRIPT,
        screenshot: "/guides/gtm/step-3.png",
      },
      {
        number: 4,
        title: "Set trigger and publish",
        description:
          'Click "Triggering" and choose "All Pages". Name your tag "TeveroSEO" and click "Save". Then click "Submit" in the top right to publish.',
        helpLink: "/help/gtm",
      },
    ],
  },
};

// ============================================================================
// Exports
// ============================================================================

export const SUPPORTED_PLATFORMS = Object.keys(CMS_GUIDES);

/**
 * Get installation guide for a platform.
 *
 * @param platform - Platform key (e.g., 'shopify', 'wordpress_self_hosted')
 * @param siteId - Optional site ID to interpolate into code snippets
 * @returns InstallationGuide or undefined if platform not found
 */
export function getGuide(
  platform: string,
  siteId?: string
): InstallationGuide | undefined {
  const guide = CMS_GUIDES[platform];
  if (!guide) {
    return undefined;
  }

  // Clone and ensure content property is populated
  const normalizedSteps = guide.steps.map((step) => ({
    ...step,
    content: step.description, // Ensure content property exists
    code: siteId ? step.code?.replace(/\{\{SITE_ID\}\}/g, siteId) : step.code,
  }));

  return {
    ...guide,
    steps: normalizedSteps,
  };
}
