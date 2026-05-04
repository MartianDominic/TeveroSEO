"""
Environment Variable Validator
Validates required secrets at startup, fails fast if missing.
NEVER logs actual secret values - only presence/absence.

Production vs Development:
- Production (APP_ENV=production): Fails fast on missing/invalid required vars
- Development (default): Warns but continues with fallbacks for local dev
"""
import os
import sys
import warnings
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum


def is_production() -> bool:
    """Check if running in production mode."""
    return os.environ.get("APP_ENV", "").lower() == "production"


class SecretType(Enum):
    API_KEY = "api_key"
    DATABASE = "database"
    ENCRYPTION = "encryption"
    AUTH = "auth"


@dataclass
class EnvVar:
    name: str
    secret_type: SecretType
    required: bool = True
    min_length: Optional[int] = None
    description: str = ""


# Required environment variables for AI-Writer
# Ordered by criticality: database -> auth -> encryption -> api keys
REQUIRED_VARS: List[EnvVar] = [
    # Database (critical - app cannot function without these)
    EnvVar(
        "DATABASE_URL",
        SecretType.DATABASE,
        required=True,
        min_length=10,
        description="PostgreSQL connection string"
    ),
    EnvVar(
        "REDIS_URL",
        SecretType.DATABASE,
        required=False,  # Falls back to localhost in dev
        description="Redis connection string for caching/queues"
    ),

    # Authentication (critical for multi-tenant security)
    EnvVar(
        "CLERK_SECRET_KEY",
        SecretType.AUTH,
        required=True,
        min_length=20,
        description="Clerk server-side authentication key"
    ),

    # Internal API key for service-to-service authentication
    # SECURITY: Must be at least 32 characters for cryptographic strength
    # Required in production to prevent auth bypass when both sides are None
    EnvVar(
        "INTERNAL_API_KEY",
        SecretType.AUTH,
        required=True,  # Required to prevent None == None auth bypass
        min_length=32,
        description="Internal API key for service-to-service authentication (min 32 chars)"
    ),

    # Encryption (critical for credential storage)
    EnvVar(
        "FERNET_KEY",
        SecretType.ENCRYPTION,
        required=True,
        min_length=32,
        description="Fernet symmetric encryption key for CMS credentials"
    ),

    # AI APIs (required for core functionality)
    EnvVar(
        "GEMINI_API_KEY",
        SecretType.API_KEY,
        required=True,
        min_length=20,
        description="Google Gemini API key for AI content generation"
    ),
    # ANTHROPIC_API_KEY - Required for Claude-based AI features
    # HIGH-AUTH-02 FIX: Added to required keys for startup validation
    EnvVar(
        "ANTHROPIC_API_KEY",
        SecretType.API_KEY,
        required=True,
        min_length=20,
        description="Anthropic API key for Claude-based content generation"
    ),

    # Asset security (required for secure URL signing)
    EnvVar(
        "ASSET_SIGNING_KEY",
        SecretType.ENCRYPTION,
        required=True,
        min_length=32,
        description="HMAC key for signing asset URLs (avatars, voice samples)"
    ),

    # Google OAuth (required for GSC/Analytics integration)
    EnvVar(
        "GOOGLE_CLIENT_ID",
        SecretType.AUTH,
        required=True,
        min_length=10,
        description="Google OAuth client ID for GSC/Analytics integration"
    ),
    EnvVar(
        "GOOGLE_CLIENT_SECRET",
        SecretType.AUTH,
        required=True,
        min_length=10,
        description="Google OAuth client secret for GSC/Analytics integration"
    ),

    # Cross-service integration (required for autonomous pipeline)
    # CRIT-19-01 FIX: Standardized to OPEN_SEO_API_URL (matches codebase usage)
    EnvVar(
        "OPEN_SEO_API_URL",
        SecretType.API_KEY,
        required=True,
        min_length=10,
        description="Open SEO API URL for SEO audits, keyword intelligence, internal linking"
    ),

    # Optional integrations
    EnvVar(
        "WIX_API_KEY",
        SecretType.API_KEY,
        required=False,
        description="Wix CMS publishing integration"
    ),
    EnvVar(
        "TAVILY_API_KEY",
        SecretType.API_KEY,
        required=False,
        description="Tavily search API for research"
    ),
    EnvVar(
        "SERPER_API_KEY",
        SecretType.API_KEY,
        required=False,
        description="Serper Google search API"
    ),
    EnvVar(
        "EXA_API_KEY",
        SecretType.API_KEY,
        required=False,
        description="Exa neural search API"
    ),
]


def validate_env() -> Dict[str, bool]:
    """
    Validate all required environment variables at startup.

    Behavior varies by environment:
    - Production (APP_ENV=production): Fails fast on missing/invalid required vars
    - Development (default): Warns but continues, allowing local dev with fallbacks

    Returns:
        Dict mapping var_name -> is_configured (True if valid, False if missing/invalid)

    Raises:
        SystemExit: In production, if any required variables are missing or invalid.

    Security:
        - NEVER logs actual secret values
        - Only reports presence/absence and length validation
    """
    results: Dict[str, bool] = {}
    missing: List[str] = []
    invalid: List[str] = []
    production = is_production()

    for var in REQUIRED_VARS:
        value = os.environ.get(var.name)

        if value is None or value.strip() == "":
            results[var.name] = False
            if var.required:
                missing.append(f"{var.name} ({var.description})")
        elif var.min_length and len(value) < var.min_length:
            results[var.name] = False
            if var.required:
                invalid.append(
                    f"{var.name} (too short: expected >={var.min_length} chars, got {len(value)})"
                )
        else:
            results[var.name] = True

    if missing or invalid:
        if production:
            # Production: fail fast with clear error messages
            print("\n" + "=" * 70, file=sys.stderr)
            print("STARTUP FAILED: Environment validation errors", file=sys.stderr)
            print("=" * 70, file=sys.stderr)

            if missing:
                print(f"\nMissing required variables:", file=sys.stderr)
                for var in missing:
                    print(f"  - {var}", file=sys.stderr)

            if invalid:
                print(f"\nInvalid variables:", file=sys.stderr)
                for var in invalid:
                    print(f"  - {var}", file=sys.stderr)

            print("\nSet these in your .env file or environment.", file=sys.stderr)
            print("See AI-Writer/.env.example for a template.", file=sys.stderr)
            print("=" * 70 + "\n", file=sys.stderr)
            sys.exit(1)
        else:
            # Development: warn but continue with fallbacks
            print("\n" + "=" * 70, file=sys.stderr)
            print("WARNING: Environment validation issues (development mode)", file=sys.stderr)
            print("=" * 70, file=sys.stderr)

            if missing:
                print(f"\nMissing required variables (using fallbacks):", file=sys.stderr)
                for var in missing:
                    print(f"  - {var}", file=sys.stderr)

            if invalid:
                print(f"\nInvalid variables (using fallbacks):", file=sys.stderr)
                for var in invalid:
                    print(f"  - {var}", file=sys.stderr)

            print("\nContinuing in development mode. Set APP_ENV=production to enforce.", file=sys.stderr)
            print("See AI-Writer/.env.example for a template.", file=sys.stderr)
            print("=" * 70 + "\n", file=sys.stderr)

            # Emit Python warnings for programmatic handling
            for var in missing + invalid:
                warnings.warn(
                    f"Environment variable issue: {var}",
                    RuntimeWarning,
                    stacklevel=2
                )

    return results


def log_env_status() -> None:
    """
    Log which environment variables are configured.

    Security:
        - NEVER logs actual values
        - Only shows configured/missing status
        - Safe for production logs
    """
    print("\n--- Environment Configuration ---")

    # Group by secret type for cleaner output
    by_type: Dict[SecretType, List[EnvVar]] = {}
    for var in REQUIRED_VARS:
        by_type.setdefault(var.secret_type, []).append(var)

    type_labels = {
        SecretType.DATABASE: "Database",
        SecretType.AUTH: "Authentication",
        SecretType.ENCRYPTION: "Encryption",
        SecretType.API_KEY: "API Keys",
    }

    for secret_type in SecretType:
        if secret_type not in by_type:
            continue

        print(f"\n  [{type_labels[secret_type]}]")
        for var in by_type[secret_type]:
            value = os.environ.get(var.name)
            if value and value.strip():
                status = "configured"
            else:
                status = "missing"

            req_label = "" if var.required else " (optional)"
            print(f"    {var.name}: {status}{req_label}")

    print("\n---------------------------------\n")


def get_env_var(name: str, default: Optional[str] = None, required: bool = False) -> Optional[str]:
    """
    Safely retrieve an environment variable.

    Args:
        name: Environment variable name
        default: Default value if not set
        required: If True, raises ValueError when missing

    Returns:
        The environment variable value or default

    Raises:
        ValueError: If required=True and variable is not set
    """
    value = os.environ.get(name, default)

    if required and (value is None or value.strip() == ""):
        raise ValueError(f"Required environment variable {name} is not set")

    return value


def is_configured(name: str) -> bool:
    """
    Check if an environment variable is configured (non-empty).

    Args:
        name: Environment variable name

    Returns:
        True if the variable is set and non-empty
    """
    value = os.environ.get(name)
    return value is not None and value.strip() != ""


# Run validation when module is imported directly (for testing)
if __name__ == "__main__":
    print("Running environment validation...")
    results = validate_env()
    log_env_status()
    print("All required environment variables are configured.")
