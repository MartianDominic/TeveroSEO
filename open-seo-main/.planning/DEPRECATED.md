# DEPRECATED

**This `.planning/` directory is deprecated.**

All planning documents have been consolidated to the root TeveroSEO `.planning/` directory:

```
/home/dominic/Documents/TeveroSEO/.planning/
├── ROADMAP.md          # Master roadmap (Phases 1-40)
├── STATE.md            # Current execution state
├── PROJECT.md          # Project overview
├── config.json         # GSD configuration
└── phases/             # Individual phase plans
    ├── 32-107-seo-checks/
    ├── 35-internal-linking/
    ├── 36-content-brief/
    ├── 37-brand-voice/
    ├── 39-ai-writer-integration/
    ├── 40-gap-closure-v5/   # Current work
    └── ...
```

## Why Deprecated

1. The TeveroSEO monorepo is the unified platform — planning should be at that level
2. This sub-directory had stale STATE.md (stuck on v1.0, April 23) while root has current state (v5.0, April 24)
3. Phase 40 (gap closure) only exists at root
4. Duplicate ROADMAP.md files caused AI confusion about project scope

## What to Do

- For current work: Use `/home/dominic/Documents/TeveroSEO/.planning/`
- For historical reference: Files here remain readable but should not be updated
- Do NOT add new phases or plans to this directory

## Migration Date

2026-04-25
