"""
SEO data extraction from parsed HTML.

Uses Scrapling's Adaptor for CSS selectors and DOM traversal.
Returns structured SEOExtractionResult JSON.
"""

import json
import re
from typing import Optional
from urllib.parse import urljoin, urlparse

from schema import (
    SEOExtractionResult,
    LinkData,
    ImageData,
    HeadingData,
    SchemaOrgData,
    MetaTagData,
    OpenGraphData,
    TwitterCardData,
    CanonicalData,
    HreflangData,
    ResourceHint,
)


def extract_seo_data(
    page,
    url: str,
    final_url: str,
    status_code: int,
    tier_used: str,
    keyword: Optional[str] = None,
    extraction_ms: int = 0,
) -> SEOExtractionResult:
    """
    Extract comprehensive SEO data from a Scrapling page object.

    Args:
        page: Scrapling Adaptor object with parsed HTML
        url: Original requested URL
        final_url: Final URL after redirects
        status_code: HTTP status code
        tier_used: Which tier fetched this ("residential", "camoufox", "dataforseo")
        keyword: Optional keyword for relevance analysis
        extraction_ms: Time spent fetching in milliseconds

    Returns:
        SEOExtractionResult with all fields populated
    """
    base_url = final_url

    # Title
    title = _safe_text(page.css_first("title"))
    title_length = len(title) if title else 0
    title_word_count = len(title.split()) if title else 0

    # Meta description
    meta_desc = _safe_attr(page.css_first('meta[name="description"]'), "content")
    meta_desc_length = len(meta_desc) if meta_desc else 0
    meta_desc_word_count = len(meta_desc.split()) if meta_desc else 0

    # Headings
    headings = _extract_headings(page)
    h1_elements = [h for h in headings if h.level == 1]
    h1_text = h1_elements[0].text if h1_elements else None

    # Content
    body_text = _extract_body_text(page)
    word_count = len(body_text.split())
    sentence_count = len(re.split(r"[.!?]+", body_text))
    paragraph_count = len(page.css("p"))
    reading_time = word_count / 200.0

    # Intro text (between H1 and first H2)
    intro_text = _extract_intro_text(page)

    # Links
    internal_links, external_links = _extract_links(page, base_url)

    # Images
    images = _extract_images(page, base_url)

    # Structured data
    schemas = _extract_schemas(page)

    # Meta tags
    meta_tags = _extract_meta_tags(page)
    meta_robots = _safe_attr(page.css_first('meta[name="robots"]'), "content")
    is_noindex = "noindex" in (meta_robots or "").lower()
    is_nofollow = "nofollow" in (meta_robots or "").lower()

    # Social
    og_data = _extract_og_data(page)
    twitter_data = _extract_twitter_data(page)

    # Canonical
    canonical = _extract_canonical(page, final_url)

    # Hreflang
    hreflang_tags = _extract_hreflang(page)

    # Technical
    doctype = _extract_doctype(page)
    html_lang = _safe_attr(page.css_first("html"), "lang")
    charset = _extract_charset(page)
    viewport = _safe_attr(page.css_first('meta[name="viewport"]'), "content")

    # Resource hints
    resource_hints = _extract_resource_hints(page)

    # Content quality signals
    has_toc = _has_table_of_contents(page)
    has_faq = _has_faq_section(page)
    has_author = bool(
        page.css_first('[rel="author"]')
        or page.css_first('[itemprop="author"]')
        or page.css_first(".author")
    )
    has_publish_date = bool(
        page.css_first('[itemprop="datePublished"]')
        or page.css_first("time[datetime]")
    )
    has_update_date = bool(page.css_first('[itemprop="dateModified"]'))

    # Keyword analysis
    keyword_analysis = _analyze_keyword(
        keyword, title, h1_text, meta_desc, body_text, page
    ) if keyword else {}

    # Structural elements
    structural = _count_structural_elements(page)
    paragraphs = _extract_paragraphs(page)
    has_cta, cta_count = _detect_cta(page)
    has_comparison_table = _has_comparison_table(page)

    return SEOExtractionResult(
        url=url,
        final_url=final_url,
        status_code=status_code,
        tier_used=tier_used,
        extraction_ms=extraction_ms,
        # Title
        title=title,
        title_length=title_length,
        title_word_count=title_word_count,
        # Meta description
        meta_description=meta_desc,
        meta_description_length=meta_desc_length,
        meta_description_word_count=meta_desc_word_count,
        # Headings
        h1_text=h1_text,
        h1_count=len([h for h in headings if h.level == 1]),
        h2_count=len([h for h in headings if h.level == 2]),
        h3_count=len([h for h in headings if h.level == 3]),
        h4_count=len([h for h in headings if h.level == 4]),
        h5_count=len([h for h in headings if h.level == 5]),
        h6_count=len([h for h in headings if h.level == 6]),
        headings=headings,
        # Content
        intro_text=intro_text,
        body_text=body_text[:10000],  # Truncate for transport
        word_count=word_count,
        sentence_count=sentence_count,
        paragraph_count=paragraph_count,
        reading_time_minutes=round(reading_time, 1),
        # Links
        internal_links=internal_links[:100],  # Limit for transport
        external_links=external_links[:100],
        internal_link_count=len(internal_links),
        external_link_count=len(external_links),
        nofollow_link_count=sum(
            1 for link in internal_links + external_links if link.is_nofollow
        ),
        broken_link_count=0,  # Would need async checking
        # Images
        images=images[:50],  # Limit for transport
        image_count=len(images),
        images_without_alt=sum(1 for img in images if not img.has_alt),
        images_with_lazy_loading=sum(1 for img in images if img.is_lazy),
        # Structured data
        schemas=schemas,
        schema_types=[s.type for s in schemas],
        has_schema=len(schemas) > 0,
        # Meta tags
        meta_tags=meta_tags,
        meta_robots=meta_robots,
        is_noindex=is_noindex,
        is_nofollow=is_nofollow,
        # Social
        og_data=og_data,
        twitter_data=twitter_data,
        has_og_tags=og_data is not None and og_data.title is not None,
        has_twitter_cards=twitter_data is not None and twitter_data.card is not None,
        # Canonical
        canonical=canonical,
        has_canonical=canonical is not None and canonical.url is not None,
        hreflang_tags=hreflang_tags,
        has_hreflang=len(hreflang_tags) > 0,
        # Technical
        doctype=doctype,
        html_lang=html_lang,
        charset=charset,
        viewport=viewport,
        has_viewport=viewport is not None,
        # Resource hints
        resource_hints=resource_hints,
        preload_count=sum(1 for r in resource_hints if r.rel == "preload"),
        preconnect_count=sum(1 for r in resource_hints if r.rel == "preconnect"),
        # Content quality
        has_table_of_contents=has_toc,
        has_faq_section=has_faq,
        has_author=has_author,
        has_publish_date=has_publish_date,
        has_update_date=has_update_date,
        # Keyword analysis
        keyword=keyword,
        **keyword_analysis,
        # Structural elements
        has_cta=has_cta,
        cta_count=cta_count,
        paragraphs=paragraphs,
        strong_count=structural["strong_count"],
        has_noscript=structural["has_noscript"],
        list_count=structural["list_count"],
        table_count=structural["table_count"],
        blockquote_count=structural["blockquote_count"],
        has_comparison_table=has_comparison_table,
    )


def _safe_text(element) -> Optional[str]:
    """Safely extract text from element."""
    if element is None:
        return None
    try:
        text = element.text
        return text.strip() if text else None
    except Exception:
        return None


def _safe_attr(element, attr: str) -> Optional[str]:
    """Safely extract attribute from element."""
    if element is None:
        return None
    try:
        value = element.attrib.get(attr)
        return value.strip() if value else None
    except Exception:
        return None


def _extract_headings(page) -> list[HeadingData]:
    """Extract all headings h1-h6."""
    headings = []
    for level in range(1, 7):
        for el in page.css(f"h{level}"):
            text = _safe_text(el)
            if text:
                headings.append(HeadingData(
                    level=level,
                    text=text,
                    word_count=len(text.split()),
                ))
    return headings


def _extract_body_text(page) -> str:
    """Extract visible body text, excluding nav/header/footer/scripts."""
    try:
        # Remove unwanted elements
        body = page.css_first("body")
        if not body:
            return ""

        # Get text, excluding common non-content elements
        text_parts = []
        for el in page.css("p, li, td, th, blockquote, figcaption"):
            text = _safe_text(el)
            if text:
                text_parts.append(text)

        return " ".join(text_parts)
    except Exception:
        return ""


def _extract_intro_text(page) -> Optional[str]:
    """Extract text between H1 and first H2."""
    try:
        h1 = page.css_first("h1")
        if not h1:
            return None

        parts = []
        current = h1
        while True:
            try:
                next_el = current.next
                if next_el is None:
                    break
                if hasattr(next_el, "tag") and next_el.tag in ("h2", "h3", "h4", "h5", "h6"):
                    break
                text = _safe_text(next_el)
                if text:
                    parts.append(text)
                current = next_el
            except Exception:
                break

        intro = " ".join(parts)
        return intro[:1000] if intro else None
    except Exception:
        return None


def _extract_links(page, base_url: str) -> tuple[list[LinkData], list[LinkData]]:
    """Extract and categorize all links."""
    internal = []
    external = []
    base_domain = urlparse(base_url).netloc

    for el in page.css("a[href]"):
        href = _safe_attr(el, "href")
        if not href:
            continue

        # Resolve relative URLs
        absolute_url = urljoin(base_url, href)
        parsed = urlparse(absolute_url)

        # Skip non-http links
        if parsed.scheme not in ("http", "https", ""):
            continue

        rel = _safe_attr(el, "rel") or ""
        text = _safe_text(el) or ""

        link = LinkData(
            href=absolute_url,
            text=text[:200],
            rel=rel,
            is_nofollow="nofollow" in rel,
            is_sponsored="sponsored" in rel,
            is_ugc="ugc" in rel,
            is_external=parsed.netloc != base_domain and parsed.netloc != "",
        )

        if link.is_external:
            external.append(link)
        else:
            internal.append(link)

    return internal, external


def _extract_images(page, base_url: str) -> list[ImageData]:
    """Extract all images with metadata."""
    images = []

    for el in page.css("img"):
        src = _safe_attr(el, "src") or _safe_attr(el, "data-src")
        if not src:
            continue

        absolute_src = urljoin(base_url, src)
        alt = _safe_attr(el, "alt")
        loading = _safe_attr(el, "loading")

        try:
            width = int(_safe_attr(el, "width") or 0)
        except (ValueError, TypeError):
            width = None

        try:
            height = int(_safe_attr(el, "height") or 0)
        except (ValueError, TypeError):
            height = None

        images.append(ImageData(
            src=absolute_src,
            alt=alt,
            width=width if width else None,
            height=height if height else None,
            loading=loading,
            is_lazy=loading == "lazy" or _safe_attr(el, "data-src") is not None,
            has_alt=bool(alt and alt.strip()),
        ))

    return images


def _extract_schemas(page) -> list[SchemaOrgData]:
    """Extract JSON-LD structured data."""
    schemas = []

    for el in page.css('script[type="application/ld+json"]'):
        try:
            text = _safe_text(el)
            if not text:
                continue

            data = json.loads(text)

            # Handle @graph arrays
            if isinstance(data, dict) and "@graph" in data:
                for item in data["@graph"]:
                    if isinstance(item, dict) and "@type" in item:
                        schemas.append(SchemaOrgData(
                            type=str(item["@type"]),
                            raw=item,
                            is_valid=True,
                        ))
            elif isinstance(data, dict) and "@type" in data:
                schemas.append(SchemaOrgData(
                    type=str(data["@type"]),
                    raw=data,
                    is_valid=True,
                ))
            elif isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and "@type" in item:
                        schemas.append(SchemaOrgData(
                            type=str(item["@type"]),
                            raw=item,
                            is_valid=True,
                        ))
        except json.JSONDecodeError as e:
            schemas.append(SchemaOrgData(
                type="Invalid",
                raw={},
                is_valid=False,
                errors=[str(e)],
            ))

    return schemas


def _extract_meta_tags(page) -> list[MetaTagData]:
    """Extract relevant meta tags."""
    tags = []

    for el in page.css("meta[name], meta[property]"):
        name = _safe_attr(el, "name")
        prop = _safe_attr(el, "property")
        content = _safe_attr(el, "content")

        if content and (name or prop):
            tags.append(MetaTagData(
                name=name,
                property=prop,
                content=content[:500],
            ))

    return tags


def _extract_og_data(page) -> Optional[OpenGraphData]:
    """Extract Open Graph metadata."""
    def get_og(prop: str) -> Optional[str]:
        el = page.css_first(f'meta[property="og:{prop}"]')
        return _safe_attr(el, "content") if el else None

    og = OpenGraphData(
        title=get_og("title"),
        description=get_og("description"),
        image=get_og("image"),
        url=get_og("url"),
        type=get_og("type"),
        site_name=get_og("site_name"),
    )

    return og if any([og.title, og.description, og.image]) else None


def _extract_twitter_data(page) -> Optional[TwitterCardData]:
    """Extract Twitter Card metadata."""
    def get_tw(name: str) -> Optional[str]:
        el = page.css_first(f'meta[name="twitter:{name}"]')
        return _safe_attr(el, "content") if el else None

    tw = TwitterCardData(
        card=get_tw("card"),
        title=get_tw("title"),
        description=get_tw("description"),
        image=get_tw("image"),
        site=get_tw("site"),
        creator=get_tw("creator"),
    )

    return tw if any([tw.card, tw.title, tw.image]) else None


def _extract_canonical(page, current_url: str) -> Optional[CanonicalData]:
    """Extract canonical URL information."""
    el = page.css_first('link[rel="canonical"]')
    if not el:
        return None

    href = _safe_attr(el, "href")
    if not href:
        return None

    parsed_current = urlparse(current_url)
    parsed_canonical = urlparse(href)

    return CanonicalData(
        url=href,
        is_self_referencing=(
            parsed_canonical.netloc == parsed_current.netloc and
            parsed_canonical.path.rstrip("/") == parsed_current.path.rstrip("/")
        ),
        has_trailing_slash_mismatch=(
            parsed_canonical.path.endswith("/") != parsed_current.path.endswith("/")
        ),
    )


def _extract_hreflang(page) -> list[HreflangData]:
    """Extract hreflang tags."""
    tags = []

    for el in page.css('link[rel="alternate"][hreflang]'):
        lang = _safe_attr(el, "hreflang")
        href = _safe_attr(el, "href")

        if lang and href:
            tags.append(HreflangData(
                lang=lang,
                url=href,
                is_valid=True,
            ))

    return tags


def _extract_doctype(page) -> Optional[str]:
    """Extract doctype declaration."""
    try:
        html = str(page.html)[:200].lower()
        if "<!doctype html>" in html or "<!doctype html" in html:
            return "html5"
        elif "xhtml" in html:
            return "xhtml"
        elif "html 4" in html:
            return "html4"
        return None
    except Exception:
        return None


def _extract_charset(page) -> Optional[str]:
    """Extract character encoding."""
    el = page.css_first('meta[charset]')
    if el:
        return _safe_attr(el, "charset")

    el = page.css_first('meta[http-equiv="Content-Type"]')
    if el:
        content = _safe_attr(el, "content")
        if content and "charset=" in content:
            return content.split("charset=")[1].split(";")[0].strip()

    return None


def _extract_resource_hints(page) -> list[ResourceHint]:
    """Extract preload, preconnect, prefetch hints."""
    hints = []

    for rel in ("preload", "preconnect", "prefetch", "dns-prefetch"):
        for el in page.css(f'link[rel="{rel}"]'):
            href = _safe_attr(el, "href")
            if href:
                hints.append(ResourceHint(
                    rel=rel,
                    href=href,
                    as_type=_safe_attr(el, "as"),
                ))

    return hints


def _has_table_of_contents(page) -> bool:
    """Check if page has a table of contents."""
    toc_patterns = [
        '[id*="toc"]',
        '[class*="toc"]',
        '[id*="table-of-contents"]',
        '[class*="table-of-contents"]',
        '[id*="contents"]',
        'nav[aria-label*="Table"]',
    ]

    for pattern in toc_patterns:
        if page.css_first(pattern):
            return True

    return False


def _has_faq_section(page) -> bool:
    """Check if page has an FAQ section."""
    faq_patterns = [
        '[id*="faq"]',
        '[class*="faq"]',
        '[itemtype*="FAQPage"]',
        'h2:contains("FAQ")',
        'h2:contains("Frequently Asked")',
    ]

    for pattern in faq_patterns:
        try:
            if page.css_first(pattern):
                return True
        except Exception:
            continue

    # Check for FAQ schema
    for schema in _extract_schemas(page):
        if "FAQ" in schema.type:
            return True

    return False


def _count_structural_elements(page) -> dict:
    """Count structural HTML elements."""
    return {
        "strong_count": len(page.css("strong, b")),
        "list_count": len(page.css("ul, ol")),
        "table_count": len(page.css("table")),
        "blockquote_count": len(page.css("blockquote")),
        "has_noscript": bool(page.css_first("noscript")),
    }


def _extract_paragraphs(page) -> list[str]:
    """Extract paragraph texts (limit 50, 500 chars each)."""
    paragraphs = []
    for p in page.css("p")[:50]:
        text = _safe_text(p)
        if text and len(text) > 20:
            paragraphs.append(text[:500])
    return paragraphs


def _detect_cta(page) -> tuple[bool, int]:
    """Detect call-to-action elements."""
    cta_patterns = [
        'button[type="submit"]',
        'a[class*="cta"]',
        'a[class*="button"]',
        'a[class*="btn"]',
        'button[class*="cta"]',
        'button[class*="primary"]',
        '[role="button"]',
    ]
    cta_count = 0
    for pattern in cta_patterns:
        try:
            cta_count += len(page.css(pattern))
        except Exception:
            continue
    return (cta_count > 0, cta_count)


def _has_comparison_table(page) -> bool:
    """Detect comparison-style tables."""
    for table in page.css("table"):
        # Check table content for comparison indicators
        try:
            table_html = str(table.html).lower() if hasattr(table, "html") else ""
            if any(x in table_html for x in ["vs", "compare", "comparison", "pros", "cons"]):
                return True
            # Check for multiple columns with headers (typical comparison structure)
            headers = table.css("th")
            if len(headers) >= 3:
                return True
        except Exception:
            continue
    return False


def _analyze_keyword(
    keyword: str,
    title: Optional[str],
    h1: Optional[str],
    meta_desc: Optional[str],
    body_text: str,
    page=None,
) -> dict:
    """Analyze keyword presence and density."""
    keyword_lower = keyword.lower()

    # Count occurrences in body
    body_lower = body_text.lower()
    occurrences = body_lower.count(keyword_lower)

    # Calculate density
    word_count = len(body_text.split())
    density = (occurrences / word_count * 100) if word_count > 0 else 0.0

    # Check positions
    first_100_words = " ".join(body_text.split()[:100]).lower()

    # Check strong/em/noscript if page provided
    keyword_in_strong = False
    keyword_in_emphasis = False
    keyword_in_noscript = False

    if page is not None:
        for el in page.css("strong, b"):
            if keyword_lower in (_safe_text(el) or "").lower():
                keyword_in_strong = True
                break

        for el in page.css("em, i"):
            if keyword_lower in (_safe_text(el) or "").lower():
                keyword_in_emphasis = True
                break

        for el in page.css("noscript"):
            if keyword_lower in (_safe_text(el) or "").lower():
                keyword_in_noscript = True
                break

    return {
        "keyword_in_title": keyword_lower in (title or "").lower(),
        "keyword_in_h1": keyword_lower in (h1 or "").lower(),
        "keyword_in_meta_description": keyword_lower in (meta_desc or "").lower(),
        "keyword_in_first_100_words": keyword_lower in first_100_words,
        "keyword_density": round(density, 2),
        "keyword_occurrences": occurrences,
        "keyword_in_strong": keyword_in_strong,
        "keyword_in_emphasis": keyword_in_emphasis,
        "keyword_in_noscript": keyword_in_noscript,
    }
