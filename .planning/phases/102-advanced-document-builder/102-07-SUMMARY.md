---
phase: 102-advanced-document-builder
plan: 07
subsystem: document-processing
tags: [upload, r2, queue, ui]
dependency_graph:
  requires: [102-06]
  provides: [upload-api, upload-service, processing-queue, dropzone-ui]
  affects: [102-08, 102-09]
tech_stack:
  added: ["@aws-sdk/client-s3"]
  patterns: [r2-storage, in-memory-queue, dropzone-upload, polling-progress]
key_files:
  created:
    - apps/web/src/db/schema/document-builder.ts (extended)
    - apps/web/src/lib/document-processing/upload-service.ts
    - apps/web/src/lib/document-processing/processing-queue.ts
    - apps/web/src/app/api/documents/upload/route.ts
    - apps/web/src/components/document-builder/UploadDropzone.tsx
    - apps/web/src/hooks/useDocumentProcessing.ts
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml
decisions:
  - "In-memory queue with setInterval instead of BullMQ (apps/web pattern per 102-06)"
  - "R2 workspace-scoped paths: {workspaceId}/{documentId}/{fileName}"
  - "Polling-based progress tracking (1s interval)"
metrics:
  duration_minutes: 10
  completed: "2026-05-16T22:40:36Z"
  tasks_completed: 5
  tasks_total: 5
  files_created: 8
  tests_added: 30
---

# Phase 102 Plan 07: Core Upload Pipeline Summary

Upload pipeline with R2 storage, processing queue, and progress-tracking UI.

## One-liner

R2 document upload with workspace-scoped storage, in-memory queue processing, and react-dropzone UI with polling-based progress tracking.

## Commits

| Task | Hash | Description |
|------|------|-------------|
| 1 | c12d63d12 | feat(102-07): add uploaded_documents database table |
| 2 | 6a10a6fe2 | feat(102-07): add R2 upload service with validation |
| 3 | c8fd5b944 | feat(102-07): add document processing queue with progress tracking |
| 4 | f439034f0 | feat(102-07): add upload API route with auth and rate limiting |
| 5 | f17932237 | feat(102-07): add upload dropzone and processing hook |

## Verification Results

| Check | Result |
|-------|--------|
| Upload API accepts PDF, DOCX, images | PASS |
| Files stored in R2 with workspace-scoped paths | PASS |
| Database record created with 'pending' status | PASS |
| Queue job added after upload | PASS |
| Progress tracking via polling works | PASS |
| Rate limiting prevents abuse | PASS |
| Tests passing | 30/30 |

## Key Deliverables

### Task 1: uploaded_documents Table
- Extended document-builder.ts schema with uploadedDocuments table
- Fields: id, workspaceId, fileName, fileType, fileSize, mimeType, r2Key, r2Bucket
- Processing state: status, processingProgress, processingError, timestamps
- OCR fields: extractedText, extractedMetadata, ocrTier, ocrConfidence
- Indexes on workspaceId and status

### Task 2: R2 Upload Service
- `uploadDocument(file, workspaceId)` - validates and uploads to R2
- `getDocumentStatus(documentId)` - returns current processing state
- File validation: PDF, DOCX, PNG, JPG (max 20MB)
- R2 path format: `{workspaceId}/{documentId}/{fileName}`
- Added @aws-sdk/client-s3 dependency

### Task 3: Document Processing Queue
- In-memory queue with setInterval (matches 102-06 pattern)
- BullMQ-like interface for future migration
- Exponential backoff retry (configurable attempts)
- Progress tracking via updateProgress helper
- Status transitions: pending -> processing -> completed/failed

### Task 4: Upload API Route
- POST /api/documents/upload - Upload with auth and rate limiting
- GET /api/documents/upload?documentId=xxx - Status polling
- Rate limit: 10 uploads per minute
- User-friendly validation errors

### Task 5: UI Components
- UploadDropzone with react-dropzone
- Visual states: idle, uploading, processing, completed, error
- useDocumentProcessing hook with polling
- Progress bar and reset functionality

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used in-memory queue instead of BullMQ**
- **Found during:** Task 3
- **Issue:** apps/web doesn't have BullMQ dependency (same as 102-06)
- **Fix:** Implemented in-memory queue with setInterval, BullMQ-like interface
- **Files modified:** apps/web/src/lib/document-processing/processing-queue.ts
- **Commit:** c8fd5b944

## Self-Check: PASSED

- [x] apps/web/src/db/schema/document-builder.ts - uploadedDocuments exists
- [x] apps/web/src/lib/document-processing/upload-service.ts - uploadDocument, getDocumentStatus
- [x] apps/web/src/lib/document-processing/processing-queue.ts - documentProcessingQueue
- [x] apps/web/src/app/api/documents/upload/route.ts - POST, GET
- [x] apps/web/src/components/document-builder/UploadDropzone.tsx - component
- [x] apps/web/src/hooks/useDocumentProcessing.ts - hook
- [x] All commits: c12d63d12, 6a10a6fe2, c8fd5b944, f439034f0, f17932237

## Next Steps

- **102-08:** Implement PDF/DOCX parsers that process queued documents
- **102-09:** Add OCR tiered processing (native -> tesseract -> deepseek -> gemini)
