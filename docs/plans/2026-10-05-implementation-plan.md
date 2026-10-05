# Implementation Plan — Jira Traceability Manager

**Date:** 2026-10-05
**Spec:** `docs/design/2026-10-05-jira-traceability-manager-design.md` (approved)
**Convention:** Phase → Code → Verify. Every phase ends with a green gate before the next starts. Commits semanticos (`feat:`/`fix:`/`docs:`/`test:`/`chore:`), uno por responsabilidad, sin atribución IA, **sin push** (repos locales).

---

## Phase 1 — Scaffold del repo manager

**Tasks**

1. `package.json` con scripts: `trace:pull`, `trace:refresh`, `build`, `dev`, `test`, `types:check`, `lint`, `lint:fix`.
2. TypeScript estricto (`tsconfig.json`), ESLint (`@antfu/eslint-config` como el boilerplate), Prettier, `.gitignore` (`.env`, `node_modules`, `dist` NO se ignora — se commitea), `.env.example` (§10 del spec).
3. `vite.config.ts` + `vite-plugin-singlefile`.
4. `AGENTS.md` corto: comandos de pipeline, fail-safe, `trace.json`/`dist` se regeneran (no se editan a mano), credenciales solo desde `.env`.
5. `README.md` stub: setup + comandos.

**Verify:** `bun install` → `types:check` + `lint` en verde con un `main.ts` vacío; `bun run build` genera `dist/index.html`.

## Phase 2 — Pipeline de datos

**Tasks**

1. `trace.schema.json` — contrato `meta/nodes/edges` (schemaVersion 1, §5 del spec).
2. `scripts/lib/jira-client.ts` — fetch con `ATLASSIAN_EMAIL`/`ATLASSIAN_API_TOKEN` (Basic), paginación JQL de 50, retry/backoff en 429 (`Retry-After`), **fail-fast en 401/403 nombrando la variable faltante**, timeout.
3. Resolución de custom fields: `scripts/lib/field-map.ts` — descubre sprint/story points por nombre canónico contra `/rest/api/3/field`, cachea en `scripts/lib/field-map.json` (commiteado).
4. `scripts/fetch-jira.ts` — pull de issues (campos §4 del spec incl. `resolutiondate`), components, sprints; transforma a grafo (edges `hierarchy`, `link:<type>` con dirección, `component`, `sprint`); valida contra esquema; escritura atómica; **aborta si 0 issues o esquema inválido sin tocar el snapshot bueno**.
5. `scripts/fetch-xray.ts` — solo si `XRAY_CLIENT_ID`/`XRAY_CLIENT_SECRET` presentes; si no, warning + omisión.
6. Tests `bun test`: normalización de vínculos inward/outward, paginación, fail-safe de escritura, field-map.

**Verify:** `bun run trace:pull` contra BK produce `data/trace.json` válido con counts > 0; tests en verde; segunda corrida con auth malformada (simulada) NO modifica el archivo.

## Phase 3 — Shell de la app

**Tasks**

1. `src/model.ts` — tipos `Node`/`Edge`, selectores (issues por tipo/estado/épica, subárbol de épica), detección de alertas (huérfanos, épicas vacías, bugs sin story, bloqueos abiertos).
2. `src/main.ts` — shell: barra superior (proyecto, fecha, buscador `/`), 5 pestañas con contador de alertas, estado global de filtros + tab activa.
3. `src/components/detail-panel.ts` — panel derecho con campos y vínculos con dirección + link a Jira.
4. Datos embebidos: el build inyecta `data/trace.json` (plugin o `define`); la app lo lee de un único módulo.

**Verify:** `bun run trace:refresh` → `dist/index.html` abre con doble clic y muestra el shell con datos reales (tabs navegables, detalle funcional en cualquier nodo).

## Phase 4 — Vistas Árbol, Grafo, Matriz, Alertas

**Tasks**

1. `views/tree.ts` — jerarquía proyecto → épicas → stories → bugs/subtasks, colores de estado, alertas visuales, clic → detalle, doble clic → abrir en Jira.
2. `views/graph.ts` — Cytoscape (dependencia nueva): nodos coloreados por tipo, aristas estiladas por tipo/dirección, zoom/drag, filtros (tipo/estado/componente), búsqueda resaltando el nodo.
3. `views/matrix.ts` — issues × tipos de vínculo (matriz de conexiones con dirección).
4. `views/alerts.ts` — lista agrupada por tipo de alerta, clic → salta al detalle.

**Verify:** con snapshot real, las 4 pestañas renderizan > 0 nodos; filtros del grafo ocultan/muestran; cada alerta lista el issue correcto. Revisión visual del usuario (sin Playwright).

## Phase 5 — Pestaña Métricas

**Tasks**

1. `src/metrics.ts` — puros y testeables: KPIs, donut por estado, estado × épica, throughput semanal (`created` vs `resolutiondate`), points por épica, carga por assignee, vínculos por tipo, top centrales (grado), aging de bugs (buckets), tests Xray, filtrado por rango de fechas + subárbol de épica.
2. `views/metrics.ts` — fila de 6 KPIs + grid de 9 widgets **con títulos-pregunta** (§6.1 del spec) + barra de filtro global que recalcula todo.
3. Widget 9 se oculta si `meta` indica ausencia de Xray.
4. Tests de `metrics.ts`: buckets, throughput ISO-week, filtrado por épica/fechas.

**Verify:** tests en verde; dashboard muestra los 9 widgets con datos reales; aplicar filtro cambia KPIs y widgets; sin credenciales Xray el widget 9 no aparece.

## Phase 6 — Repositorio harness

**Tasks**

1. Copiar skills `acli`, `xray-cli`, `git-flow-master` desde el boilerplate (`.agents/skills/` → `.claude/skills/` del harness).
2. Vendorizar `caveman` de `github.com/JuliusBrussee/caveman` — **solo la skill**, conservar `LICENSE` (Apache-2.0) + atribución en el SKILL.md; nada de proxy/engine/mcp.
3. `opencode.jsonc` + `.mcp.json`: MCPs `engram` + `tavily` (con sintaxis de env de cada host).
4. `.env.example` (`ATLASSIAN_*` + `XRAY_*` opcional + `TAVILY_API_KEY`).
5. `AGENTS.md` del harness: reglas de credenciales/STOP en fallo MCP, git-flow, caveman por defecto.
6. `README.md`: qué es y cómo usarlo.

**Verify:** los 4 skills tienen `SKILL.md`; lint manual de frontmatter; `opencode.jsonc` y `.mcp.json` parsean como JSON válido.

## Phase 7 — Verificación final y cierre

**Tasks**

1. Orden de calidad en ambos repos: `bun test` → `types:check` → `lint`. Sin pasos saltados.
2. Prueba e2e del fail-safe: pull forzado a 0 issues → `trace.json` y `dist/` intactos.
3. `trace:refresh` completo de punta a punta con datos reales de BK.
4. Revisión visual del usuario del dashboard completo (5 pestañas) — la hace el usuario.
5. README final de cada repo + borrado de mockups `.superpowers/brainstorm/` del repo QA.
6. Commits finales ordenados; **sin push** (los repos son locales; push cuando el usuario lo pida).

**Verify:** los 3 checks en verde en ambos repos; usuario confirma la revisión visual; working trees limpios.

---

## Fuera de alcance (del spec §11, no se toca en este plan)

CI/Pages · escritura de artefactos Jira · comentarios (`--comments`) · multi-proyecto · open-sourcing.
