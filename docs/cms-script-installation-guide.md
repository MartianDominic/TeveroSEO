# CMS Script Installation Guide

> How to add a tracking/analytics script tag to every major CMS platform

## Quick Reference Table

| Platform | Difficulty | Clicks | Path | Gotchas |
|----------|------------|--------|------|---------|
| WordPress (self-hosted) | Easy | 3-4 | Appearance → Theme File Editor → header.php OR use plugin | Theme updates overwrite; use plugin instead |
| WordPress.com | Medium | 4 | Settings → Advanced → Code Injection | Business/eCommerce plan required ($25+/mo) |
| Shopify | Easy | 3 | Online Store → Themes → Edit Code → theme.liquid | None - straightforward |
| Wix | Easy | 4 | Settings → Custom Code → Add Code | Premium plan required |
| Squarespace | Easy | 4 | Settings → Advanced → Code Injection | Business plan or higher required |
| Webflow | Easy | 3 | Project Settings → Custom Code | Any paid plan works |
| Weebly | Easy | 3 | Settings → SEO → Header Code | Free plan supports this |
| GoDaddy Builder | Medium | 4 | Settings → Site-wide Settings → Head HTML | Limited to certain plans |
| HubSpot CMS | Easy | 3 | Settings → Website → Pages → Site Header HTML | Professional plan required |
| Ghost | Easy | 3 | Settings → Code Injection | All plans include this |
| BigCommerce | Easy | 4 | Storefront → Script Manager → Create Script | Built-in script manager |
| WooCommerce | Easy | 3-4 | Same as WordPress (it's a plugin) | Use WordPress methods |
| Magento | Hard | 5+ | Content → Design → Configuration → HTML Head | Developer recommended |
| Custom HTML | Easy | 1 | Edit HTML file directly | Full control, no restrictions |

---

## Detailed Instructions Per Platform

### WordPress (self-hosted)

**Difficulty:** Easy  
**Clicks from Dashboard:** 3-4  
**Non-technical friendly:** Yes (with plugin)  
**Developer access needed:** No

#### Method 1: Using a Plugin (Recommended)

**Best plugins:**
- **Insert Headers and Footers** (WPCode) - Most popular, free
- **Header Footer Code Manager** - Good alternative
- **WPCode** - Same as Insert Headers and Footers, rebranded

**Steps:**
1. Go to **Plugins → Add New**
2. Search for "Insert Headers and Footers" or "WPCode"
3. Click **Install Now**, then **Activate**
4. Go to **Code Snippets → Header & Footer** (or **Settings → Insert Headers and Footers**)
5. Paste your script in the **Header** section
6. Click **Save Changes**

**Why use a plugin:** Theme updates won't overwrite your script.

#### Method 2: Theme File Editor (Not Recommended)

**Steps:**
1. Go to **Appearance → Theme File Editor**
2. Select your active theme from the dropdown (right side)
3. Click on **header.php** in the file list
4. Paste your script just before the closing `</head>` tag
5. Click **Update File**

**Gotcha:** Theme updates will overwrite your changes. You'll need to re-add the script after every theme update.

#### Method 3: Child Theme functions.php (Developer Method)

```php
// Add to child theme's functions.php
add_action('wp_head', 'add_custom_script');
function add_custom_script() {
    ?>
    <script>
        // Your script here
    </script>
    <?php
}
```

---

### WordPress.com (Hosted)

**Difficulty:** Medium  
**Clicks from Dashboard:** 4  
**Non-technical friendly:** Yes  
**Developer access needed:** No  
**Plan required:** Business ($25/mo) or eCommerce ($45/mo)

**Steps:**
1. Go to **My Site** (left sidebar)
2. Click **Tools → Marketing**
3. Select **Traffic** tab
4. Scroll to **Site Verification Services** OR go to **Settings → General → Site Tools**
5. For full custom code: **Appearance → Customize → Additional CSS** (CSS only)

**Alternative for Business/eCommerce plans:**
1. Go to **My Site → Appearance → Customize**
2. Scroll down to **Additional CSS** (for CSS) 
3. For JavaScript: Install the **Insert Headers and Footers** plugin (requires Business plan to install plugins)

**Gotcha:** 
- Free and Personal plans CANNOT add custom scripts
- Premium plan allows limited tracking codes only (Google Analytics, etc.)
- Full script access requires Business plan ($25+/month)

---

### Shopify

**Difficulty:** Easy  
**Clicks from Dashboard:** 3  
**Non-technical friendly:** Yes  
**Developer access needed:** No

**Steps:**
1. Go to **Online Store → Themes**
2. Click **Actions** (or three dots) → **Edit code**
3. In the Layout folder, click **theme.liquid**
4. Find the `</head>` tag
5. Paste your script just before `</head>`
6. Click **Save**

**Alternative - Using Theme Settings (some themes):**
1. **Online Store → Themes → Customize**
2. **Theme Settings** (gear icon)
3. Look for **Custom Code** or **Header Scripts** section
4. Paste script and save

**Alternative - Using Shopify's Script Editor (Plus plans):**
For Shopify Plus merchants, use the Script Editor app for checkout scripts.

**Gotcha:** None - this is straightforward. All plans can add custom code.

---

### Wix

**Difficulty:** Easy  
**Clicks from Dashboard:** 4  
**Non-technical friendly:** Yes  
**Developer access needed:** No  
**Plan required:** Premium (any paid plan)

**Steps:**
1. Go to **Settings** (gear icon in dashboard)
2. Click **Custom Code** under "Advanced"
3. Click **+ Add Code** (top right)
4. Paste your script in the code box
5. Name it (e.g., "Analytics Script")
6. Choose placement:
   - **Head** - for tracking scripts (recommended)
   - **Body - start** - loads early
   - **Body - end** - loads last
7. Choose pages: **All pages** or specific pages
8. Click **Apply**

**Gotcha:** 
- Free Wix sites cannot add custom code
- Must have any Premium plan (Connect Domain or higher)

---

### Squarespace

**Difficulty:** Easy  
**Clicks from Dashboard:** 4  
**Non-technical friendly:** Yes  
**Developer access needed:** No  
**Plan required:** Business ($23/mo) or higher

**Steps:**
1. Go to **Settings** (gear icon)
2. Click **Advanced**
3. Click **Code Injection**
4. Paste your script in the **Header** field (loads on all pages)
5. Click **Save**

**Per-page scripts:**
1. Go to **Pages**
2. Hover over a page, click the **gear icon**
3. Scroll to **Advanced**
4. Find **Page Header Code Injection**
5. Paste script and save

**Gotcha:**
- Personal plan ($16/mo) does NOT support code injection
- Need Business plan ($23/mo) or higher
- Scripts in Code Injection don't work in preview mode

---

### Webflow

**Difficulty:** Easy  
**Clicks from Dashboard:** 3  
**Non-technical friendly:** Yes  
**Developer access needed:** No  
**Plan required:** Any paid site plan

**Steps (Site-wide):**
1. Click the **Project Settings** gear icon (left panel)
2. Go to **Custom Code** tab
3. Paste your script in **Head Code** section
4. Click **Save Changes**
5. **Publish** your site for changes to go live

**Steps (Per-page):**
1. Select the page in the Pages panel
2. Click the **gear icon** for page settings
3. Scroll to **Custom Code**
4. Add to **Inside <head> tag** or **Before </body> tag**
5. Save and publish

**Gotcha:**
- Custom code only works on published sites, not in preview
- Free Webflow.io subdomain sites CAN add custom code
- Must republish after adding code

---

### Weebly

**Difficulty:** Easy  
**Clicks from Dashboard:** 3  
**Non-technical friendly:** Yes  
**Developer access needed:** No  
**Plan required:** Free plan works!

**Steps:**
1. Click **Settings** in the editor
2. Click **SEO**
3. Find **Header Code** field
4. Paste your script
5. Click **Save** then **Publish**

**Alternative (Footer):**
1. **Settings → SEO**
2. Use **Footer Code** field for scripts that should load last

**Gotcha:**
- One of the few platforms where free plans allow custom code
- Must publish for changes to take effect

---

### GoDaddy Website Builder

**Difficulty:** Medium  
**Clicks from Dashboard:** 4  
**Non-technical friendly:** Yes  
**Developer access needed:** No  
**Plan required:** Premium or higher

**Steps:**
1. Open your website in the editor
2. Click **Settings** (gear icon, top right)
3. Click **Site-wide Settings**
4. Find **Head HTML** or **Code Injection** section
5. Paste your script
6. Click **Done** then **Publish**

**Gotcha:**
- Not available on basic free plan
- Interface can vary between "Websites + Marketing" and older builders
- Limited compared to other platforms

---

### HubSpot CMS

**Difficulty:** Easy  
**Clicks from Dashboard:** 3  
**Non-technical friendly:** Yes  
**Developer access needed:** No  
**Plan required:** Professional ($400+/mo) or Enterprise

**Steps:**
1. Go to **Settings** (gear icon)
2. Navigate to **Website → Pages**
3. Click **Site Header HTML** tab
4. Paste your script
5. Click **Save**

**Alternative (Per-page):**
1. Edit the page
2. Click **Settings** tab
3. Find **Additional code snippets**
4. Add to **Head HTML** or **Footer HTML**

**Gotcha:**
- Free HubSpot CMS tools have very limited customization
- Full code injection requires Professional plan ($400+/month)
- HubSpot's tracking code is automatically included

---

### Ghost

**Difficulty:** Easy  
**Clicks from Dashboard:** 3  
**Non-technical friendly:** Yes  
**Developer access needed:** No  
**Plan required:** All plans (including self-hosted free)

**Steps:**
1. Go to **Settings** (gear icon)
2. Click **Code injection**
3. Paste your script in **Site Header** (for `<head>`)
4. Or use **Site Footer** (for before `</body>`)
5. Click **Save**

**Gotcha:**
- None! Ghost makes this very simple
- Works on Ghost(Pro) hosted and self-hosted
- All plans include code injection

---

### BigCommerce

**Difficulty:** Easy  
**Clicks from Dashboard:** 4  
**Non-technical friendly:** Yes  
**Developer access needed:** No

**Steps (Script Manager - Recommended):**
1. Go to **Storefront → Script Manager**
2. Click **Create a Script**
3. Enter script name and description
4. Choose **Location:**
   - **Head** - for tracking (recommended)
   - **Footer** - loads last
5. Choose **Pages:**
   - All pages, Checkout, Order Confirmation, etc.
6. Paste script in **Script Contents**
7. Click **Save**

**Gotcha:**
- Script Manager is the cleanest solution
- Checkout page scripts may require specific placement
- Some scripts need "All Pages" + "Checkout" separately

---

### WooCommerce

**Difficulty:** Easy  
**Clicks from Dashboard:** 3-4  
**Non-technical friendly:** Yes (with plugin)  
**Developer access needed:** No

**WooCommerce is a WordPress plugin, so use WordPress methods:**

1. **Plugin method:** Use "Insert Headers and Footers" (same as WordPress)
2. **Theme method:** Edit header.php (same as WordPress)
3. **functions.php method:** (same as WordPress)

**WooCommerce-specific hooks:**

```php
// Add script to checkout page only
add_action('woocommerce_before_checkout_form', 'checkout_script');
function checkout_script() {
    ?>
    <script>// Your checkout tracking script</script>
    <?php
}

// Add script to thank you page
add_action('woocommerce_thankyou', 'thankyou_script');
function thankyou_script() {
    ?>
    <script>// Your conversion tracking script</script>
    <?php
}
```

**Gotcha:** Same as WordPress - use plugins to survive theme updates.

---

### Magento (Adobe Commerce)

**Difficulty:** Hard  
**Clicks from Dashboard:** 5+  
**Non-technical friendly:** No  
**Developer access needed:** Recommended

**Method 1: Admin Panel (Limited)**
1. Go to **Content → Design → Configuration**
2. Select your store view, click **Edit**
3. Expand **HTML Head**
4. Find **Scripts and Style Sheets** field
5. Add your script
6. Click **Save Configuration**
7. Flush cache: **System → Cache Management → Flush**

**Method 2: XML Layout (Developer Method)**

Create/edit: `app/design/frontend/[Vendor]/[theme]/Magento_Theme/layout/default_head_blocks.xml`

```xml
<?xml version="1.0"?>
<page xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd">
    <head>
        <script src="https://example.com/script.js"/>
    </head>
</page>
```

**Method 3: PHTML Template (Developer Method)**

Edit: `app/design/frontend/[Vendor]/[theme]/Magento_Theme/templates/html/header.phtml`

**Gotcha:**
- Magento is complex; admin panel method is limited
- Always clear cache after changes
- Consider using Google Tag Manager instead
- Version differences (Magento 1 vs 2) have different processes
- Developer assistance recommended

---

### Custom HTML Site

**Difficulty:** Easy  
**Clicks:** 1 (open file, edit, save)  
**Non-technical friendly:** Basic HTML knowledge needed  
**Developer access needed:** No (but need file access)

**Steps:**
1. Open your HTML file in a text editor
2. Find the `</head>` tag
3. Paste your script just before `</head>`
4. Save the file
5. Upload to your server (FTP, cPanel, etc.)

**Example:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>My Site</title>
    <!-- Your other head content -->
    
    <!-- Paste tracking script here -->
    <script>
        // Your script code
    </script>
</head>
<body>
    <!-- Page content -->
</body>
</html>
```

**For multiple pages:**
- Use a templating system (PHP includes, SSG, etc.)
- Or use a build tool to inject scripts
- Or manually add to each HTML file

**Gotcha:**
- Must update every HTML file if not using includes
- Need FTP/file access to upload changes

---

## Platforms Requiring Developer Access

| Platform | Why Developer Needed |
|----------|---------------------|
| Magento | Complex file structure, caching, XML layouts |
| Custom enterprise CMS | Varies by implementation |
| Headless CMS | Scripts go in frontend app, not CMS |

## Platforms Requiring Paid Plans

| Platform | Minimum Plan for Scripts |
|----------|-------------------------|
| WordPress.com | Business ($25/mo) |
| Wix | Any Premium plan |
| Squarespace | Business ($23/mo) |
| GoDaddy | Premium tier |
| HubSpot CMS | Professional ($400+/mo) |

## Platforms with Free Script Support

| Platform | Notes |
|----------|-------|
| WordPress (self-hosted) | Free with plugins |
| Weebly | Free plan includes custom code |
| Ghost (self-hosted) | Free, full control |
| Webflow | Free Webflow.io sites can add code |
| BigCommerce | Included in all plans |

---

## Universal Alternative: Google Tag Manager

If a platform makes script installation difficult, consider using Google Tag Manager (GTM):

1. Install GTM container code once (using methods above)
2. Add all future scripts through GTM interface
3. No need to touch CMS code again

**GTM Benefits:**
- One-time CMS installation
- Add/remove scripts without touching site code
- Version control and preview mode
- Works on all platforms that allow any script

---

## Script Placement Best Practices

| Script Type | Placement | Why |
|-------------|-----------|-----|
| Analytics (GA4, etc.) | Head | Track pageviews early |
| Chat widgets | Body end | Don't block page load |
| A/B testing | Head (early) | Prevent flicker |
| Conversion tracking | Body end or specific pages | Load after content |
| Performance monitoring | Head | Capture full page load |

---

*Last updated: May 2025*
