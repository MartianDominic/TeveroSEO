# Client Sync Mechanism

## Overview

TeveroSEO has two `clients` tables with different schemas:

| System | Table | Purpose | Database |
|--------|-------|---------|----------|
| AI-Writer | `clients` | Content generation, brand voice | `alwrity` |
| open-seo-main | `clients` | SEO audits, analytics, linking | `open_seo` |

**AI-Writer's `clients` table is the authoritative source.**

## Schema Comparison

### AI-Writer (SQLAlchemy) - Authoritative

```python
class Client(SharedBase):
    __tablename__ = "clients"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    website_url = Column(String(500), nullable=True)
    workspace_id = Column(String(255), nullable=True, index=True)
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)
```

### open-seo-main (Drizzle) - Extended for SEO

```typescript
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  // Additional SEO-specific fields...
  contactEmail: text("contact_email"),
  contactName: text("contact_name"),
  industry: text("industry"),
  status: text("status").notNull().default("onboarding"),
  gscRefreshToken: text("gsc_refresh_token"),
  gscSiteUrl: text("gsc_site_url"),
  // ... more SEO fields
});
```

## Sync Strategy

### Current Implementation

1. **Client Creation**: Happens in AI-Writer when a prospect converts
2. **ID Sharing**: Both tables use the same UUID for cross-system queries
3. **No Automatic Sync**: Applications must explicitly maintain consistency

### Recommended Webhook Approach

```
AI-Writer                          open-seo-main
    |                                    |
    |-- POST /api/webhooks/client ------>|
    |   { event: "client.created",       |
    |     client: { id, name, domain }}  |
    |                                    |
    |                                    |-- Insert/Update clients
    |                                    |
    |<-- 200 OK -------------------------|
```

## Implementation Plan

### Phase 1: Webhook Endpoint (open-seo-main)

Create `/api/webhooks/client` to receive sync events:

```typescript
// src/routes/api/webhooks/client.ts
export const POST = createAPIFileRoute('/api/webhooks/client')({
  handler: async (ctx) => {
    const { event, client } = await ctx.request.json();
    
    switch (event) {
      case 'client.created':
      case 'client.updated':
        await db.insert(clients).values({
          id: client.id,
          name: client.name,
          domain: client.domain || client.website_url,
          workspaceId: client.workspace_id,
        }).onConflictDoUpdate({
          target: clients.id,
          set: { name: client.name, domain: client.domain }
        });
        break;
        
      case 'client.archived':
        await db.update(clients)
          .set({ isDeleted: true, deletedAt: new Date() })
          .where(eq(clients.id, client.id));
        break;
    }
    
    return { success: true };
  }
});
```

### Phase 2: Webhook Sender (AI-Writer)

Add webhook dispatch to client service:

```python
# services/client_service.py
async def _dispatch_client_webhook(event: str, client: Client) -> None:
    webhook_url = settings.OPEN_SEO_WEBHOOK_URL
    if not webhook_url:
        return
    
    async with httpx.AsyncClient() as http:
        await http.post(
            f"{webhook_url}/api/webhooks/client",
            json={
                "event": event,
                "client": {
                    "id": str(client.id),
                    "name": client.name,
                    "domain": client.website_url,
                    "workspace_id": client.workspace_id,
                }
            },
            headers={"X-Webhook-Secret": settings.WEBHOOK_SECRET},
            timeout=5.0
        )
```

### Phase 3: Security

1. Validate `X-Webhook-Secret` header matches shared secret
2. Use HMAC signature for payload integrity
3. Implement idempotency via event ID

## Cross-System Queries

When querying across systems, use the shared `client_id` (UUID):

```python
# AI-Writer: Get client SEO data
response = await http.get(
    f"{OPEN_SEO_URL}/api/seo/clients/{client_id}/audit/latest",
    headers={"Authorization": f"Bearer {token}"}
)
```

```typescript
// open-seo-main: Verify client exists in AI-Writer
const aiWriterClient = await fetch(
  `${AI_WRITER_URL}/api/clients/${clientId}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
```

## Data Integrity

### What Syncs

- `id` (UUID) - primary key, must match
- `name` - client display name
- `domain` / `website_url` - canonical domain
- `workspace_id` - Clerk organization ID
- `is_archived` / `is_deleted` - soft delete status

### What Doesn't Sync

- SEO-specific fields (GSC credentials, audit history)
- Content-specific fields (brand voice, CMS settings)
- Each system maintains its own extended data

## Troubleshooting

### Orphaned Records

If a client exists in one system but not the other:

```sql
-- Find clients in open-seo-main but not AI-Writer
SELECT id, name FROM clients
WHERE id NOT IN (
  SELECT id FROM dblink(
    'dbname=alwrity',
    'SELECT id FROM clients'
  ) AS t(id uuid)
);
```

### Manual Sync

To manually sync a client from AI-Writer to open-seo-main:

```sql
-- In open_seo database
INSERT INTO clients (id, name, domain, workspace_id, created_at, updated_at)
SELECT id, name, website_url, workspace_id, created_at, updated_at
FROM dblink(
  'dbname=alwrity',
  'SELECT id, name, website_url, workspace_id, created_at, updated_at FROM clients WHERE id = ''<uuid>'''
) AS t(id uuid, name text, website_url text, workspace_id text, created_at timestamptz, updated_at timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  workspace_id = EXCLUDED.workspace_id,
  updated_at = EXCLUDED.updated_at;
```
