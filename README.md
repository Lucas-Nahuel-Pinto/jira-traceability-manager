# jira-traceability-manager

Panoramic Jira traceability dashboard: a snapshot pipeline plus a self-contained single-file app (5 tabs: Árbol, Grafo, Matriz, Alertas, Métricas) — no need to browse Jira link-by-link.

## Setup

```bash
bun install
cp .env.example .env   # fill ATLASSIAN_URL / ATLASSIAN_EMAIL / ATLASSIAN_API_TOKEN / JIRA_PROJECT_KEY
bun run trace:refresh  # pull from Jira + build dist/index.html
```

Open `dist/index.html` with double click — no server, no auth in the browser.

## Commands

| Command | Effect |
| --- | --- |
| `bun run trace:pull` | fetch + validate → `data/trace.json` |
| `bun run build` | embed data → `dist/index.html` |
| `bun run trace:refresh` | pull + build |
| `bun test` / `bun run types:check` / `bun run lint` | quality gates |

## Docs

- Design: `docs/design/2026-10-05-jira-traceability-manager-design.md`
- Plan: `docs/plans/2026-10-05-implementation-plan.md`
