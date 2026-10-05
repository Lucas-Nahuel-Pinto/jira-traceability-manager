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

## The five tabs

| Tab | What it answers |
| --- | --- |
| Árbol | Jerarquía épica → story → bug con estado, alertas inline, clic = detalle, doble clic = abrir en Jira |
| Grafo | Grafo force-directed (Cytoscape) de issues y vínculos, con filtros y búsqueda |
| Matriz | Issues × tipos de vínculo con dirección, más el bloque de "quién bloquea a quién" |
| Alertas | Stories sin épica, épicas vacías, bugs sin story, bloqueos abiertos |
| Métricas | 6 KPIs + widgets-pregunta (estado, épicas, throughput, puntos, carga, vínculos, centrales, aging de bugs) con filtro por fechas y subárbol de épica |

## Fail-safe

A pull never overwrites a good snapshot: HTTP/auth errors abort by name, a 0-issue result aborts (Jira can return an empty page instead of 401 for bad tokens), and schema validation runs before the atomic write. `data/trace.json` and `dist/index.html` are generated artifacts — never hand-edit them.

## Xray (optional)

Without `XRAY_CLIENT_ID` / `XRAY_CLIENT_SECRET` the pipeline warns and sets `hasXray: false`; the metrics tab hides the Xray widget and everything else still builds.

## Docs

- Design: `docs/design/2026-10-05-jira-traceability-manager-design.md`
- Plan: `docs/plans/2026-10-05-implementation-plan.md`
