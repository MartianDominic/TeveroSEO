# ============================================================
# SECURITY: Environment validation MUST run before any other imports
# This ensures the app fails fast if required secrets are missing
# ============================================================
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables FIRST (before validation)
backend_dir = Path(__file__).parent
project_root = backend_dir.parent
load_dotenv(backend_dir / '.env')  # backend/.env (higher priority)
load_dotenv(project_root / '.env')  # root .env (fallback)
load_dotenv()  # CWD .env (fallback)

# Validate environment variables - fails fast if required secrets are missing
from config.env_validator import validate_env, log_env_status, is_configured
validate_env()

# ============================================================
# Standard imports (after environment validation passes)
# ============================================================

# Ensure typing constructs and models are available globally for FastAPI type annotation evaluation
import typing
import builtins

# Make common typing constructs available globally
builtins.Optional = typing.Optional
builtins.List = typing.List
builtins.Dict = typing.Dict
builtins.Any = typing.Any
builtins.Union = typing.Union

# Import onboarding models VERY early to ensure they're available before any services
from models.onboarding import APIKey, WebsiteAnalysis, ResearchPreferences, PersonaData, CompetitorAnalysis


from fastapi import FastAPI, HTTPException, Depends, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional
from loguru import logger
import asyncio
from datetime import datetime

# Import OnboardingSession right after basic imports to ensure it's available
from models.onboarding import OnboardingSession

from services.subscription import monitoring_middleware

# Import remaining onboarding models
from models import APIKey, WebsiteAnalysis, ResearchPreferences, PersonaData, CompetitorAnalysis

# Import modular utilities
from alwrity_utils import HealthChecker, RateLimiter, FrontendServing, RouterManager
from alwrity_utils import OnboardingManager

# Set up clean logging for end users
from logging_config import setup_clean_logging
setup_clean_logging()

# Import middleware
from middleware.auth_middleware import get_current_user
from middleware.security_headers import SecurityHeadersMiddleware
from middleware.rate_limit import RateLimitMiddleware

# Import component logic endpoints (needs OnboardingSession, so import after models)
from api.component_logic import router as component_logic_router

# Import subscription API endpoints
from api.subscription import router as subscription_router

# Import Step 3 onboarding routes
from api.onboarding_utils.step3_routes import router as step3_routes

# Import per-client OAuth router (Phase 12)
from api.client_oauth import router as client_oauth_router

# Import internal API router (Phase 13 - service-to-service token access)
from api.internal import router as internal_router

# Import SEO tools router
from routers.seo_tools import router as seo_tools_router

# Import SEO analytics router (Phase 14 - dashboard aggregation)
from routers.seo_analytics import router as seo_analytics_router
# Import Facebook Writer endpoints
from api.facebook_writer.routers import facebook_router
from api.brainstorm import router as brainstorm_router
from api.images import router as images_router
from routers.image_studio import router as image_studio_router
from routers.product_marketing import router as product_marketing_router
from routers.campaign_creator import router as campaign_creator_router

# Import hallucination detector router
from api.hallucination_detector import router as hallucination_detector_router
from api.writing_assistant import router as writing_assistant_router

# Import research configuration router
from api.research_config import router as research_config_router

# Import user data endpoints
# Import content planning endpoints
from api.content_planning.api.router import router as content_planning_router
from api.user_data import router as user_data_router

# Import user environment endpoints
from api.user_environment import router as user_environment_router

# Import strategy copilot endpoints
from api.content_planning.strategy_copilot import router as strategy_copilot_router

# Import database service
from services.database import init_database, close_database

# Trigger reload for monitoring fix

# Import OAuth token monitoring routes
from api.oauth_token_monitoring_routes import router as oauth_token_monitoring_router

# Import SEO Dashboard endpoints
from api.seo_dashboard import (
    get_seo_dashboard_data,
    get_seo_health_score,
    get_seo_metrics,
    get_platform_status,
    get_ai_insights,
    seo_dashboard_health_check,
    analyze_seo_comprehensive,
    analyze_seo_full,
    get_seo_metrics_detailed,
    get_analysis_summary,
    batch_analyze_urls,
    SEOAnalysisRequest,
    get_seo_dashboard_overview,
    get_gsc_raw_data,
    get_bing_raw_data,
    get_competitive_insights,
    get_deep_competitor_analysis,
    run_strategic_insights,
    get_strategic_insights_history,
    refresh_analytics_data,
    analyze_urls_ai,
    AnalyzeURLsRequest,
    get_analyzed_pages,
    get_semantic_health,
    get_semantic_cache_stats,
    get_sif_indexing_health,
)

def validate_production_config():
    """
    Reject dangerous configurations in production.
    Raises ValueError if dangerous flags are enabled in production.
    """
    env = os.getenv("ENV", "development").lower()
    if env != "production":
        return  # Only validate in production

    dangerous_flags = {
        "DISABLE_AUTH": "Authentication bypass is not allowed in production",
        "SKIP_AUTH": "Authentication bypass is not allowed in production",
        "DEBUG_MODE": "Debug mode must be disabled in production",
        "QUALITY_GATE_ENABLED": None,  # Special check: must be true or unset
    }

    for flag, error_msg in dangerous_flags.items():
        value = os.getenv(flag, "").lower()

        if flag == "QUALITY_GATE_ENABLED":
            # Quality gate must be enabled (true or unset) in production
            if value == "false":
                raise ValueError(
                    f"{flag}=false is not allowed in production. "
                    "Quality gate must be enabled to prevent low-quality content publishing."
                )
        else:
            # These flags must be false or unset in production
            if value == "true":
                raise ValueError(f"{flag}=true is not allowed in production. {error_msg}")

    logger.info("Production config validation passed")


# Initialize FastAPI app
app = FastAPI(
    title="ALwrity Backend API",
    description="Backend API for ALwrity - AI-powered content creation platform",
    version="1.0.0"
)

# Add CORS middleware with proper security configuration
# SECURITY: Never use wildcard "*" with credentials=True
# Production origins are explicitly defined for TeveroSEO platform
PRODUCTION_ORIGINS = [
    "https://app.teveroseo.com",
    "https://teveroseo.com",
    "https://api.teveroseo.com",
    "https://alwrity-ai.vercel.app",
]

# Development origins (only used when NODE_ENV != production)
DEVELOPMENT_ORIGINS = [
    "http://localhost:3000",  # React dev server
    "http://localhost:8000",  # Backend dev server
    "http://localhost:3001",  # Alternative React port / Next.js
]

# Build allowed origins based on environment
is_production = os.getenv("NODE_ENV", "").lower() == "production"

if is_production:
    # Production: only allow explicit production origins
    allowed_origins = PRODUCTION_ORIGINS.copy()
else:
    # Development: allow both production and development origins
    allowed_origins = PRODUCTION_ORIGINS + DEVELOPMENT_ORIGINS

    # Optional dynamic origins from environment (comma-separated)
    env_origins = os.getenv("ALWRITY_ALLOWED_ORIGINS", "").split(",") if os.getenv("ALWRITY_ALLOWED_ORIGINS") else []
    env_origins = [o.strip() for o in env_origins if o.strip()]

    # Convenience: NGROK_URL env var (single origin for tunneling)
    ngrok_origin = os.getenv("NGROK_URL")
    if ngrok_origin:
        env_origins.append(ngrok_origin.strip())

    allowed_origins.extend(env_origins)

# De-duplicate while preserving order
allowed_origins = list(dict.fromkeys(allowed_origins))

# Log CORS configuration on startup
logger.info(f"CORS configured for {'production' if is_production else 'development'} mode")
logger.info(f"Allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Explicit origins, NEVER "*"
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    max_age=86400,  # Cache preflight for 24 hours
)

# Initialize modular utilities
health_checker = HealthChecker()
rate_limiter = RateLimiter(window_seconds=60, max_requests=200)
frontend_serving = FrontendServing(app)
router_manager = RouterManager(app)

onboarding_manager = OnboardingManager(app)

# Middleware Order (FastAPI executes in REVERSE order of registration - LIFO):
# Registration order:  1. Security Headers  2. Rate Limit (new)  3. Monitoring  4. Rate Limit (legacy)  5. API Key Injection
# Execution order:     1. API Key Injection  2. Rate Limit (legacy)  3. Monitoring  4. Rate Limit (new)  5. Security Headers (adds headers last)

# 1. FIRST REGISTERED (runs LAST) - Security headers middleware
# Adds OWASP security headers to all responses
app.add_middleware(SecurityHeadersMiddleware)

# 2. Rate limiting middleware (endpoint-specific rate limits)
# Applies sliding window rate limits based on path patterns
app.add_middleware(RateLimitMiddleware)

# 2. SECOND REGISTERED (runs THIRD) - Monitoring middleware
app.middleware("http")(monitoring_middleware)

# 2. SECOND REGISTERED (runs SECOND) - Rate limiting
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Rate limiting middleware using modular utilities."""
    return await rate_limiter.rate_limit_middleware(request, call_next)

# 3. LAST REGISTERED (runs FIRST) - API key injection
from middleware.api_key_injection_middleware import api_key_injection_middleware
app.middleware("http")(api_key_injection_middleware)

# Health check endpoints using modular utilities
@app.get("/health")
async def health():
    """Health check endpoint."""
    return health_checker.basic_health_check()

@app.get("/health/database")
async def database_health():
    """Database health check endpoint."""
    return health_checker.database_health_check()

@app.get("/health/comprehensive")
async def comprehensive_health():
    """Comprehensive health check endpoint."""
    return health_checker.comprehensive_health_check()

# Rate limiting management endpoints
@app.get("/api/rate-limit/status")
async def rate_limit_status(request: Request):
    """Get current rate limit status for the requesting client."""
    client_ip = request.client.host if request.client else "unknown"
    return rate_limiter.get_rate_limit_status(client_ip)

@app.post("/api/rate-limit/reset")
async def reset_rate_limit(request: Request, client_ip: Optional[str] = None):
    """Reset rate limit for a specific client or all clients."""
    if client_ip is None:
        client_ip = request.client.host if request.client else "unknown"
    return rate_limiter.reset_rate_limit(client_ip)

# Frontend serving management endpoints
@app.get("/api/frontend/status")
async def frontend_status():
    """Get frontend serving status."""
    return frontend_serving.get_frontend_status()

# Router management endpoints
@app.get("/api/routers/status")
async def router_status():
    """Get router inclusion status."""
    return router_manager.get_router_status()

@app.get("/api/feature-profile/status")
async def feature_profile_status():
    """Get feature profile status and enabled modules."""
    return router_manager.get_feature_profile_status()

# Onboarding management endpoints
@app.get("/api/onboarding/status")
async def onboarding_status():
    """Get onboarding manager status."""
    return onboarding_manager.get_onboarding_status()

# Include routers using modular utilities
router_manager.include_core_routers()
# Safety net: keep subscription routes available even if core inclusion flow changes
# in special modes (e.g., demo mode). De-dup is handled by RouterManager.
router_manager.include_router_safely(subscription_router, "subscription")
router_manager.include_optional_routers()

# SEO Dashboard endpoints
@app.get("/api/seo-dashboard/data")
async def seo_dashboard_data(current_user: dict = Depends(get_current_user)):
    """Get complete SEO dashboard data."""
    return await get_seo_dashboard_data()

@app.get("/api/seo-dashboard/health-score")
async def seo_health_score(current_user: dict = Depends(get_current_user)):
    """Get SEO health score."""
    return await get_seo_health_score()

@app.get("/api/seo-dashboard/metrics")
async def seo_metrics(current_user: dict = Depends(get_current_user)):
    """Get SEO metrics."""
    return await get_seo_metrics()

@app.get("/api/seo-dashboard/platforms")
async def seo_platforms(current_user: dict = Depends(get_current_user)):
    """Get platform status."""
    return await get_platform_status(current_user)

@app.get("/api/seo-dashboard/insights")
async def seo_insights(current_user: dict = Depends(get_current_user)):
    """Get AI insights."""
    return await get_ai_insights()

# New SEO Dashboard endpoints with real data
@app.get("/api/seo-dashboard/overview")
async def seo_dashboard_overview_endpoint(current_user: dict = Depends(get_current_user), site_url: str = None):
    """Get comprehensive SEO dashboard overview with real GSC/Bing data."""
    return await get_seo_dashboard_overview(current_user, site_url)

@app.get("/api/seo-dashboard/gsc/raw")
async def gsc_raw_data_endpoint(current_user: dict = Depends(get_current_user), site_url: str = None):
    """Get raw GSC data for the specified site."""
    return await get_gsc_raw_data(current_user, site_url)

@app.get("/api/seo-dashboard/bing/raw")
async def bing_raw_data_endpoint(current_user: dict = Depends(get_current_user), site_url: str = None):
    """Get raw Bing data for the specified site."""
    return await get_bing_raw_data(current_user, site_url)

@app.get("/api/seo-dashboard/competitive-insights")
async def competitive_insights_endpoint(current_user: dict = Depends(get_current_user), site_url: str = None):
    """Get competitive insights from onboarding step 3 data."""
    return await get_competitive_insights(current_user, site_url)

@app.get("/api/seo-dashboard/deep-competitor-analysis")
async def deep_competitor_analysis_endpoint(current_user: dict = Depends(get_current_user), site_url: str = None):
    """Get deep competitor analysis results (auto-scheduled post-onboarding)."""
    return await get_deep_competitor_analysis(current_user, site_url)

@app.post("/api/seo-dashboard/strategic-insights/run")
async def run_strategic_insights_endpoint(current_user: dict = Depends(get_current_user)):
    """Run AI-powered strategic insights analysis manually."""
    return await run_strategic_insights(current_user)

@app.get("/api/seo-dashboard/strategic-insights/history")
async def get_strategic_insights_history_endpoint(current_user: dict = Depends(get_current_user)):
    """Fetch the history of strategic insights for the user."""
    return await get_strategic_insights_history(current_user)

@app.post("/api/seo-dashboard/refresh")
async def refresh_analytics_data_endpoint(current_user: dict = Depends(get_current_user), site_url: str = None):
    """Refresh analytics data by invalidating cache and fetching fresh data."""
    return await refresh_analytics_data(current_user, site_url)

@app.get("/api/seo-dashboard/health")
async def seo_dashboard_health():
    """Health check for SEO dashboard."""
    return await seo_dashboard_health_check()

# Phase 2B: Semantic health monitoring endpoint (24-hour polling)
@app.get("/api/seo-dashboard/semantic-health")
async def semantic_health_endpoint(current_user: dict = Depends(get_current_user)):
    """
    Get real-time semantic health metrics for content and competitors.
    This endpoint provides Phase 2B semantic intelligence monitoring data.
    
    Returns semantic health score, status, and recommendations.
    Data is cached and updated every 24 hours via scheduler.
    """
    return await get_semantic_health(current_user)


@app.get("/api/seo-dashboard/cache-stats")
async def semantic_cache_stats_endpoint(current_user: dict = Depends(get_current_user)):
    """
    Get semantic cache performance statistics.
    Returns hit rate, memory usage, and eviction counts.
    """
    return await get_semantic_cache_stats(current_user)


@app.get("/api/seo-dashboard/sif-health")
async def sif_indexing_health_endpoint(current_user: dict = Depends(get_current_user)):
    """
    Get SIF indexing health summary for the current user.
    Used by the Semantic Indexing Status widget on the dashboard.
    """
    return await get_sif_indexing_health(current_user)

# Comprehensive SEO Analysis endpoints
@app.post("/api/seo-dashboard/analyze-comprehensive")
async def analyze_seo_comprehensive_endpoint(
    request: SEOAnalysisRequest,
    current_user: dict = Depends(get_current_user),
):
    """Analyze a URL for comprehensive SEO performance."""
    return await analyze_seo_comprehensive(request)

@app.post("/api/seo-dashboard/analyze-full")
async def analyze_seo_full_endpoint(
    request: SEOAnalysisRequest,
    current_user: dict = Depends(get_current_user),
):
    """Analyze a URL for comprehensive SEO performance."""
    return await analyze_seo_full(request)

@app.get("/api/seo-dashboard/metrics-detailed")
async def seo_metrics_detailed(
    url: str,
    current_user: dict = Depends(get_current_user),
):
    """Get detailed SEO metrics for a URL."""
    return await get_seo_metrics_detailed(url)

@app.get("/api/seo-dashboard/analysis-summary")
async def seo_analysis_summary(
    url: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a quick summary of SEO analysis for a URL."""
    return await get_analysis_summary(url)

@app.post("/api/seo-dashboard/batch-analyze")
async def batch_analyze_urls_endpoint(
    urls: list[str],
    current_user: dict = Depends(get_current_user),
):
    """Analyze multiple URLs in batch."""
    return await batch_analyze_urls(urls)

@app.post("/api/seo-dashboard/analyze-urls-ai")
async def analyze_urls_ai_endpoint(request: AnalyzeURLsRequest, current_user: dict = Depends(get_current_user)):
    """Run AI-powered SEO analysis on selected URLs."""
    return await analyze_urls_ai(request, current_user)

# Include platform analytics router
from routers.platform_analytics import router as platform_analytics_router
app.include_router(platform_analytics_router)
app.include_router(images_router)
app.include_router(image_studio_router)
app.include_router(product_marketing_router)
app.include_router(campaign_creator_router)

# Include content assets router
from api.content_assets.router import router as content_assets_router
app.include_router(content_assets_router)

# Include research configuration router
app.include_router(research_config_router, prefix="/api/research", tags=["research"])

# Include Research Engine router (standalone AI research module)
from api.research.router import router as research_engine_router
app.include_router(research_engine_router, tags=["Research Engine"])

# Scheduler dashboard routes
from api.scheduler_dashboard import router as scheduler_router
app.include_router(scheduler_router)
app.include_router(oauth_token_monitoring_router)

# Include scheduler monitoring API
# from api.scheduler_monitoring import router as scheduler_monitoring_router
# app.include_router(scheduler_monitoring_router)

# Autonomous Agents API routes (Phase 3A)
from api.agents_api import router as agents_router
app.include_router(agents_router)

# Today workflow routes
from api.today_workflow import router as today_workflow_router
app.include_router(today_workflow_router)

# Per-client OAuth routes (Phase 12)
# NOTE: /api/invites/{token}/validate and /api/auth/google/callback are PUBLIC endpoints
app.include_router(client_oauth_router, prefix="/api", tags=["client-oauth"])

# Internal API routes (Phase 13 - service-to-service token access)
# NOTE: /internal/* endpoints require X-Internal-Api-Key header
app.include_router(internal_router)

# SEO Analytics routes (Phase 14 - dashboard aggregation)
app.include_router(seo_analytics_router)

# Setup frontend serving using modular utilities
frontend_serving.setup_frontend_serving()

# Serve React frontend (for production)
@app.get("/")
async def serve_frontend():
    """Serve the React frontend."""
    return frontend_serving.serve_frontend()

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    try:
        # Validate production config before anything else
        validate_production_config()

        # Initialize database
        init_database()
        
        # Start task scheduler
        from services.scheduler import get_scheduler
        await get_scheduler().start()
        
        # Log environment configuration status (SECURE: never log actual values)
        log_env_status()

        # Check optional integrations
        if is_configured('WIX_API_KEY'):
            logger.info("WIX_API_KEY: configured - Wix publishing enabled")
        else:
            logger.warning("WIX_API_KEY: not configured - Wix publishing disabled")

        logger.info("ALwrity backend started successfully")
    except Exception as e:
        logger.error(f"Error during startup: {e}")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    try:
        # Stop task scheduler
        from services.scheduler import get_scheduler
        await get_scheduler().stop()
        
        # Close database connections
        close_database()
        logger.info("ALwrity backend shutdown successfully")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}") 
