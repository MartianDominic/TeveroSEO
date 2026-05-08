"""
Auto-publish executor — PUB-06, PUB-07, SCHED-03..05.

run_publish_cycle() is called every 15 minutes by APScheduler.
It finds all ScheduledArticle rows with status='approved' and
publish_date <= now(UTC), then publishes each via get_publisher().

Retry schedule (exponential backoff):
  attempt 1 failure → retry in 5 min  (retry_count becomes 1)
  attempt 2 failure → retry in 30 min (retry_count becomes 2)
  attempt 3 failure → mark failed     (retry_count becomes 3, status='failed')

CRITICAL: SQLAlchemy session MUST be closed before calling publisher.publish()
to avoid holding a connection during potentially long HTTP calls to CMS APIs.

Thread Safety:
- Uses threading.Lock for scheduler state transitions (HIGH-01 fix)
- Simplifies async context handling to use asyncio.run() at top level only (MEDIUM-02 fix)

DFI-001 FIX: Uses optimistic locking with version field to prevent race conditions
during concurrent article status updates. Updates fail if version doesn't match.
"""

import asyncio
import json
import os
import threading
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from loguru import logger
from sqlalchemy.orm import Session

from models.client import Client, ClientSettings
from models.publishing import ScheduledArticle, PublishingLog
from services.shared_db import SessionLocal
from services.cms_publisher.publisher_factory import get_publisher
from services.cms_publisher.abstract_publisher import PublishResult
from services.gsc_service import GSCService
from services.http_client import get_client
from services.internal_api_auth import get_internal_auth_headers
from services.publishing_exceptions import (
    ClientSettingsError,
    GSCSubmissionError,
    LinkGraphUpdateError,
)
from services.analytics.open_seo_client import (
    get_open_seo_client,
    OpenSeoClientError,
)
from services.analytics.open_seo_types import RiskLevel
from urllib.parse import urlparse


async def _update_link_graph(client_id: str, url: str, html: str) -> None:
    """
    Update link graph in open-seo-main after publishing.
    Phase 40-04: Link Graph Update on Publish

    Args:
        client_id: Client identifier
        url: Published article URL
        html: Article HTML content

    Raises:
        LinkGraphUpdateError: If update fails (logged but non-blocking)
        ValueError: If OPEN_SEO_API_URL is invalid
    """
    open_seo_url = os.getenv("OPEN_SEO_API_URL", "http://localhost:3001")
    # Validate URL format for internal service communication
    # Note: SSRF protection not applied here as this is an operator-controlled env var
    parsed = urlparse(open_seo_url)
    if not parsed.scheme or parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError(f"Invalid OPEN_SEO_API_URL: {open_seo_url}")

    try:
        client = await get_client()
        # AIW-01 FIX: Use HMAC auth with payload for cross-service calls
        payload = json.dumps({
            "clientId": client_id,
            "url": url,
            "html": html,
        })
        headers = get_internal_auth_headers(payload=payload)
        response = await client.post(
            f"{open_seo_url}/api/seo/links/graph/update",
            content=payload,
            headers=headers,
            timeout=30.0,
        )
        response.raise_for_status()

        data = response.json()
        logger.info(
            "Link graph updated successfully",
            extra={
                "client_id": client_id,
                "url": url,
                "internal_links": data.get("internalLinks", 0),
                "external_links": data.get("externalLinks", 0),
            },
        )
    except Exception as e:
        error = LinkGraphUpdateError(
            f"Failed to update link graph for {url}",
            context={
                "client_id": client_id,
                "url": url,
                "error_type": type(e).__name__,
            },
        )
        logger.warning(
            "Link graph update failed (non-blocking)",
            extra={
                "client_id": client_id,
                "url": url,
                "error": str(e),
                "error_type": type(e).__name__,
            },
            exc_info=True,
        )
        raise error from e

# Retry delays in minutes for attempt 1, 2, 3
RETRY_DELAYS_MINUTES = [5, 30, 120]
MAX_RETRIES = 3

# Phase 69-03: Batch size limit for background jobs
# Prevents unbounded queries that could cause memory issues
BATCH_SIZE = 50

# HIGH-01 Fix: Thread-safe lock for scheduler state transitions
# Prevents race conditions when APScheduler calls run_publish_cycle()
# while a previous cycle is still running
_scheduler_lock = threading.Lock()
_cycle_in_progress = False


def run_publish_cycle() -> None:
    """
    Called by APScheduler every 15 minutes.

    For each approved article due now:
    1. Open fresh session, claim article (UPDATE WHERE status='approved' AND publish_date<=now),
       set status='publishing', publishing_started_at=now. Close session.
    2. Open fresh session, load full client_settings, extract credentials. Close session.
    3. Call publisher.publish() with no session open.
    4. Open fresh session, save result + PublishingLog. Close session.

    HIGH-01 Fix: Uses thread lock to prevent race conditions when APScheduler
    triggers overlapping cycles.
    """
    global _cycle_in_progress

    # HIGH-01 Fix: Acquire lock to prevent race conditions in scheduler state
    with _scheduler_lock:
        if _cycle_in_progress:
            logger.warning(
                "Publishing cycle skipped - previous cycle still in progress",
                extra={"skipped_at": datetime.now(timezone.utc).isoformat()},
            )
            return
        _cycle_in_progress = True

    try:
        _run_publish_cycle_impl()
    finally:
        # HIGH-01 Fix: Always release the lock, even on exceptions
        with _scheduler_lock:
            _cycle_in_progress = False


def _run_publish_cycle_impl() -> None:
    """
    Internal implementation of publish cycle, called with lock held.
    Separated to ensure lock is always released via finally block.
    """
    now_utc = datetime.now(timezone.utc)

    # Step 1: Find approved+due article IDs (read-only query, no locking)
    # Phase 69-03: Limited to BATCH_SIZE to prevent unbounded queries
    db: Session = SessionLocal()
    try:
        due_articles = (
            db.query(ScheduledArticle)
            .filter(
                ScheduledArticle.status == "approved",
                ScheduledArticle.publish_date != None,   # noqa: E711
                ScheduledArticle.publish_date <= now_utc,
            )
            .order_by(ScheduledArticle.publish_date.asc())  # Oldest first
            .limit(BATCH_SIZE)
            .all()
        )
        article_ids = [str(a.id) for a in due_articles]
    finally:
        db.close()

    if not article_ids:
        return

    logger.info(
        "Publishing cycle started",
        extra={
            "article_count": len(article_ids),
            "article_ids": article_ids,
        },
    )

    for article_id in article_ids:
        try:
            _publish_single_article(article_id)
        except Exception as exc:
            logger.error(
                "Unhandled error during article publish",
                extra={
                    "article_id": article_id,
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                },
                exc_info=True,
            )


def _claim_article_optimistic(
    article_id: str, expected_version: int, now_utc: datetime, db: Session
) -> bool:
    """
    Claim article using optimistic locking with version check.

    Plan 69-04 Task 1: Uses UPDATE with version in WHERE clause.
    Returns True if claim succeeded, False if version mismatch (concurrent claim).

    Optimistic locking pattern:
    1. UPDATE with WHERE id = X AND status = 'approved' AND version = expected
    2. SET status = 'publishing', version = version + 1
    3. Check rowcount - 0 means version mismatch (concurrent modification)

    This is more efficient than pessimistic locking (FOR UPDATE) for low-contention
    scenarios and doesn't require lock waiting.
    """
    from sqlalchemy import update

    stmt = (
        update(ScheduledArticle)
        .where(
            ScheduledArticle.id == article_id,
            ScheduledArticle.status == "approved",
            ScheduledArticle.version == expected_version,
        )
        .values(
            status="publishing",
            publishing_started_at=now_utc,
            updated_at=now_utc,
            version=expected_version + 1,
        )
    )

    result = db.execute(stmt)
    db.commit()

    # rowcount is 0 if version mismatch (concurrent claim) or status changed
    return result.rowcount > 0


def _publish_single_article(article_id: str) -> None:
    """
    Atomically claim and publish a single article.
    Three separate DB sessions: claim → load credentials → save result.

    Plan 69-04: Uses optimistic locking for article claims.
    The claim operation uses UPDATE with version check in WHERE clause.
    Returns early if version mismatch indicates concurrent claim.
    """
    now_utc = datetime.now(timezone.utc)

    # --- Session 1: Read article and claim with optimistic locking ---
    db: Session = SessionLocal()
    client_id: Optional[str] = None
    article_title: str = ""
    content_html: str = ""
    meta_description: str = ""
    article_keyword: Optional[str] = None
    attempt_number: int = 1

    try:
        # First, read current article state (no locks needed for read)
        article: Optional[ScheduledArticle] = (
            db.query(ScheduledArticle)
            .filter(
                ScheduledArticle.id == article_id,
                ScheduledArticle.status == "approved",
            )
            .first()
        )

        if article is None:
            # Already claimed or status changed
            return

        # Store values before claim attempt
        expected_version = article.version or 1
        client_id = str(article.client_id)
        article_title = article.title
        content_html = article.content_html or ""
        meta_description = article.meta_description or ""
        article_keyword = article.keyword
        attempt_number = (article.retry_count or 0) + 1

        # Plan 69-04 Task 1: Optimistic locking claim with version check
        # Returns False if version mismatch (concurrent claim by another worker)
        claim_succeeded = _claim_article_optimistic(
            article_id=article_id,
            expected_version=expected_version,
            now_utc=now_utc,
            db=db,
        )

        if not claim_succeeded:
            logger.info(
                "Article claim failed - version mismatch (concurrent claim)",
                extra={
                    "article_id": article_id,
                    "expected_version": expected_version,
                },
            )
            client_id = None  # Signal to exit early
            return

    finally:
        db.close()

    if client_id is None:
        return

    # --- Session 2: Load client + settings for CMS credentials ---
    client_settings: Optional[ClientSettings] = None
    db = SessionLocal()
    try:
        client: Optional[Client] = (
            db.query(Client).filter(Client.id == client_id).first()
        )
        if client is None:
            raise ClientSettingsError(
                f"Client {client_id} not found",
                context={"client_id": client_id, "article_id": article_id},
            )

        client_settings = client.settings
        if client_settings is None:
            raise ClientSettingsError(
                f"ClientSettings not found for client {client_id}",
                context={"client_id": client_id, "article_id": article_id},
            )

        # Detach from session so we can use after session close
        db.expunge(client_settings)
    except ClientSettingsError as exc:
        logger.error(
            "Failed to load client settings",
            extra={
                "article_id": article_id,
                "client_id": client_id,
                "error": str(exc),
                "context": exc.context,
            },
            exc_info=True,
        )
        _save_result(
            article_id=article_id,
            client_id=client_id,
            attempt_number=attempt_number,
            cms_type=None,
            result=PublishResult(success=False, error=str(exc)),
            now_utc=now_utc,
        )
        return
    except Exception as exc:
        logger.error(
            "Unexpected error loading client settings",
            extra={
                "article_id": article_id,
                "client_id": client_id,
                "error": str(exc),
                "error_type": type(exc).__name__,
            },
            exc_info=True,
        )
        _save_result(
            article_id=article_id,
            client_id=client_id,
            attempt_number=attempt_number,
            cms_type=None,
            result=PublishResult(success=False, error=str(exc)),
            now_utc=now_utc,
        )
        return
    finally:
        db.close()

    # --- HIGH-10-01 FIX: Re-verify quality score before final publish ---
    # Defense-in-depth: score could have changed since initial approval
    try:
        from services.article_generation_service import check_quality_gate, QualityGateError, QUALITY_GATE_THRESHOLD
        quality_result = asyncio.run(check_quality_gate(client_id, content_html, article_title))
        raw_score = quality_result.get("score")
        # HIGH-14-01 FIX: Explicit type validation for quality score
        if raw_score is None or not isinstance(raw_score, (int, float)):
            logger.warning(
                f"Quality score re-verification invalid type: {type(raw_score).__name__}",
                extra={"article_id": article_id, "raw_score": raw_score}
            )
            quality_score = 0
        else:
            quality_score = int(raw_score)

        if quality_score < QUALITY_GATE_THRESHOLD:
            logger.warning(
                "Quality score dropped below threshold before publish - blocking",
                extra={
                    "article_id": article_id,
                    "quality_score": quality_score,
                    "threshold": QUALITY_GATE_THRESHOLD,
                }
            )
            result = PublishResult(
                success=False,
                error=f"Quality score {quality_score} dropped below threshold {QUALITY_GATE_THRESHOLD}"
            )
            cms_type = getattr(client_settings, "cms_type", None) or "unknown"
            _save_result(
                article_id=article_id,
                client_id=client_id,
                attempt_number=attempt_number,
                cms_type=cms_type,
                result=result,
                now_utc=now_utc,
            )
            return
    except QualityGateError as qge:
        # Fail-closed: if we can't verify quality, don't publish
        logger.warning(
            "Quality re-verification failed - blocking publish",
            extra={"article_id": article_id, "error": str(qge)}
        )
        result = PublishResult(success=False, error=f"Quality re-verification failed: {qge}")
        cms_type = getattr(client_settings, "cms_type", None) or "unknown"
        _save_result(
            article_id=article_id,
            client_id=client_id,
            attempt_number=attempt_number,
            cms_type=cms_type,
            result=result,
            now_utc=now_utc,
        )
        return
    except Exception as exc:
        logger.error(
            "Unexpected error during quality re-verification",
            extra={"article_id": article_id, "error": str(exc)},
            exc_info=True
        )
        # Fail-closed on unexpected errors
        result = PublishResult(success=False, error=f"Quality re-verification error: {exc}")
        cms_type = getattr(client_settings, "cms_type", None) or "unknown"
        _save_result(
            article_id=article_id,
            client_id=client_id,
            attempt_number=attempt_number,
            cms_type=cms_type,
            result=result,
            now_utc=now_utc,
        )
        return

    # --- AIW-02 FIX: Pre-publish cannibalization check ---
    # Check for keyword cannibalization risks before publishing.
    # Uses fail-open approach: warnings logged but don't block publish.
    # CRITICAL risk level blocks publish to prevent SEO damage.
    cannibalization_blocked = asyncio.run(
        _check_cannibalization_risk(
            article_id=article_id,
            client_id=client_id,
            article_keyword=article_keyword,
            article_title=article_title,
        )
    )
    if cannibalization_blocked:
        result = PublishResult(
            success=False,
            error="Blocked by cannibalization check: CRITICAL risk detected"
        )
        cms_type = getattr(client_settings, "cms_type", None) or "unknown"
        _save_result(
            article_id=article_id,
            client_id=client_id,
            attempt_number=attempt_number,
            cms_type=cms_type,
            result=result,
            now_utc=now_utc,
        )
        return

    # --- No session open during publish() call ---
    try:
        publisher = get_publisher(client_settings)
        result: PublishResult = publisher.publish(
            title=article_title,
            content_html=content_html,
            meta_description=meta_description,
        )
    except Exception as exc:
        # publisher factory or publish() itself raised (should not happen per ABC contract,
        # but guard anyway)
        result = PublishResult(success=False, error=str(exc))

    cms_type = getattr(client_settings, "cms_type", None) or "unknown"

    # --- Session 3: Save result + PublishingLog ---
    _save_result(
        article_id=article_id,
        client_id=client_id,
        attempt_number=attempt_number,
        cms_type=cms_type,
        result=result,
        now_utc=now_utc,
    )


async def _check_cannibalization_risk(
    article_id: str,
    client_id: str,
    article_keyword: Optional[str],
    article_title: str,
) -> bool:
    """
    AIW-02: Pre-publish cannibalization check.

    Calls open-seo-main's content-insights API with type=check to verify
    the article's target keywords don't conflict with existing content.

    Risk levels and actions:
    - NONE/LOW: Proceed without warning
    - MEDIUM/HIGH: Log warning, proceed (non-blocking)
    - CRITICAL: Block publish, return True

    Fail-open approach: Network errors or missing site_id result in
    warnings but don't block publishing.

    Args:
        article_id: Article identifier for logging
        client_id: Client UUID
        article_keyword: Primary keyword from article (may be None)
        article_title: Article title (used as fallback keyword)

    Returns:
        True if publish should be blocked (CRITICAL risk), False otherwise
    """
    # Build target keywords list
    target_keywords: List[str] = []
    if article_keyword:
        target_keywords.append(article_keyword)
    # Use title words as secondary keywords if no primary keyword
    if not target_keywords and article_title:
        # Extract meaningful words from title (simple approach)
        title_words = [w for w in article_title.split() if len(w) > 3]
        target_keywords.extend(title_words[:3])

    if not target_keywords:
        logger.info(
            "Cannibalization check skipped - no target keywords available",
            extra={"article_id": article_id, "client_id": client_id},
        )
        return False

    # Get site_id from environment or skip
    # In production, this should be resolved from client's GSC connection
    site_id = os.getenv("DEFAULT_GSC_SITE_ID")
    if not site_id:
        logger.info(
            "Cannibalization check skipped - no GSC site configured",
            extra={
                "article_id": article_id,
                "client_id": client_id,
                "hint": "Set DEFAULT_GSC_SITE_ID env var or integrate site lookup",
            },
        )
        return False

    try:
        client = get_open_seo_client()
        check_result = await client.get_prepublish_check(
            client_id=client_id,
            site_id=site_id,
            target_keywords=target_keywords,
        )

        risk = check_result.cannibalization_risk
        if risk is None:
            logger.debug(
                "Cannibalization check: no risk data returned",
                extra={"article_id": article_id},
            )
            return False

        risk_level = risk.risk_level

        if risk_level == RiskLevel.CRITICAL:
            logger.warning(
                "Cannibalization check CRITICAL - blocking publish",
                extra={
                    "article_id": article_id,
                    "client_id": client_id,
                    "target_keywords": target_keywords,
                    "risk_level": risk_level.value,
                    "conflicting_pages": [c.url for c in risk.conflicting_pages[:3]],
                    "recommendation": risk.recommendation,
                },
            )
            return True  # Block publish

        if risk_level in (RiskLevel.HIGH, RiskLevel.MEDIUM):
            logger.warning(
                f"Cannibalization check {risk_level.value.upper()} risk - proceeding with warning",
                extra={
                    "article_id": article_id,
                    "client_id": client_id,
                    "target_keywords": target_keywords,
                    "risk_level": risk_level.value,
                    "conflicting_pages": [c.url for c in risk.conflicting_pages[:3]],
                    "recommendation": risk.recommendation,
                },
            )
            return False  # Warn but don't block

        logger.info(
            "Cannibalization check passed",
            extra={
                "article_id": article_id,
                "risk_level": risk_level.value,
                "safe_to_publish": check_result.safe_to_publish,
            },
        )
        return False

    except OpenSeoClientError as e:
        # Fail-open: log error but don't block publish
        logger.warning(
            "Cannibalization check failed (non-blocking)",
            extra={
                "article_id": article_id,
                "client_id": client_id,
                "error": str(e),
                "error_type": type(e).__name__,
            },
        )
        return False
    except Exception as e:
        # Unexpected error - fail-open with warning
        logger.error(
            "Cannibalization check unexpected error (non-blocking)",
            extra={
                "article_id": article_id,
                "client_id": client_id,
                "error": str(e),
                "error_type": type(e).__name__,
            },
            exc_info=True,
        )
        return False


def _save_result(
    article_id: str,
    client_id: str,
    attempt_number: int,
    cms_type: Optional[str],
    result: PublishResult,
    now_utc: datetime,
) -> None:
    """
    Open a fresh session, write PublishingLog, update article status.

    DFI-008 FIX: Wraps all database operations in a transaction with proper
    rollback on failure to ensure data consistency. Post-commit operations
    (GSC, link graph) run ONLY after successful commit.

    Handles post-publish operations including GSC submission and link graph updates.

    Args:
        article_id: Article identifier
        client_id: Client identifier
        attempt_number: Current publish attempt number
        cms_type: CMS platform type
        result: Publish operation result
        now_utc: Current UTC timestamp
    """
    db: Session = SessionLocal()
    # DFI-008: Store data needed for post-commit operations (GSC, link graph)
    post_commit_data: Optional[dict] = None

    try:
        # DFI-008: Begin explicit transaction block
        # All database operations within this try block are atomic
        article: Optional[ScheduledArticle] = (
            db.query(ScheduledArticle)
            .filter(ScheduledArticle.id == article_id)
            .first()
        )
        if article is None:
            logger.error(
                "Article disappeared during publish",
                extra={
                    "article_id": article_id,
                    "client_id": client_id,
                },
            )
            return

        log_entry = PublishingLog(
            article_id=article_id,
            client_id=client_id,
            attempt_number=attempt_number,
            cms_type=cms_type,
            status="success" if result.success else "failed",
            http_status_code=result.http_status_code,
            response_detail=(
                result.post_url if result.success else result.error
            ),
            attempted_at=now_utc,
        )
        db.add(log_entry)

        if result.success:
            article.status = "published"
            article.published_at = now_utc
            article.cms_post_id = result.post_id
            article.cms_post_url = result.post_url
            article.error_detail = None
            article.updated_at = now_utc
            # DFI-001: Increment version for optimistic locking
            article.version = (article.version or 1) + 1

            # DFI-008: Store data for post-commit operations (outside transaction)
            if result.post_url:
                post_commit_data = {
                    "article_id": article_id,
                    "client_id": client_id,
                    "post_url": result.post_url,
                    "content_html": article.content_html or "",
                    "cms_type": cms_type,
                }
        else:
            new_retry_count = (article.retry_count or 0) + 1
            article.retry_count = new_retry_count
            article.error_detail = result.error
            article.updated_at = now_utc
            # DFI-001: Increment version for optimistic locking
            article.version = (article.version or 1) + 1

            if new_retry_count >= MAX_RETRIES:
                article.status = "failed"
                logger.warning(
                    "Article permanently failed after retries",
                    extra={
                        "article_id": article_id,
                        "client_id": client_id,
                        "retry_count": new_retry_count,
                        "error": result.error,
                    },
                )
            else:
                # Schedule retry with exponential backoff
                # Use min() to prevent IndexError if retry_count is corrupted
                delay_index = min(new_retry_count - 1, len(RETRY_DELAYS_MINUTES) - 1)
                delay_minutes = RETRY_DELAYS_MINUTES[delay_index]
                article.status = "approved"
                article.publish_date = now_utc + timedelta(minutes=delay_minutes)
                article.publishing_started_at = None

                logger.info(
                    "Article retry scheduled",
                    extra={
                        "article_id": article_id,
                        "client_id": client_id,
                        "retry_count": new_retry_count,
                        "delay_minutes": delay_minutes,
                        "error": result.error,
                    },
                )

        # DFI-008: Commit transaction - all or nothing
        db.commit()

        # Log success after commit
        if result.success:
            logger.info(
                "Article published successfully",
                extra={
                    "article_id": article_id,
                    "client_id": client_id,
                    "post_url": result.post_url,
                    "cms_type": cms_type,
                },
            )

    except Exception as exc:
        # DFI-008: Rollback on any failure to maintain data integrity
        db.rollback()
        logger.error(
            "Transaction failed during publish result save - rolled back",
            extra={
                "article_id": article_id,
                "client_id": client_id,
                "error": str(exc),
                "error_type": type(exc).__name__,
            },
            exc_info=True,
        )
        raise
    finally:
        db.close()

    # DFI-008: Post-commit operations (non-blocking, outside transaction)
    # These run ONLY after successful commit to avoid side effects on rollback
    if post_commit_data:
        # Phase 40-03: Submit URL to GSC Indexing API (non-blocking)
        _submit_to_gsc(post_commit_data["article_id"], post_commit_data["post_url"])

        # Phase 40-04: Update link graph in open-seo-main (non-blocking)
        _run_link_graph_update(
            article_id=post_commit_data["article_id"],
            client_id=post_commit_data["client_id"],
            url=post_commit_data["post_url"],
            html=post_commit_data["content_html"],
        )


def _submit_to_gsc(article_id: str, url: str) -> None:
    """
    Submit URL to Google Search Console Indexing API.

    Non-blocking operation - failures are logged but don't block publishing.

    Args:
        article_id: Article identifier for logging
        url: Published article URL
    """
    try:
        gsc_service = GSCService()
        gsc_result = gsc_service.submit_url_for_indexing(url)

        if gsc_result.get("success"):
            logger.info(
                "GSC URL submitted successfully",
                extra={
                    "article_id": article_id,
                    "url": url,
                },
            )
        else:
            logger.warning(
                "GSC URL submission failed (non-blocking)",
                extra={
                    "article_id": article_id,
                    "url": url,
                    "error": gsc_result.get("error"),
                },
            )
    except Exception as e:
        error = GSCSubmissionError(
            f"GSC submission failed for {url}",
            context={
                "article_id": article_id,
                "url": url,
                "error": str(e),
                "error_type": type(e).__name__,
            },
        )
        logger.warning(
            "GSC URL submission error (non-blocking)",
            extra=error.context,
            exc_info=True,
        )


async def _safe_update_link_graph(
    article_id: str, client_id: str, url: str, html: str
) -> None:
    """
    Wrapper with error handling for background graph updates.

    Ensures all exceptions are caught and logged, preventing unhandled
    task exceptions from being silently swallowed.

    Args:
        article_id: Article identifier for logging
        client_id: Client identifier
        url: Published article URL
        html: Article HTML content
    """
    try:
        await _update_link_graph(client_id, url, html)
    except LinkGraphUpdateError:
        # Already logged in _update_link_graph
        pass
    except Exception as e:
        logger.error(
            "Link graph update failed in background task",
            extra={
                "article_id": article_id,
                "client_id": client_id,
                "url": url,
                "error": str(e),
                "error_type": type(e).__name__,
            },
            exc_info=True,
        )


def _run_link_graph_update(
    article_id: str, client_id: str, url: str, html: str
) -> None:
    """
    Run async link graph update from sync context.

    MEDIUM-02 Fix: Simplified async context handling - always use asyncio.run()
    at top level. This function is called from sync code (_save_result), so
    we always create a fresh event loop. This avoids the complexity of nested
    async context detection which was error-prone.

    Non-blocking operation - failures are logged but don't block publishing.

    Args:
        article_id: Article identifier for logging
        client_id: Client identifier
        url: Published article URL
        html: Article HTML content
    """
    try:
        # MEDIUM-02 Fix: Use asyncio.run() for clean async execution from sync context
        # Since this is called from sync code (_save_result -> run_publish_cycle),
        # we're guaranteed to not be in an async context, so asyncio.run() is safe.
        asyncio.run(_safe_update_link_graph(article_id, client_id, url, html))
    except Exception as e:
        # Catch-all for any unexpected errors in the async execution
        logger.warning(
            "Link graph update unexpected error (non-blocking)",
            extra={
                "article_id": article_id,
                "client_id": client_id,
                "url": url,
                "error": str(e),
                "error_type": type(e).__name__,
            },
            exc_info=True,
        )
