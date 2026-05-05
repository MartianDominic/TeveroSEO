# Testing Patterns

**Analysis Date:** 2026-05-05

## Test Framework

### TypeScript (open-seo-main)

**Runner:**
- Vitest 4.x
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in (`expect`)

**Run Commands:**
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:ci           # CI mode (dot reporter)
npm run test:client       # Client-side tests (separate config)
```

### TypeScript (apps/web)

**Runner:**
- Vitest 4.x (unit tests)
- Playwright 1.52+ (E2E tests)

**Configs:**
- `vitest.config.ts` - Unit tests with jsdom environment
- `vitest.setup.ts` - Testing Library matchers
- `playwright.config.ts` - E2E configuration

**Run Commands:**
```bash
npm run test              # Vitest unit tests
npm run test:e2e          # Playwright E2E tests
npm run test:e2e:ui       # Playwright UI mode
```

### Python (AI-Writer)

**Runner:**
- pytest

**Run Commands:**
```bash
cd backend && pytest tests/ -v
cd backend && pytest tests/test_internal_link_inserter.py -v
```

## Test File Organization

**Location:**
- Co-located with source files
- Pattern: `{filename}.test.{ts,tsx}` or `{filename}.spec.ts`
- E2E tests in dedicated `e2e/` directories

**Naming:**
- open-seo-main: `*.test.ts` (e.g., `encryption.test.ts`, `prospect-schema.test.ts`)
- apps/web: `*.test.ts`, `*.test.tsx`, `*.spec.ts` for E2E
- AI-Writer: `test_*.py` or `*_test.py` (e.g., `test_voice_constraint_service.py`)

**Structure:**
```
open-seo-main/
├── src/
│   ├── db/
│   │   ├── prospect-schema.ts
│   │   └── prospect-schema.test.ts    # Co-located
│   ├── server/
│   │   ├── lib/
│   │   │   ├── encryption.ts
│   │   │   └── encryption.test.ts     # Co-located
│   │   └── workers/
│   │       ├── ranking-processor.ts
│   │       └── ranking-processor.test.ts

apps/web/
├── src/
│   ├── lib/
│   │   ├── sanitize.ts
│   │   └── sanitize.test.ts           # Co-located
│   ├── components/
│   │   └── connect/
│   │       ├── step-indicator.tsx
│   │       └── step-indicator.test.tsx # Co-located
│   └── hooks/
│       └── __tests__/
│           └── use-verification-poll.test.ts  # __tests__ folder
├── e2e/
│   ├── connect-wizard.spec.ts
│   └── developer-handoff.spec.ts

AI-Writer/
└── backend/
    └── tests/
        ├── test_voice_constraint_service.py
        └── test_internal_link_inserter.py
```

## Test Structure

**Suite Organization (TypeScript):**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("ConstraintFilter", () => {
  describe("Pipeline Orchestration", () => {
    it("should pass keyword through all 4 stages successfully", () => {
      // Arrange
      const constraints: FilterConstraints = { ... };
      const filter = new ConstraintFilter({ constraints });
      const input: ClassifiedKeywordInput = { ... };

      // Act
      const result = filter.filter(input);

      // Assert
      expect(result.passed).toBe(true);
      expect(result.keyword).toBe("plovykla įmonėms šiauliuose");
    });

    it("should exclude keyword at geo filter stage (early exit)", () => {
      // ...
    });
  });
});
```

**Suite Organization (Python):**
```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

class TestVoiceConstraintStatus:
    """Tests for VoiceConstraintStatus enum."""

    def test_status_values(self):
        """Verify all status values exist."""
        assert VoiceConstraintStatus.SUCCESS.value == "success"
        assert VoiceConstraintStatus.API_ERROR.value == "api_error"


class TestVoiceConstraintService:
    """Tests for VoiceConstraintService."""

    @pytest.fixture
    def service(self):
        return VoiceConstraintService(open_seo_url="http://localhost:3001")

    @pytest.mark.asyncio
    async def test_fetch_profile_not_found(self, service):
        """Test 404 returns NO_PROFILE status."""
        # ...
```

**Patterns:**
- Nested `describe` blocks for logical grouping
- Phase/feature references in docstrings: `Phase 57 Security Fix: XSS Prevention (P57-C1)`
- Test names describe behavior: "should remove inline script tags"

## Mocking

**Framework:**
- TypeScript: Vitest `vi.mock()`, `vi.fn()`, `vi.spyOn()`
- Python: `unittest.mock` (`AsyncMock`, `patch`, `MagicMock`)

**TypeScript Mocking Patterns:**

```typescript
// Mock entire module before imports
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/server/lib/dataforseo", () => ({
  fetchLiveSerpItemsRaw: vi.fn(),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Import modules AFTER mocks are set up
import { db } from "@/db";
import processRankingJob from "./ranking-processor";

// Environment mocking
vi.stubEnv("PAYMENT_ENCRYPTION_KEY", TEST_KEY);
```

**Python Mocking Patterns:**

```python
@pytest.mark.asyncio
async def test_fetch_profile_api_error(self, service):
    """Test non-404 HTTP error returns API_ERROR."""
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_client.get = AsyncMock(return_value=mock_response)

    with patch("services.voice_constraint_service.get_client", return_value=mock_client), \
         patch("services.voice_constraint_service.validate_url", return_value=True):
        result = await service.fetch_voice_constraints("client-123")

    assert result.status == VoiceConstraintStatus.API_ERROR
```

**What to Mock:**
- External APIs (DataForSEO, TypeScript backend from Python)
- Database connections
- Redis/cache
- Environment variables
- Loggers

**What NOT to Mock:**
- Business logic being tested
- Pure utility functions
- Type definitions/schemas

## Fixtures and Factories

**TypeScript Test Data:**
```typescript
const sampleHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Page - SEO Audit Example</title>
</head>
<body>
  <h1>Main Heading for Test Page</h1>
  <p>Content here...</p>
</body>
</html>
`;

const validCheckResult: CheckResult = {
  checkId: "T1-01",
  passed: true,
  severity: "critical",
  message: "Title tag is present",
  autoEditable: true,
  editRecipe: "add-title",
  tier: 1,
};
```

**Python Fixtures:**
```python
@pytest.fixture
def service():
    return VoiceConstraintService(open_seo_url="http://localhost:3001")

@pytest.fixture
def sample_html():
    """Simple HTML content for testing link insertion."""
    return "<p>Check out our services page for more information.</p>"

@pytest.fixture
def sample_soup(sample_html):
    """BeautifulSoup parsed from sample HTML."""
    return BeautifulSoup(sample_html, "html.parser")
```

**Location:**
- TypeScript: Inline in test files or in test file header
- Python: `@pytest.fixture` decorators within test classes or at module level

## Coverage

**Requirements:** Not explicitly enforced (target 80% per user rules)

**View Coverage:**
```bash
# open-seo-main
npx vitest run --coverage

# apps/web
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- Test individual functions, classes, schemas
- Co-located with source files
- Fast execution, no external dependencies
- Examples: `encryption.test.ts`, `sanitize.test.ts`, `types.test.ts`

**Integration Tests:**
- Test multiple modules working together
- May use real database connections in some cases
- Examples: `facade.integration.test.ts`

**E2E Tests (Playwright):**
- Test critical user flows through the browser
- Located in `e2e/` directories
- Multi-browser support (Chromium, Firefox, WebKit, Mobile Chrome)

```typescript
test.describe("Command Center Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/command-center");
    await page.waitForLoadState("networkidle");
  });

  test("Dashboard loads within 1.5 seconds", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/command-center");
    await page.waitForLoadState("domcontentloaded");
    await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 1500 });
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(1500);
  });
});
```

## Common Patterns

**Async Testing (TypeScript):**
```typescript
it("should decrypt versioned ciphertext", () => {
  const plaintext = "versioned-secret";
  const encrypted = encryptCredential(plaintext);
  expect(encrypted.startsWith("v")).toBe(true);
  expect(decryptCredential(encrypted)).toBe(plaintext);
});
```

**Async Testing (Python):**
```python
@pytest.mark.asyncio
async def test_fetch_voice_constraints_for_client(self):
    """Test the convenience function delegates to service."""
    with patch("services.voice_constraint_service.get_voice_constraint_service") as mock_get:
        mock_service = MagicMock()
        mock_service.fetch_voice_constraints = AsyncMock(
            return_value=VoiceConstraintResult(
                status=VoiceConstraintStatus.SUCCESS,
                constraints="## Test",
            )
        )
        mock_get.return_value = mock_service

        result = await fetch_voice_constraints_for_client(client_id="client-123")

        assert result.is_success
```

**Error Testing:**
```typescript
it("should throw on invalid ciphertext (too short)", () => {
  expect(() => decryptCredential("abc")).toThrow("too short");
});

it("should throw on tampered ciphertext", () => {
  const plaintext = "secret";
  const encrypted = encryptCredential(plaintext);
  const tampered = /* tamper with encrypted */;
  expect(() => decryptCredential(tampered)).toThrow("Decryption failed");
});
```

**Component Testing (React):**
```typescript
import { render, screen } from "@testing-library/react";

describe("ConnectionStepIndicator", () => {
  it("renders all steps", () => {
    render(<ConnectionStepIndicator currentStep="url" />);

    expect(screen.getByLabelText(/url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/detect/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/choose/i)).toBeInTheDocument();
  });

  it("highlights current step", () => {
    render(<ConnectionStepIndicator currentStep="choice" />);

    const choiceStep = screen.getByLabelText(/choose/i);
    expect(choiceStep).toHaveAttribute("data-current", "true");
  });
});
```

**Schema Validation Testing:**
```typescript
describe("createConnectionSchema", () => {
  const validInput = {
    clientId: "client-123",
    platform: "wordpress" as const,
    siteUrl: "https://example.com",
    credentials: { username: "admin", appPassword: "secret" },
  };

  it("accepts valid input", () => {
    const result = createConnectionSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects missing clientId", () => {
    const { clientId, ...rest } = validInput;
    const result = createConnectionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
```

**E2E Error Handling:**
```typescript
test.describe("Error Handling", () => {
  test("handles API errors gracefully", async ({ page }) => {
    await page.route("**/api/command-center/**", (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Internal server error" }),
      })
    );

    await page.goto("/command-center");
    await expect(page).not.toHaveURL(/error/);
  });

  test("shows loading state while fetching data", async ({ page }) => {
    await page.route("**/api/command-center/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      route.continue();
    });

    await page.goto("/command-center");
    const skeleton = page.locator('[class*="skeleton"], [class*="loading"]');
    expect((await skeleton.count()) > 0 || ...).toBeTruthy();
  });
});
```

## Playwright Configuration

**Config Location:** `apps/web/playwright.config.ts`

**Key Settings:**
```typescript
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
  ],

  webServer: process.env.CI ? undefined : {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

## Security Testing

**XSS Prevention Tests (apps/web):**
```typescript
describe("sanitizeHtml - XSS Prevention", () => {
  describe("Script tag removal", () => {
    it("should remove inline script tags", () => {
      const malicious = '<script>alert("xss")</script>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain("<script");
      expect(result).not.toContain("alert");
    });
  });

  describe("Event handler removal", () => {
    it("should remove onerror handlers from img tags", () => {
      const malicious = '<img src="x" onerror="alert(1)">';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain("onerror");
    });
  });

  describe("JavaScript URL removal", () => {
    it("should remove javascript: URLs in href", () => {
      const malicious = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain("javascript:");
    });
  });
});
```

**Python Security Tests:**
```python
class TestXSSPrevention:
    """Tests for XSS attack prevention in URL handling."""

    def test_xss_javascript_url_rejected(self, inserter):
        """javascript: URLs should be rejected to prevent XSS."""
        html = "<p>Click here to learn more about our services.</p>"
        soup = BeautifulSoup(html, "html.parser")
        result = inserter._insert_link(soup, "Click here", "javascript:alert(1)")
        assert result is False, "javascript: URLs must be rejected"
```

---

*Testing analysis: 2026-05-05*
