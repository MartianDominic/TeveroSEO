# Security Audit: File System Operations (Round 2)

**Audit Date:** 2026-04-28
**Scope:** Path traversal, file permissions, file type handling, storage issues
**Files Examined:** AI-Writer/backend, apps/web/src, open-seo-main/src

---

## Executive Summary

The codebase demonstrates **good security practices** in most file operation areas, with comprehensive file validation and path sanitization implemented. However, several areas require attention:

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | - |
| HIGH | 2 | Action Required |
| MEDIUM | 4 | Recommended |
| LOW | 3 | Advisory |

---

## Findings

### HIGH-FILE-001: Path Traversal Risk in Deep Crawl Service

**File:** `AI-Writer/backend/services/research/deep_crawl_service.py`
**Lines:** 105-106, 254

**Issue:** The `workspace_dir` path is constructed using user_id but the file `filepath` is built using `safe_title` derived from scraped content. While `safe_title` is sanitized, the workspace_dir itself uses a relative path that could be manipulated.

```python
# Line 105-106 - Vulnerable pattern
workspace_dir = f"workspace/workspace_{user_id}/crawled_content"
os.makedirs(workspace_dir, exist_ok=True)

# Line 254 - File write without path validation
filepath = os.path.join(workspace_dir, filename)
with open(filepath, "w", encoding="utf-8") as f:
```

**Risk:** If `user_id` is not properly sanitized upstream, path traversal is possible via `../` sequences.

**Recommendation:**
1. Use the existing `_sanitize_user_id()` function from `storage_paths.py`
2. Use `resolve_user_media_path()` from `utils/storage_paths.py` which includes path escape validation
3. Validate the final path is within the expected workspace directory using `Path.relative_to()`

---

### HIGH-FILE-002: Missing Path Escape Validation in Product Avatar Service

**File:** `AI-Writer/backend/services/product_marketing/product_avatar_service.py`
**Lines:** 176-186

**Issue:** User-provided directory is created and files written without validating the resolved path stays within bounds.

```python
# Line 176-177 - Directory created with user_id
user_dir = output_dir / user_id
user_dir.mkdir(parents=True, exist_ok=True)

# Line 185-187 - File written
file_path = user_dir / filename
with open(file_path, 'wb') as f:
    f.write(video_bytes)
```

**Risk:** If `user_id` contains path traversal sequences (e.g., `../../../etc`), files could be written outside intended directory.

**Recommendation:**
1. Sanitize `user_id` before path construction
2. Resolve path and validate it's within `output_dir`:
```python
resolved_path = file_path.resolve()
if not str(resolved_path).startswith(str(output_dir.resolve())):
    raise ValueError("Path escape detected")
```

---

### MEDIUM-FILE-001: Fallback to Content-Type Header in File Validator

**File:** `AI-Writer/backend/services/file_validator.py`
**Lines:** 480-489

**Issue:** When magic byte detection fails, the code falls back to trusting the `Content-Type` header, which can be spoofed.

```python
if detected_mime is None:
    # Fall back to Content-Type header with warning
    detected_mime = file.content_type or ""
    warnings.append(...)
```

**Status:** Partially mitigated (warning is logged, and the file is still validated against whitelist)

**Recommendation:** Consider rejecting files when magic byte detection fails entirely, rather than trusting headers.

---

### MEDIUM-FILE-002: Incomplete Path Sanitization in R2 Cache

**File:** `open-seo-main/src/server/lib/r2.ts`, `open-seo-main/src/server/lib/r2-cache.ts`
**Lines:** 6-10 (r2.ts), 28-31 (r2-cache.ts)

**Issue:** Path sanitization replaces `../` but only as a literal string, not recursively.

```typescript
// r2.ts line 9
const safe = key.replace(/[\0]/g, "_").replace(/\.\.\//g, "_").replace(/\//g, "__");

// r2-cache.ts line 29  
const safe = key.replace(/[\0]/g, "_").replace(/\.\.\//g, "_").replace(/[/:]/g, "__");
```

**Risk:** Patterns like `....//` would become `../` after one replacement pass.

**Recommendation:** Use a loop or ensure path.resolve() + relative check:
```typescript
while (safe.includes('../')) {
  safe = safe.replace(/\.\.\//g, '_');
}
// Or better: validate resolved path is within STORAGE_ROOT
```

---

### MEDIUM-FILE-003: User Workspace Manager SQL Injection Risk

**File:** `AI-Writer/backend/services/user_workspace_manager.py`
**Lines:** 130-151

**Issue:** Table names constructed from user_id are used in raw SQL (though user_id is sanitized).

```python
user_tables = [
    f"user_{user_id}_content_items",
    ...
]
for table in user_tables:
    create_sql = f"""
    CREATE TABLE IF NOT EXISTS {table} (...)
    """
    self.db.execute(text(create_sql))
```

**Status:** Mitigated by `_sanitize_user_id()` on line 36-38, but this function is defined in the same class and may not always be called first.

**Recommendation:** Always call `_sanitize_user_id()` before constructing table names, or move table creation to database.py which has the authoritative sanitization.

---

### MEDIUM-FILE-004: Temporary File Race Condition Potential

**File:** `AI-Writer/backend/services/intelligence/agent_flat_context.py`
**Lines:** Uses `tempfile.mkstemp()` (proper)

**File:** `AI-Writer/backend/services/integrations/wordpress_content.py`
**Lines:** Uses `tempfile.NamedTemporaryFile(delete=False)`

**Status:** Generally handled correctly with atomic rename patterns, but `delete=False` temporary files should ensure cleanup in all error paths.

---

### LOW-FILE-001: Development Fallback Signing Key

**File:** `AI-Writer/backend/api/assets_serving.py`
**Lines:** 16-19

**Issue:** Fallback signing key used when `ASSET_SIGNING_KEY` is not configured.

```python
ASSET_SIGNING_KEY = os.getenv("ASSET_SIGNING_KEY", "")
if not ASSET_SIGNING_KEY:
    logger.warning("ASSET_SIGNING_KEY not configured...")
    ASSET_SIGNING_KEY = "dev-asset-signing-key-not-for-production"
```

**Status:** Warning is logged, and this is acceptable for development. Production deployments should fail hard if key is missing.

**Recommendation:** In production mode, raise an exception if signing key is missing.

---

### LOW-FILE-002: Hardcoded Image Output Directory

**File:** `AI-Writer/backend/api/images.py`
**Lines:** 103-104

**Issue:** Output directory is relative to code location, not configurable.

```python
base_dir = Path(__file__).parent.parent
output_dir = base_dir / "image_studio_images"
```

**Recommendation:** Use environment variable or centralized storage paths utility.

---

### LOW-FILE-003: Static Analysis Agent Context File Access

**File:** `AI-Writer/backend/services/intelligence/agent_flat_context.py`
**Lines:** Various

**Issue:** The agent context system reads files from manifests without validating the manifest hasn't been tampered with. If an attacker could modify the manifest, they could point to arbitrary files.

**Status:** Low risk since manifests are written by the application and not user-uploadable.

---

## Positive Findings (Security Done Right)

### 1. Comprehensive File Validator Service
**File:** `AI-Writer/backend/services/file_validator.py`

Excellent implementation with:
- Magic byte detection (not just Content-Type headers)
- Whitelist-based MIME validation
- Size limits per file category
- Secure UUID-based filename generation
- Hashing for deduplication/integrity

### 2. Storage Paths Utility with Escape Detection
**File:** `AI-Writer/backend/utils/storage_paths.py`

```python
# Lines 52-55 - Path escape prevention
workspace_root = get_user_workspace(user_id)
if workspace_root not in path.parents and path != workspace_root:
    raise ValueError(f"Resolved path escapes workspace: {path}")
```

### 3. Signed URL Asset Serving
**File:** `AI-Writer/backend/api/assets_serving.py`

- HMAC-signed URLs with expiration
- Constant-time comparison to prevent timing attacks
- User ID and filename sanitization

### 4. Branding Storage with Path Traversal Protection
**File:** `open-seo-main/src/server/lib/storage.ts`

```typescript
// Lines 86-89 - Explicit path traversal check
const sanitizedClientId = clientId.replace(/[^a-zA-Z0-9-]/g, "");
if (sanitizedClientId !== clientId || sanitizedClientId.includes("..")) {
    throw new Error("Invalid client ID format");
}
```

### 5. File Storage Utility with Atomic Writes
**File:** `AI-Writer/backend/utils/file_storage.py`

- Atomic file writes (temp file + rename)
- Filename sanitization
- Size validation
- Automatic cleanup on error

### 6. Image Serving with Path Validation
**File:** `AI-Writer/backend/api/images.py` (Lines 1080-1089)

```python
# Security: Prevent directory traversal attacks
try:
    image_path.relative_to(base_subdir)
except ValueError:
    raise HTTPException(status_code=403, detail="Access denied: Invalid image path")
```

---

## Recommendations Summary

### Immediate Actions (HIGH)
1. **HIGH-FILE-001:** Update deep_crawl_service.py to use `resolve_user_media_path()` from storage_paths.py
2. **HIGH-FILE-002:** Add path escape validation to product_avatar_service.py

### Short-Term Actions (MEDIUM)
3. **MEDIUM-FILE-001:** Consider rejecting files when magic detection fails entirely
4. **MEDIUM-FILE-002:** Fix recursive path traversal in r2.ts/r2-cache.ts
5. **MEDIUM-FILE-003:** Consolidate table creation in database.py
6. **MEDIUM-FILE-004:** Audit all tempfile usage for proper cleanup

### Long-Term Actions (LOW)
7. **LOW-FILE-001:** Fail hard on missing signing key in production
8. **LOW-FILE-002:** Centralize all storage paths via environment/config
9. **LOW-FILE-003:** Add integrity validation for agent manifests

---

## Files Audited

| File | Status | Notes |
|------|--------|-------|
| AI-Writer/backend/services/file_validator.py | GOOD | Comprehensive validation |
| AI-Writer/backend/api/csv_import.py | GOOD | Validates type and size |
| AI-Writer/backend/api/assets_serving.py | GOOD | Signed URLs, sanitization |
| AI-Writer/backend/api/images.py | GOOD | Path validation on serve |
| AI-Writer/backend/utils/file_storage.py | GOOD | Atomic writes, sanitization |
| AI-Writer/backend/utils/storage_paths.py | GOOD | Escape detection |
| AI-Writer/backend/services/database.py | GOOD | User ID sanitization |
| AI-Writer/backend/services/research/deep_crawl_service.py | NEEDS FIX | Path not validated |
| AI-Writer/backend/services/product_marketing/product_avatar_service.py | NEEDS FIX | Path not validated |
| AI-Writer/backend/services/user_workspace_manager.py | OK | SQL via sanitized input |
| AI-Writer/backend/services/intelligence/agent_flat_context.py | OK | Tempfile handled correctly |
| open-seo-main/src/server/lib/r2.ts | NEEDS FIX | Incomplete traversal protection |
| open-seo-main/src/server/lib/r2-cache.ts | NEEDS FIX | Incomplete traversal protection |
| open-seo-main/src/server/lib/storage.ts | GOOD | Explicit traversal check |
| apps/web/src/lib/export/csv.ts | GOOD | Client-side only, no path ops |
| apps/web/src/actions/voice.ts | GOOD | Server actions with validation |

---

## Appendix: No Archive Extraction Found

The codebase does not appear to handle ZIP, TAR, or other archive extraction, which eliminates "zip slip" attack vectors. No `zipfile`, `tarfile`, or `shutil.unpack_archive` patterns were found.

---

*Generated by Security Audit Round 2*
