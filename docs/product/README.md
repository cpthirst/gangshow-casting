# Product docs

One folder per feature, created by the planning skills (`write-prd` → `story-map` → `write-story`):

```
docs/product/<feature>/
├── prd.md          # problem, goals, FR1..n
├── story-map.md    # epics → stories, FR coverage
└── stories/
    └── E1-S1-<slug>.md   # user story + Given/When/Then ACs
```

A large feature can be a section of several features, one folder each
(`docs/product/casting/items/`). A nested feature is named after its path, so its stories
are `casting-items.E1.S1`.

Tests are named after behaviour, and `test-auditor` checks that every AC is covered when a
story is reviewed (ADR 0007). Documentation stories need no tests and skip review (CLAUDE.md).
