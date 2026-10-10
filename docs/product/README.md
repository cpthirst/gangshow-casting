# Product docs

One folder per feature, created by the planning skills (`write-prd` → `story-map` → `write-story`):

```
docs/product/<feature>/
├── prd.md          # problem, goals, FR1..n
├── story-map.md    # epics → stories, FR coverage
└── stories/
    └── E1-S1-<slug>.md   # user story + Given/When/Then ACs
```

`pnpm lint:docs` validates every story's structure. Tests are named after behaviour, and
`test-auditor` checks that every AC is covered when a story is reviewed (ADR 0007).
