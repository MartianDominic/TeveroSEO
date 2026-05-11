"""
Pydantic models for SEO data extraction.

These models define the comprehensive JSON structure returned to TypeScript.
Covers all 40+ fields needed for 109 SEO checks.
"""

from pydantic import BaseModel, Field, HttpUrl
from typing import Optional
from datetime import datetime


class LinkData(BaseModel):
    """Single link extracted from page."""
    href: str
    text: str
    rel: Optional[str] = None
    is_nofollow: bool = False
    is_sponsored: bool = False
    is_ugc: bool = False
    is_external: bool = False


class ImageData(BaseModel):
    """Single image extracted from page."""
    src: str
    alt: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    loading: Optional[str] = None
    is_lazy: bool = False
    has_alt: bool = False
    file_size_kb: Optional[float] = None


class HeadingData(BaseModel):
    """Heading element with text and level."""
    level: int
    text: str
    word_count: int


class SchemaOrgData(BaseModel):
    """Structured data / JSON-LD schema."""
    type: str
    raw: dict
    is_valid: bool = True
    errors: list[str] = Field(default_factory=list)


class MetaTagData(BaseModel):
    """Meta tag name/property and content."""
    name: Optional[str] = None
    property: Optional[str] = None
    content: str


class OpenGraphData(BaseModel):
    """Open Graph metadata."""
    title: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    url: Optional[str] = None
    type: Optional[str] = None
    site_name: Optional[str] = None


class TwitterCardData(BaseModel):
    """Twitter Card metadata."""
    card: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    site: Optional[str] = None
    creator: Optional[str] = None


class CanonicalData(BaseModel):
    """Canonical URL information."""
    url: Optional[str] = None
    is_self_referencing: bool = False
    has_trailing_slash_mismatch: bool = False


class HreflangData(BaseModel):
    """Hreflang tag."""
    lang: str
    url: str
    is_valid: bool = True


class ResourceHint(BaseModel):
    """Preload/preconnect/prefetch hints."""
    rel: str
    href: str
    as_type: Optional[str] = None


class SEOExtractionResult(BaseModel):
    """
    Comprehensive SEO data extracted from a single page.

    This is the primary response model - TypeScript receives this JSON
    and runs 109 checks against it without needing HTML parsing.
    """

    # Request metadata
    url: str
    final_url: str
    status_code: int
    tier_used: str
    extracted_at: datetime = Field(default_factory=datetime.utcnow)
    extraction_ms: int = 0

    # Title
    title: Optional[str] = None
    title_length: int = 0
    title_word_count: int = 0

    # Meta description
    meta_description: Optional[str] = None
    meta_description_length: int = 0
    meta_description_word_count: int = 0

    # Headings
    h1_text: Optional[str] = None
    h1_count: int = 0
    h2_count: int = 0
    h3_count: int = 0
    h4_count: int = 0
    h5_count: int = 0
    h6_count: int = 0
    headings: list[HeadingData] = Field(default_factory=list)

    # Content
    intro_text: Optional[str] = None
    body_text: str = ""
    word_count: int = 0
    sentence_count: int = 0
    paragraph_count: int = 0
    reading_time_minutes: float = 0.0

    # Links
    internal_links: list[LinkData] = Field(default_factory=list)
    external_links: list[LinkData] = Field(default_factory=list)
    internal_link_count: int = 0
    external_link_count: int = 0
    nofollow_link_count: int = 0
    broken_link_count: int = 0

    # Images
    images: list[ImageData] = Field(default_factory=list)
    image_count: int = 0
    images_without_alt: int = 0
    images_with_lazy_loading: int = 0

    # Structured data
    schemas: list[SchemaOrgData] = Field(default_factory=list)
    schema_types: list[str] = Field(default_factory=list)
    has_schema: bool = False

    # Meta tags
    meta_tags: list[MetaTagData] = Field(default_factory=list)
    meta_robots: Optional[str] = None
    is_noindex: bool = False
    is_nofollow: bool = False

    # Social
    og_data: Optional[OpenGraphData] = None
    twitter_data: Optional[TwitterCardData] = None
    has_og_tags: bool = False
    has_twitter_cards: bool = False

    # Canonical & hreflang
    canonical: Optional[CanonicalData] = None
    has_canonical: bool = False
    hreflang_tags: list[HreflangData] = Field(default_factory=list)
    has_hreflang: bool = False

    # Technical
    doctype: Optional[str] = None
    html_lang: Optional[str] = None
    charset: Optional[str] = None
    viewport: Optional[str] = None
    has_viewport: bool = False

    # Performance hints
    resource_hints: list[ResourceHint] = Field(default_factory=list)
    preload_count: int = 0
    preconnect_count: int = 0

    # Content quality signals
    has_table_of_contents: bool = False
    has_faq_section: bool = False
    has_author: bool = False
    has_publish_date: bool = False
    has_update_date: bool = False

    # Keyword relevance (if keyword provided)
    keyword: Optional[str] = None
    keyword_in_title: bool = False
    keyword_in_h1: bool = False
    keyword_in_meta_description: bool = False
    keyword_in_first_100_words: bool = False
    keyword_density: float = 0.0
    keyword_occurrences: int = 0
    keyword_in_strong: bool = False
    keyword_in_emphasis: bool = False
    keyword_in_noscript: bool = False

    # Structural element signals
    has_cta: bool = False
    cta_count: int = 0
    paragraphs: list[str] = Field(default_factory=list)
    strong_count: int = 0
    has_noscript: bool = False
    list_count: int = 0
    table_count: int = 0
    blockquote_count: int = 0
    has_comparison_table: bool = False


class ExtractRequest(BaseModel):
    """Request to extract SEO data from a URL."""
    url: str
    tier: str = "residential"
    keyword: Optional[str] = None
    timeout_ms: int = 30000


class BatchExtractRequest(BaseModel):
    """Request to extract SEO data from multiple URLs."""
    urls: list[str]
    tier: str = "residential"
    keyword: Optional[str] = None
    timeout_ms: int = 30000
    concurrency: int = 50


class StreamBatchRequest(BaseModel):
    """Request for streaming batch extraction with progress."""
    urls: list[str]
    tier: str = "residential"
    keyword: Optional[str] = None
    timeout_ms: int = 30000
    concurrency: int = 100
    chunk_size: int = 100


class BatchProgress(BaseModel):
    """Progress update for streaming batch extraction."""
    type: str = "progress"
    completed: int
    total: int
    percent: float
    current_url: Optional[str] = None
    success_count: int = 0
    error_count: int = 0


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    version: str = "1.0.0"
    proxy_configured: bool = False
