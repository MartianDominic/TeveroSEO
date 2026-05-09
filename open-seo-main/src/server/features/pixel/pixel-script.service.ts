/**
 * PixelScriptService - Generates TeveroPixel scripts.
 * Phase 66: Platform Unification Excellence - Plan 01
 *
 * Provides:
 * - Script snippet generation (<5KB async loader)
 * - Installation management (get or create)
 * - Configuration retrieval for pixel runtime
 */
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  pixelInstallations,
  type PixelFeatures,
  type PixelInstallationSelect,
} from "@/db/pixel-schema";
import type { DbClient } from "@/db";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Configuration returned to the pixel runtime
 */
export interface PixelScriptConfig {
  siteId: string;
  workspaceId: string;
  allowedOrigins: string[];
  features: PixelFeatures;
  approvedChanges?: ApprovedChange[];
}

/**
 * Approved DOM change for the pixel to execute
 */
export interface ApprovedChange {
  id: string;
  changeType: string;
  targetSelector?: string;
  targetUrl?: string;
  newValue: string;
}

// -----------------------------------------------------------------------------
// Pure Functions (no DB dependency)
// -----------------------------------------------------------------------------

/**
 * Generate the pixel script snippet for embedding.
 * This is the one-line script users paste into their site.
 *
 * @param siteId - Unique site identifier (used in data-site attribute)
 * @param baseUrl - Optional base URL for the pixel (defaults to pixel.tevero.io)
 * @returns HTML script tag string
 */
export function generatePixelScript(
  siteId: string,
  baseUrl = "https://pixel.tevero.io"
): string {
  return `<script async src="${baseUrl}/t.js" data-site="${siteId}"></script>`;
}

/**
 * Generate the pixel loader (t.js content).
 * This is the actual JavaScript that runs on the client site.
 *
 * IMPORTANT: Keep this under 5KB uncompressed for fast loading.
 *
 * NOTE: The empty catch block in observe() is intentional for browser compatibility.
 * PerformanceObserver.observe() throws on unsupported entry types in older browsers.
 * Silent failure is the correct behavior - we don't want to break client sites or
 * expose internal errors to end users. This is standard practice for browser analytics.
 *
 * @returns Minified JavaScript string
 */
export function generatePixelLoader(): string {
  // The loader script - designed to be compact and efficient
  // Uses IIFE pattern to avoid global namespace pollution
  return `(function(){
"use strict";
var d=document,w=window,n=navigator,l=location;
var s=d.currentScript,siteId=s&&s.dataset.site;
if(!siteId)return;

var api="https://pixel.tevero.io",cfg=null,q=[];
var sid=sessionStorage.getItem("_tp_sid")||Math.random().toString(36).slice(2);
sessionStorage.setItem("_tp_sid",sid);

function send(t,data){
var p={s:siteId,t:t,d:data,ts:Date.now(),sid:sid,url:l.href,ref:d.referrer};
if(n.sendBeacon){n.sendBeacon(api+"/collect",JSON.stringify(p))}
else{var x=new XMLHttpRequest();x.open("POST",api+"/collect",true);x.send(JSON.stringify(p))}
}

function track(t,data){if(cfg){send(t,data)}else{q.push([t,data])}}

function initAnalytics(){
track("pageview",{title:d.title});
var scrollDepths=[25,50,75,100],scrolled={};
function checkScroll(){
var h=d.documentElement,b=d.body;
var st=w.pageYOffset||h.scrollTop||b.scrollTop;
var sh=Math.max(h.scrollHeight,b.scrollHeight)-w.innerHeight;
var pct=sh>0?Math.round(st/sh*100):100;
scrollDepths.forEach(function(d){if(pct>=d&&!scrolled[d]){scrolled[d]=1;track("scroll",{depth:d})}});
}
w.addEventListener("scroll",checkScroll,{passive:true});
d.addEventListener("click",function(e){
var a=e.target.closest("a");if(a&&a.href){track("click",{href:a.href,text:(a.textContent||"").slice(0,50)})}
});
}

function initCWV(){
if(!w.PerformanceObserver)return;
function observe(type,cb){
try{var po=new PerformanceObserver(function(l){l.getEntries().forEach(cb)});
po.observe({type:type,buffered:true})}catch(e){}
}
observe("largest-contentful-paint",function(e){track("cwv",{lcp:Math.round(e.startTime)})});
observe("layout-shift",function(e){if(!e.hadRecentInput){track("cwv",{cls:e.value})}});
observe("first-input",function(e){track("cwv",{inp:Math.round(e.processingStart-e.startTime)})});
}

function applyChanges(changes){
if(!changes||!changes.length)return;
changes.forEach(function(c){
if(c.changeType==="meta_title"){d.title=c.newValue}
else if(c.changeType==="meta_description"){
var m=d.querySelector('meta[name="description"]');
if(m){m.content=c.newValue}else{var nm=d.createElement("meta");nm.name="description";nm.content=c.newValue;d.head.appendChild(nm)}
}
else if(c.changeType==="canonical"){
var cl=d.querySelector('link[rel="canonical"]');
if(cl){cl.href=c.newValue}else{var nl=d.createElement("link");nl.rel="canonical";nl.href=c.newValue;d.head.appendChild(nl)}
}
else if(c.changeType==="schema"&&c.newValue){
var sc=d.createElement("script");sc.type="application/ld+json";sc.textContent=c.newValue;d.head.appendChild(sc)}
else if(c.changeType==="internal_link"&&c.targetSelector){
var el=d.querySelector(c.targetSelector);
if(el){var a=d.createElement("a");a.href=c.newValue;a.textContent=c.targetSelector.split(":")[1]||"Link";el.appendChild(a)}}
});
}

function handleSPA(){
var pu=history.pushState;
history.pushState=function(){pu.apply(history,arguments);track("pageview",{title:d.title,spa:1})};
w.addEventListener("popstate",function(){track("pageview",{title:d.title,spa:1})});
}

fetch(api+"/config/"+siteId).then(function(r){return r.json()}).then(function(c){
cfg=c;
q.forEach(function(e){send(e[0],e[1])});q=[];
if(c.features){
if(c.features.analytics){initAnalytics()}
if(c.features.cwv){initCWV()}
if(c.features.metaInjection||c.features.schemaInjection||c.features.linkInjection){applyChanges(c.approvedChanges)}
}
handleSPA();
}).catch(function(){cfg={features:{analytics:true,cwv:true}};initAnalytics();initCWV()});
})();`;
}

// -----------------------------------------------------------------------------
// Service Class
// -----------------------------------------------------------------------------

/**
 * PixelScriptService - Manages pixel installations and configurations.
 */
export class PixelScriptService {
  constructor(private readonly db: DbClient) {}

  /**
   * Get or create a pixel installation for a workspace and domain.
   *
   * @param workspaceId - Workspace ID
   * @param domain - Target domain
   * @returns Pixel installation record
   */
  async getOrCreateInstallation(
    workspaceId: string,
    domain: string
  ): Promise<PixelInstallationSelect> {
    // Normalize domain (remove protocol, www, path)
    const normalizedDomain = this.normalizeDomain(domain);

    // Check for existing installation
    const existing = await this.db.query.pixelInstallations.findFirst({
      where: and(
        eq(pixelInstallations.workspaceId, workspaceId),
        eq(pixelInstallations.domain, normalizedDomain)
      ),
    });

    if (existing) {
      return existing;
    }

    // Create new installation
    const [newInstallation] = await this.db
      .insert(pixelInstallations)
      .values({
        id: nanoid(),
        workspaceId,
        siteId: nanoid(16), // Short unique ID for data-site attribute
        domain: normalizedDomain,
        status: "pending",
        features: {
          analytics: true,
          cwv: true,
          metaInjection: false,
          schemaInjection: false,
          linkInjection: false,
          abTesting: false,
        },
        allowedOrigins: [
          `https://${normalizedDomain}`,
          `https://www.${normalizedDomain}`,
        ],
      })
      .returning();

    return newInstallation;
  }

  /**
   * Get installation by siteId (the data-site attribute value).
   *
   * @param siteId - Site ID from pixel data-site attribute
   * @returns Installation or null
   */
  async getInstallationBySiteId(
    siteId: string
  ): Promise<PixelInstallationSelect | null> {
    const installation = await this.db.query.pixelInstallations.findFirst({
      where: eq(pixelInstallations.siteId, siteId),
    });

    return installation ?? null;
  }

  /**
   * Get configuration for a pixel installation.
   * This is what the pixel loader fetches at runtime.
   *
   * @param siteId - Site ID from pixel data-site attribute
   * @returns Configuration or null
   */
  async getInstallationConfig(
    siteId: string
  ): Promise<PixelScriptConfig | null> {
    const installation = await this.getInstallationBySiteId(siteId);

    if (!installation) {
      return null;
    }

    // TODO: In future plans, also fetch approved changes
    // const approvedChanges = await this.getApprovedChanges(installation.id);

    return {
      siteId: installation.siteId,
      workspaceId: installation.workspaceId,
      allowedOrigins: installation.allowedOrigins ?? [],
      features: installation.features ?? {
        analytics: true,
        cwv: true,
        metaInjection: false,
        schemaInjection: false,
        linkInjection: false,
        abTesting: false,
      },
      // approvedChanges will be populated in 66-02 when we implement DOM changes
    };
  }

  /**
   * Generate the script snippet for a specific installation.
   *
   * @param siteId - Site ID
   * @param baseUrl - Optional base URL
   * @returns HTML script tag
   */
  generateScriptSnippet(
    siteId: string,
    baseUrl = "https://pixel.tevero.io"
  ): string {
    return generatePixelScript(siteId, baseUrl);
  }

  /**
   * Normalize a domain string.
   * Removes protocol, www prefix, path, and port.
   */
  private normalizeDomain(domain: string): string {
    let normalized = domain.toLowerCase().trim();

    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, "");

    // Remove www prefix
    normalized = normalized.replace(/^www\./, "");

    // Remove path
    normalized = normalized.split("/")[0];

    // Remove port
    normalized = normalized.split(":")[0];

    return normalized;
  }
}
