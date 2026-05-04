"""
Job State Machine for background job status transitions.

Plan 69-04 Task 2: Implements atomic state transitions with validation.

Provides:
- JobStatus enum with all valid job states
- VALID_TRANSITIONS defining allowed state changes
- InvalidTransitionError for invalid transitions
- validate_transition() for checking transition validity
- transition_job_status() for atomic database updates

The state machine ensures:
1. Jobs can only move through valid state sequences
2. Transitions are atomic (WHERE checks current status)
3. Invalid transitions raise InvalidTransitionError
4. Optimistic locking via version field prevents race conditions
"""

from enum import Enum
from typing import Optional, Set
from datetime import datetime, timezone

from loguru import logger
from sqlalchemy import update
from sqlalchemy.orm import Session


class JobStatus(str, Enum):
    """
    Valid job status values.

    State lifecycle:
      pending -> processing -> completed
                           -> failed -> retrying -> processing
                           -> cancelled
    """
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class InvalidTransitionError(Exception):
    """
    Raised when an invalid state transition is attempted.

    Attributes:
        from_status: The current status
        to_status: The attempted target status
        job_id: Optional job identifier
    """
    def __init__(
        self,
        from_status: str,
        to_status: str,
        job_id: Optional[str] = None,
    ):
        self.from_status = from_status
        self.to_status = to_status
        self.job_id = job_id

        msg = f"Invalid state transition from '{from_status}' to '{to_status}'"
        if job_id:
            msg = f"[Job {job_id}] {msg}"

        super().__init__(msg)


# Valid state transitions map
# Key: current status, Value: set of allowed next statuses
VALID_TRANSITIONS: dict[JobStatus, Set[JobStatus]] = {
    JobStatus.PENDING: {
        JobStatus.PROCESSING,
        JobStatus.CANCELLED,
    },
    JobStatus.PROCESSING: {
        JobStatus.COMPLETED,
        JobStatus.FAILED,
        JobStatus.CANCELLED,
    },
    JobStatus.COMPLETED: set(),  # Terminal state - no transitions allowed
    JobStatus.FAILED: {
        JobStatus.RETRYING,
        JobStatus.CANCELLED,
    },
    JobStatus.CANCELLED: set(),  # Terminal state - no transitions allowed
    JobStatus.RETRYING: {
        JobStatus.PROCESSING,
        JobStatus.CANCELLED,
    },
}


def validate_transition(
    from_status: str,
    to_status: str,
    job_id: Optional[str] = None,
) -> bool:
    """
    Check if a state transition is valid.

    Args:
        from_status: Current job status
        to_status: Target job status
        job_id: Optional job ID for error messages

    Returns:
        True if transition is valid

    Raises:
        InvalidTransitionError: If transition is not allowed
    """
    try:
        from_enum = JobStatus(from_status)
        to_enum = JobStatus(to_status)
    except ValueError as e:
        raise InvalidTransitionError(from_status, to_status, job_id) from e

    allowed = VALID_TRANSITIONS.get(from_enum, set())

    if to_enum not in allowed:
        raise InvalidTransitionError(from_status, to_status, job_id)

    return True


def is_valid_transition(from_status: str, to_status: str) -> bool:
    """
    Check if a state transition is valid without raising exception.

    Args:
        from_status: Current job status
        to_status: Target job status

    Returns:
        True if transition is valid, False otherwise
    """
    try:
        validate_transition(from_status, to_status)
        return True
    except InvalidTransitionError:
        return False


async def transition_job_status(
    db: Session,
    job_model,
    job_id: str,
    from_status: str,
    to_status: str,
    expected_version: Optional[int] = None,
    additional_updates: Optional[dict] = None,
) -> bool:
    """
    Atomically transition a job to a new status with validation.

    Uses optimistic locking via version field and validates state transitions.
    The transition is atomic: UPDATE with WHERE checks current status and version.

    Args:
        db: SQLAlchemy session
        job_model: The SQLAlchemy model class (e.g., ScheduledArticle)
        job_id: Job identifier
        from_status: Expected current status
        to_status: Target status
        expected_version: Optional version for optimistic locking
        additional_updates: Optional dict of additional field updates

    Returns:
        True if transition succeeded, False if:
        - Job not found
        - Status doesn't match from_status (concurrent modification)
        - Version doesn't match expected_version (optimistic lock failure)

    Raises:
        InvalidTransitionError: If transition from from_status to to_status is not allowed
    """
    # Validate the transition before attempting
    validate_transition(from_status, to_status, job_id)

    now_utc = datetime.now(timezone.utc)

    # Build the WHERE clause conditions
    conditions = [
        job_model.id == job_id,
        job_model.status == from_status,
    ]

    # Add version check if provided (optimistic locking)
    if expected_version is not None and hasattr(job_model, 'version'):
        conditions.append(job_model.version == expected_version)

    # Build the update values
    values = {
        "status": to_status,
        "updated_at": now_utc,
    }

    # Add version increment if model has version field
    if hasattr(job_model, 'version'):
        if expected_version is not None:
            values["version"] = expected_version + 1
        # If no expected_version provided, we could use a SQL expression
        # but for safety we just don't increment

    # Add any additional field updates
    if additional_updates:
        values.update(additional_updates)

    # Execute atomic update
    stmt = update(job_model).where(*conditions).values(**values)

    result = db.execute(stmt)
    db.commit()

    rows_affected = result.rowcount

    if rows_affected == 0:
        logger.info(
            "Job state transition failed - concurrent modification or status mismatch",
            extra={
                "job_id": job_id,
                "from_status": from_status,
                "to_status": to_status,
                "expected_version": expected_version,
            },
        )
        return False

    logger.info(
        "Job state transitioned successfully",
        extra={
            "job_id": job_id,
            "from_status": from_status,
            "to_status": to_status,
        },
    )

    return True


def transition_job_status_sync(
    db: Session,
    job_model,
    job_id: str,
    from_status: str,
    to_status: str,
    expected_version: Optional[int] = None,
    additional_updates: Optional[dict] = None,
) -> bool:
    """
    Synchronous version of transition_job_status for non-async contexts.

    Uses optimistic locking via version field and validates state transitions.
    The transition is atomic: UPDATE with WHERE checks current status and version.

    Args:
        db: SQLAlchemy session
        job_model: The SQLAlchemy model class (e.g., ScheduledArticle)
        job_id: Job identifier
        from_status: Expected current status
        to_status: Target status
        expected_version: Optional version for optimistic locking
        additional_updates: Optional dict of additional field updates

    Returns:
        True if transition succeeded, False if concurrent modification detected

    Raises:
        InvalidTransitionError: If transition is not allowed
    """
    # Validate the transition before attempting
    validate_transition(from_status, to_status, job_id)

    now_utc = datetime.now(timezone.utc)

    # Build the WHERE clause conditions
    conditions = [
        job_model.id == job_id,
        job_model.status == from_status,
    ]

    # Add version check if provided (optimistic locking)
    if expected_version is not None and hasattr(job_model, 'version'):
        conditions.append(job_model.version == expected_version)

    # Build the update values
    values = {
        "status": to_status,
        "updated_at": now_utc,
    }

    # Add version increment if model has version field
    if hasattr(job_model, 'version'):
        if expected_version is not None:
            values["version"] = expected_version + 1

    # Add any additional field updates
    if additional_updates:
        values.update(additional_updates)

    # Execute atomic update
    stmt = update(job_model).where(*conditions).values(**values)

    result = db.execute(stmt)
    db.commit()

    rows_affected = result.rowcount

    if rows_affected == 0:
        logger.info(
            "Job state transition failed - concurrent modification or status mismatch",
            extra={
                "job_id": job_id,
                "from_status": from_status,
                "to_status": to_status,
                "expected_version": expected_version,
            },
        )
        return False

    logger.info(
        "Job state transitioned successfully",
        extra={
            "job_id": job_id,
            "from_status": from_status,
            "to_status": to_status,
        },
    )

    return True


# Convenience functions for common transitions

def can_start_processing(status: str) -> bool:
    """Check if job can be moved to processing state."""
    return is_valid_transition(status, JobStatus.PROCESSING.value)


def can_complete(status: str) -> bool:
    """Check if job can be moved to completed state."""
    return is_valid_transition(status, JobStatus.COMPLETED.value)


def can_fail(status: str) -> bool:
    """Check if job can be moved to failed state."""
    return is_valid_transition(status, JobStatus.FAILED.value)


def can_cancel(status: str) -> bool:
    """Check if job can be cancelled."""
    return is_valid_transition(status, JobStatus.CANCELLED.value)


def can_retry(status: str) -> bool:
    """Check if job can be moved to retrying state."""
    return is_valid_transition(status, JobStatus.RETRYING.value)


def is_terminal_state(status: str) -> bool:
    """Check if status is a terminal state (no further transitions possible)."""
    try:
        status_enum = JobStatus(status)
        return len(VALID_TRANSITIONS.get(status_enum, set())) == 0
    except ValueError:
        return False
