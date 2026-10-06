# AGENTS.md — Jira Traceability Manager

> Repo del dashboard de trazabilidad de Jira: pipeline de datos + app single-file. NO es el boilerplate QA y NO contiene skills de proceso QA. La consola PM del agente (skills pm-status-report / pm-sprint-health / pm-alerts-to-jira, CLI `scripts/pm.ts`, acli, xray-cli, git-flow-master, caveman, MCPs) vive en el repo hermano `agentic-pm-harness`.

## Commands

| Command | Effect |
| --- | --- |
| `bun run trace:pull` | Jira → transform → validate → `data/trace.json` |
| `bun run build` | `data/trace.json` → `dist/index.html` (autocontenido) |
| `bun run trace:refresh` | pull + build (atómico) |
| `bun run dev` | Vite dev server (desarrollo) |
| `bun test` | unit tests (metrics, model, jira-client) |
| `bun run types:check` · `bun run lint` · `bun run format:check` | quality gates, en ese orden después de tests |

## Rules

1. **Credentials**: always from `.env` (see `.env.example`). NEVER hardcode. Auth failure → STOP, name the missing env var, no workarounds.
2. **Generated files are never hand-edited**: `data/trace.json`, `dist/index.html`, `scripts/lib/field-map.json` — regenerate with `trace:refresh`.
3. **Fail-safe**: a pull with 0 issues or an invalid schema must NEVER overwrite a good `data/trace.json`. Preserve existing snapshots on any error.
4. **Quality order**: `bun test` → `types:check` → `lint`. No skipping.
5. **Commits**: semantic prefixes (`feat:`/`fix:`/`docs:`/`test:`/`chore:`), one responsibility each, no AI attribution. **No push to remote without explicit user confirmation.**
6. **Design canon**: `docs/design/2026-10-05-jira-traceability-manager-design.md` — dashboard tabs, widget question-titles, data contract (`trace.schema.json`, version it on breaking change).
