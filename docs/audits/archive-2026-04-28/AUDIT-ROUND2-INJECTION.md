# Security Audit Round 2: Injection Vulnerabilities

**Date:** 2026-04-28  
**Auditor:** Claude Code Security Review  
**Scope:** XSS, SQL Injection, Command Injection, Template Injection

---

## Executive Summary

This audit examined the TeveroSEO codebase for injection vulnerabilities across three codebases: `apps/web` (Next.js), `AI-Writer` (FastAPI/Python), and `open-seo-main` (TanStack Start/Node.js).

**Overall Assessment:** The codebase demonstrates mature security practices with proper sanitization frameworks in place. However, **3 CRITICAL issues** were identified that require immediate remediation.

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 3 | Requires immediate fix |
| HIGH | 2 | Fix within sprint |
| MEDIUM | 3 | Fix when convenient |
| LOW | 2 | Informational |

---

## CRITICAL Issues

### CRITICAL-1: Python eval() on AI-Generated Content

**Location:**  
`AI-Writer/backend/services/calendar_generation_datasource_framework/prompt_chaining/steps/phase4/step10_performance_optimization/content_quality_optimizer.py`

**Lines:** 394, 433, 472

**Description:**  
The code uses Python's dangerous built-in code execution function to parse AI-generated responses. If an attacker can influence the AI prompt or the AI model produces unexpected output, arbitrary Python code could be executed.

**Attack Vector:**
1. Attacker influences AI prompt through user-controllable data (target_audience, weekly_themes, etc.)
2. AI model returns malicious Python code instead of JSON
3. The unsafe function executes the malicious code with full server privileges

**Remediation:**
Replace with `json.loads()` which safely parses JSON without code execution:

```python
import json

try:
    scores = json.loads(response.strip())
except json.JSONDecodeError:
    logger.error("Invalid JSON response from AI engine")
    scores = {"readability": 0.5, "engagement": 0.5, "uniqueness": 0.5, "relevance": 0.5}
```

**Risk Level:** CRITICAL - Remote code execution possible

---

### CRITICAL-2: SQL Injection in Migration Script (String Interpolation)

**Location:**  
`AI-Writer/backend/scripts/migrate_all_tables_to_string.py`

**Lines:** 31, 38, 55, 91-92

**Description:**  
Migration script constructs SQL queries using f-string interpolation with table names. While migration scripts run with elevated privileges, this pattern could be exploited if table names come from untrusted sources.

**Mitigating Factors:**
- Table names are hardcoded in the script (not user input)
- Script runs as a one-time migration
- Script requires database admin access to execute

**Remediation:**
1. Validate table names against an allowlist before interpolation
2. Use the `safe_query.sanitize_identifier()` utility already present in the codebase

```python
from utils.safe_query import sanitize_identifier

# SAFE: Validate table names
safe_table = sanitize_identifier(table_name)
check_table_query = f"SELECT name FROM sqlite_master WHERE type='table' AND name='{safe_table}';"
```

**Risk Level:** CRITICAL (pattern) - LOW (actual exploitation risk due to mitigating factors)

---

### CRITICAL-3: Potential Command Injection in Video Edit Service

**Location:**  
`AI-Writer/backend/services/video_studio/edit_service.py`

**Lines:** 267, 269-273 (add_text_overlay function)

**Description:**  
User-provided text is escaped and passed to FFmpeg's `drawtext` filter. The escaping is incomplete and could potentially be bypassed.

```python
# PARTIALLY PROTECTED - Escaping may be insufficient
escaped_text = text.replace("'", "'\\''").replace(":", "\\:")
```

**Missing Escapes:**
- Backslash (`\`) is not escaped
- Semicolon (`;`) is not escaped - FFmpeg uses this as command separator
- Newlines and carriage returns not escaped

**Remediation:**
```python
def escape_ffmpeg_text(text: str) -> str:
    """Escape text for FFmpeg drawtext filter."""
    # FFmpeg drawtext requires specific escaping
    return text.replace("\\", "\\\\").replace("'", "'\\''").replace(":", "\\:").replace(";", "\\;").replace("\n", "\\n").replace("\r", "")
```

**Better Approach:** Use FFmpeg's `textfile` option to read text from a temporary file instead of inline parameter.

**Risk Level:** CRITICAL - Potential command injection

---

## HIGH Issues

### HIGH-1: Incomplete Path Traversal Protection in Video Download

**Location:**  
`AI-Writer/backend/api/video_studio/handlers/avatar.py`

**Lines:** 173-184

**Description:**  
Video download endpoint uses glob patterns without validating the resolved path is within expected directories.

```python
@router.get("/download/{filename}")
async def download_video(filename: str):
    # No validation that filename doesn't contain ".." or absolute paths
    candidate_paths = [
        workspace_root / f"workspace_*" / "media" / "video_studio" / "videos" / filename,
        ...
    ]
```

**Remediation:**
```python
import os

@router.get("/download/{filename}")
async def download_video(filename: str):
    # Sanitize filename
    safe_filename = os.path.basename(filename)
    if safe_filename != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
```

---

### HIGH-2: SQL Injection in Cache Eviction (Dynamic IN Clause)

**Location:**  
`AI-Writer/backend/services/cache/persistent_research_cache.py` (line 113)  
`AI-Writer/backend/services/cache/persistent_content_cache.py` (line 168)  
`AI-Writer/backend/services/cache/persistent_outline_cache.py` (line 136)

**Description:**  
Dynamic SQL IN clause constructed with string formatting, though IDs come from the database itself.

```python
placeholders = ','.join(['?' for _ in old_ids])
conn.execute(f"DELETE FROM research_cache WHERE id IN ({placeholders})", old_ids)
```

**Mitigating Factors:**
- `old_ids` are database-generated integers from a previous SELECT
- No user input reaches this code path

**Remediation:**
Use SQLAlchemy's proper parameter binding or the `build_in_clause` utility from `safe_query.py`.

---

## MEDIUM Issues

### MEDIUM-1: XSS Protection Relies on DOMPurify (Correctly Implemented)

**Location:**  
- `apps/web/src/lib/sanitize.ts` - Central sanitization utility
- `apps/web/src/components/ai/SafeAIOutput.tsx` - AI output component
- `apps/web/src/app/(shell)/clients/[clientId]/articles/new/page.tsx` (line 84)
- `apps/web/src/app/(shell)/clients/[clientId]/articles/[articleId]/page.tsx` (line 118)
- `apps/web/src/components/reports/ReportFooter.tsx` (line 53)

**Status:** PROPERLY IMPLEMENTED

The codebase correctly uses DOMPurify with strict allowlist configuration:
- Uses `ALLOWED_TAGS` (allowlist) not `FORBID_TAGS` (blocklist)
- Disables `data-*` attributes
- Restricts URL schemes to `https?|mailto|tel`
- Sanitizes at render time (not trusting "pre-sanitized" data)

**Recommendation:** No action required. Current implementation follows best practices.

---

### MEDIUM-2: SQL in Open-SEO Uses Drizzle Tagged Templates (Safe)

**Location:**  
`open-seo-main/src/server/middleware/rls-context.ts`

**Status:** SAFE

The code uses Drizzle's `sql` tagged template literals which provide automatic parameterization.

Drizzle's `sql` template function escapes interpolated values as parameters, preventing SQL injection.

---

### MEDIUM-3: Subprocess Calls in Video Service (Currently Safe)

**Location:**  
`AI-Writer/backend/services/video_studio/edit_service.py`

**Observation:**  
FFmpeg commands use list format (not `shell=True`), which prevents shell injection:

```python
# SAFE: Using list format, not shell=True
cmd = [
    "ffmpeg", "-i", input_path,
    "-vf", f"volume={volume_factor}",  # volume_factor is validated
    "-c:v", "copy", "-c:a", "aac", "-y", output_path
]
subprocess.run(cmd, capture_output=True, text=True, timeout=300)
```

**Recommendation:** Maintain current practice. Add input validation for numeric parameters.

---

## LOW Issues

### LOW-1: Development Fallback for Asset Signing Key

**Location:**  
`AI-Writer/backend/api/assets_serving.py` (lines 16-19)

**Description:**  
Falls back to a hardcoded development key if `ASSET_SIGNING_KEY` is not set. Warning is logged but application continues.

**Recommendation:** In production, fail hard rather than falling back to an insecure key.

---

### LOW-2: Safe Query Utilities Exist But Not Consistently Used

**Location:**  
`AI-Writer/backend/utils/safe_query.py`

**Observation:**  
The codebase has comprehensive safe query utilities (`sanitize_identifier`, `safe_like_pattern`, `safe_order_by`, `build_in_clause`) but they are not consistently used across all modules.

**Recommendation:** Audit migration scripts and cache services to use these utilities.

---

## Good Practices Observed

1. **DOMPurify Integration:** Frontend sanitization uses DOMPurify with strict allowlist configuration
2. **Drizzle ORM:** Open-SEO uses Drizzle's parameterized queries throughout
3. **Path Traversal Protection:** Images endpoint uses `.resolve()` and `.relative_to()` for path validation
4. **Signed URLs:** Asset serving implements HMAC-signed URLs with expiration
5. **Input Sanitization:** Multiple layers of sanitization (basename extraction, character allowlists)
6. **Safe Query Module:** Comprehensive SQL safety utilities exist in `safe_query.py`

---

## Remediation Priority

| Issue | Priority | Effort | Impact |
|-------|----------|--------|--------|
| CRITICAL-1 (dangerous code execution) | P0 | Low | Immediate RCE fix |
| CRITICAL-3 (FFmpeg) | P0 | Medium | Review and harden escaping |
| CRITICAL-2 (migration) | P1 | Low | Add identifier validation |
| HIGH-1 (path traversal) | P1 | Low | Add basename validation |
| HIGH-2 (IN clause) | P2 | Low | Use proper binding |

---

## Files Requiring Changes

1. `AI-Writer/backend/services/calendar_generation_datasource_framework/prompt_chaining/steps/phase4/step10_performance_optimization/content_quality_optimizer.py`
   - Replace unsafe code execution with `json.loads()`

2. `AI-Writer/backend/services/video_studio/edit_service.py`
   - Improve FFmpeg text escaping or use `textfile` approach

3. `AI-Writer/backend/scripts/migrate_all_tables_to_string.py`
   - Use `sanitize_identifier()` for table names

4. `AI-Writer/backend/api/video_studio/handlers/avatar.py`
   - Add `os.path.basename()` validation for filename parameter

5. `AI-Writer/backend/services/cache/persistent_*.py` (3 files)
   - Use proper parameter binding for IN clauses

---

## FIXES IMPLEMENTED - 2026-04-28

### CRITICAL-1: Dynamic Code Execution Removed (RCE Prevention)
- **File:** `AI-Writer/backend/services/calendar_generation_datasource_framework/prompt_chaining/steps/phase4/step10_performance_optimization/content_quality_optimizer.py`
- **Lines Fixed:** 394, 433, 472 (three instances)
- **Fix:** Replaced dangerous `eval()` calls with safe `json.loads()` for parsing AI responses
- **Added:** `import json` at top of file
- **Fallback:** On JSON parse failure, returns safe default scores `{"readability": 0.5, "engagement": 0.5, "uniqueness": 0.5, "relevance": 0.5}`

### HIGH-1: Path Traversal Fixed
- **File:** `AI-Writer/backend/api/video_studio/handlers/avatar.py`
- **Lines Fixed:** 173-184 (download_video endpoint)
- **Fix:** Added `os.path.basename()` validation to sanitize filename parameter
- **Validation:** Rejects filenames containing `..`, absolute paths, or path separators
- **Added:** `import os` at top of file

### CRITICAL-3: FFmpeg Text Escaping Fixed (Command Injection Prevention)
- **File:** `AI-Writer/backend/services/video_studio/edit_service.py`
- **Lines Fixed:** 267 (add_text_overlay function)
- **Fix:** Comprehensive escaping for FFmpeg drawtext filter:
  - Backslash (`\`) -> `\\`
  - Single quote (`'`) -> `'\''`
  - Colon (`:`) -> `\:`
  - Semicolon (`;`) -> `\;` (FFmpeg command separator)
  - Newline (`\n`) -> `\n` (escaped)
  - Carriage return (`\r`) -> removed

### Remaining Items (Lower Priority)
- CRITICAL-2 (migration script): Low actual risk - table names are hardcoded
- HIGH-2 (IN clause): Low actual risk - IDs come from database, not user input
