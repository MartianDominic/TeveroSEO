"""
TeveroSEO Document Parser Service
Phase 102-08: Format-specific parsers for PDF and DOCX.

FastAPI service that extracts text with rich metadata from uploaded documents.
Runs on port 8002 (AI-Writer uses 8000, scrapling-engine uses 8001).
"""

import os
import tempfile
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from parsers.pdf_parser import parse_pdf
from parsers.docx_parser import parse_docx
from ocr.orchestrator import extract_text_tiered

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =============================================================================
# Pydantic Models
# =============================================================================


class ParseResponse(BaseModel):
    """Response model for document parsing."""
    success: bool
    file_type: str
    text: str
    page_count: int
    metadata: Dict[str, Any]
    fonts: List[Dict[str, Any]]
    colors: List[str]
    has_images: bool
    needs_ocr: bool
    ocr_tier: Optional[str] = None
    ocr_confidence: Optional[float] = None
    ocr_cost: Optional[float] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    version: str


# =============================================================================
# Application Setup
# =============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("Document Parser service starting")
    yield
    logger.info("Document Parser service shutting down")


app = FastAPI(
    title="TeveroSEO Document Parser",
    description="PDF and DOCX parsing with rich metadata extraction",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for TypeScript client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Endpoints
# =============================================================================


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        service="document-parser",
        version="1.0.0",
    )


@app.post("/parse", response_model=ParseResponse)
async def parse_document(file: UploadFile):
    """
    Parse uploaded document and extract text with metadata.

    Supports:
    - PDF: Extracts text, fonts, colors, positions. Detects password-protected.
    - DOCX: Extracts text with formatting, tables, headers.

    Returns structured response with:
    - text: Full extracted text
    - page_count: Number of pages (estimated for DOCX)
    - metadata: Title, author, creator
    - fonts: List of fonts with sizes and usage counts
    - colors: List of colors used in text
    - has_images: Whether document contains images
    - needs_ocr: Whether OCR is recommended (image-heavy pages)
    """

    # Determine file type from content type
    content_type = file.content_type or ""
    if content_type == "application/pdf":
        file_type = "pdf"
        suffix = ".pdf"
    elif "document" in content_type or content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        file_type = "docx"
        suffix = ".docx"
    else:
        raise HTTPException(400, f"Unsupported file type: {content_type}")

    # Save to temp file for parsing
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()

            # File size validation (20MB limit per threat model T-102-08-02)
            if len(content) > 20 * 1024 * 1024:
                raise HTTPException(413, "File too large. Maximum size is 20MB.")

            tmp.write(content)
            tmp_path = tmp.name

        # Parse based on file type
        if file_type == "pdf":
            result = parse_pdf(tmp_path)
        else:
            result = parse_docx(tmp_path)

        # OCR processing if needed (scanned PDF or image-heavy document)
        ocr_tier = None
        ocr_confidence = None
        ocr_cost = None

        if result.needs_ocr and hasattr(result, "page_images") and result.page_images:
            logger.info(f"Running tiered OCR for {len(result.page_images)} page images")
            ocr_result = await extract_text_tiered(result.page_images)

            # Merge OCR text with any native text
            if ocr_result.text:
                result.text = ocr_result.text
            ocr_tier = ocr_result.tier
            ocr_confidence = ocr_result.confidence
            ocr_cost = ocr_result.cost

            logger.info(
                f"OCR complete: tier={ocr_tier}, confidence={ocr_confidence:.1f}%, "
                f"cost=${ocr_cost:.4f}"
            )

        logger.info(
            f"Parsed {file_type}: pages={result.page_count}, "
            f"text_len={len(result.text)}, fonts={len(result.fonts)}"
        )

        return ParseResponse(
            success=True,
            file_type=file_type,
            text=result.text,
            page_count=result.page_count,
            metadata=result.metadata,
            fonts=result.fonts,
            colors=result.colors,
            has_images=result.has_images,
            needs_ocr=result.needs_ocr,
            ocr_tier=ocr_tier,
            ocr_confidence=ocr_confidence,
            ocr_cost=ocr_cost,
        )

    except ValueError as e:
        # Password-protected PDF or other validation error
        error_msg = str(e)
        logger.warning(f"Parsing validation error: {error_msg}")

        if "password" in error_msg.lower() or "encrypted" in error_msg.lower():
            return ParseResponse(
                success=False,
                file_type=file_type,
                text="",
                page_count=0,
                metadata={},
                fonts=[],
                colors=[],
                has_images=False,
                needs_ocr=False,
                error="Password-protected PDF detected. Please remove password protection and re-upload.",
            )

        return ParseResponse(
            success=False,
            file_type=file_type,
            text="",
            page_count=0,
            metadata={},
            fonts=[],
            colors=[],
            has_images=False,
            needs_ocr=False,
            error=error_msg,
        )

    except HTTPException:
        raise

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Parsing error: {error_msg}")

        # Sanitize error message (T-102-08-03)
        sanitized_error = "Document parsing failed. Please try a different file."

        return ParseResponse(
            success=False,
            file_type=file_type,
            text="",
            page_count=0,
            metadata={},
            fonts=[],
            colors=[],
            has_images=False,
            needs_ocr=False,
            error=sanitized_error,
        )

    finally:
        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info",
    )
