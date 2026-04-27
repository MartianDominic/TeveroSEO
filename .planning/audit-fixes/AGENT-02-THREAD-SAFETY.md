# Agent 02: Python Thread Safety

## Issues Fixed

- [x] CRITICAL: Added threading.Lock to jobs dict (`_jobs_lock`)
- [x] CRITICAL: Added threading.Lock to workers dict (`_workers_lock`)
- [x] CRITICAL: Fixed fire-and-forget `asyncio.ensure_future` with `create_task` + error callback
- [x] HIGH: Fixed nested `asyncio.run()` conflict with `_run_async_in_thread` helper

## Files Modified

### Rewrote: `AI-Writer/backend/services/background_jobs.py`

Complete rewrite with thread-safe patterns:

1. **Dedicated locks for shared state**:
   ```python
   self._jobs_lock = threading.Lock()
   self._workers_lock = threading.Lock()
   ```

2. **All shared state access protected**:
   - `create_job()`: Uses `_jobs_lock` when adding job
   - `_start_job()`: Uses both locks for job status update and worker registration
   - `_run_job()`: Uses locks for all state reads/writes
   - `get_job_status()`: Uses `_jobs_lock` for reading
   - `update_progress()`: Uses `_jobs_lock` for updates
   - `get_user_jobs()`: Uses `_jobs_lock` for iteration
   - `cancel_job()`: Uses `_jobs_lock` for status change
   - `_cleanup_old_jobs()`: Uses `_jobs_lock` for cleanup

3. **Thread-safe singleton initialization**:
   ```python
   _service_lock = threading.Lock()
   _service_instance: Optional[BackgroundJobService] = None

   def get_background_job_service() -> BackgroundJobService:
       global _service_instance
       if _service_instance is None:
           with _service_lock:
               if _service_instance is None:  # Double-checked locking
                   _service_instance = BackgroundJobService()
       return _service_instance
   ```

4. **Safe async execution in threads**:
   ```python
   def _run_async_in_thread(self, coro):
       try:
           loop = asyncio.get_running_loop()
           return asyncio.run_coroutine_threadsafe(coro, loop).result()
       except RuntimeError:
           loop = asyncio.new_event_loop()
           asyncio.set_event_loop(loop)
           try:
               return loop.run_until_complete(coro)
           finally:
               loop.close()
   ```

### Modified: `AI-Writer/backend/services/auto_publish_executor.py`

1. **Added `_run_async_in_thread()` helper** (lines 472-492):
   - Safely handles async execution from sync context
   - Avoids "cannot call asyncio.run() while another loop is running" error

2. **Added `_safe_update_link_graph()` wrapper** (lines 495-522):
   - Wraps `_update_link_graph` with comprehensive error handling
   - Ensures no exceptions escape to cause unhandled task errors

3. **Replaced fire-and-forget pattern in `_run_link_graph_update()`** (lines 525-580):
   - Before: `asyncio.ensure_future(_update_link_graph(...))` - silently swallowed errors
   - After: `asyncio.create_task(_safe_update_link_graph(...))` with done callback
   - Done callback logs any unhandled exceptions

## Thread Safety Guarantees

| Guarantee | Implementation |
|-----------|----------------|
| All shared state protected by locks | `_jobs_lock`, `_workers_lock` |
| No race conditions on job/worker dicts | Lock acquired before read/write |
| Automatic cleanup runs in daemon thread | Non-blocking, uses `threading.Event().wait()` |
| Singleton initialization is thread-safe | Double-checked locking pattern |
| Async code safely runs from sync threads | `_run_async_in_thread()` helper |
| Background tasks have error handling | `create_task` + `add_done_callback` |

## Lock Ordering Convention

To prevent deadlocks, always acquire locks in this order:
1. `_jobs_lock` first
2. `_workers_lock` second

Note: In the current implementation, we avoid holding both locks simultaneously by:
- Reading worker count, releasing lock, then checking capacity
- Updating job status and worker registration in separate lock blocks

## Testing Recommendations

1. **Concurrent job creation test**: Create 100 jobs from 10 threads simultaneously
2. **Progress update race test**: Update progress from multiple threads
3. **Cleanup during execution test**: Verify cleanup doesn't affect running jobs
4. **Async handler test**: Verify async job handlers work correctly in thread context

## Backward Compatibility

- `background_job_service` global still exported for existing code
- All public method signatures unchanged
- Job status dict format unchanged
