# Design Spec — Jira Traceability Manager

**Date:** 2026-10-05
**Status:** Approved (brainstorming session, 2026-10-05)
**Decision record:** Enfoque 2 (Vite + módulos → HTML autocontenido), dos repos, pipeline dentro del repo de la app.

---

## 1. Goal

Vista panorámica de todo el contenido de un proyecto Jira (épicas, stories, bugs, vínculos, components, sprints, artefactos Xray) sin entrar a la plataforma ni recorrer links a mano con JQL. Un dashboard autocontenido con 5 pestañas (árbol, grafo, matriz, alertas, métricas), operado por un agente con toolbox propia, en un repositorio separado del boilerplate QA.

## 2. Scope — v1

**In:**

- Repositorio `jira-traceability-manager` (app + pipeline) y `jira-traceability-harness` (toolbox del agente).
- Pull de Jira Cloud (issues, link types con dirección, components, sprints, anexos metadata) + Xray opcional.
- Snapshot `data/trace.json` validado contra `trace.schema.json`.
- Dashboard de 5 pestañas (árbol, grafo, matriz, alertas, métricas) con datos embebidos (single-file, doble clic abre); pestaña de métricas con KPIs, 9 widgets tipo pregunta y filtros globales.
- Skills del agente: `acli`, `xray-cli`, `git-flow-master`, `caveman` (vendorizada) + MCPs `engram` y `tavily`.
- Tests unitarios (`bun test`), `types:check`, `lint`.

**Out (anotado como extensibilidad):**

- GitHub Actions cron + GitHub Pages (fase local por ahora).
- Escritura/gestión de artefactos Jira desde la app (futuro: vía agente + `acli` + `trace:refresh` post-escritura).
- Comentarios de Jira en el pull (flag `--comments` futura; anexos metadata sí entran).
- Publicación/open-sourcing del viewer.
- Skills del proceso QA (shift-left, sprint-testing, test-documentation, test-automation, regression-testing, etc.) — no se copian.

## 3. Repositories

### 3.1 `jira-traceability-harness` — toolbox del agente

```
jira-traceability-harness/
├── AGENTS.md                  # reglas: acli, env, caveman, git-flow
├── .env.example               # ATLASSIAN_URL / ATLASSIAN_EMAIL / ATLASSIAN_API_TOKEN (+ XRAY_* opcional)
├── opencode.jsonc · .mcp.json # MCPs: engram + tavily
├── .claude/skills/
│   ├── acli/                  # copia del boilerplate
│   ├── xray-cli/              # copia del boilerplate
│   ├── git-flow-master/       # copia del boilerplate
│   └── caveman/               # vendorizado de github.com/JuliusBrussee/caveman (Apache-2.0, con LICENSE + atribución)
└── README.md
```

- Propósito: el agente abre este repo para consultar Jira ad-hoc (`acli`), operar git, y tiene memoria (engram) + búsqueda web (tavily).
- Sin subagentes `qa-*`, sin gates de KATA, sin pipeline de datos.

### 3.2 `jira-traceability-manager` — app + pipeline

```
jira-traceability-manager/
├── AGENTS.md · README.md
├── package.json               # trace:pull · trace:refresh · build · test · lint
├── vite.config.ts             # + vite-plugin-singlefile
├── tsconfig · eslint · prettier
├── .env.example               # ATLASSIAN_* + JIRA_PROJECT_KEY (pipeline)
│
├── trace.schema.json          # contrato nodes/edges/meta (versionado)
├── data/trace.json            # snapshot (commiteado)
├── dist/index.html            # dashboard autocontenido (commiteado)
│
├── scripts/
│   ├── fetch-jira.ts          # pull + transform + validate -> data/trace.json
│   ├── fetch-xray.ts          # opcional, solo con credenciales
│   └── lib/jira-client.ts     # HTTP, paginación, retry, auth fail-fast
│
└── src/
    ├── main.ts                # monta pestañas + estado global
    ├── model.ts               # tipos Node/Edge + selectores + detección de alertas
    ├── views/tree.ts          # pestaña Árbol
    ├── views/graph.ts         # pestaña Grafo (Cytoscape)
    ├── views/matrix.ts        # pestaña Matriz
    ├── views/alerts.ts        # pestaña Alertas
    ├── views/metrics.ts       # pestaña Métricas (render de widgets)
    ├── metrics.ts             # cálculos: KPIs, throughput, aging, filtros
    └── components/detail-panel.ts
```

**Naming rationale:** *harness* = banco de herramientas del agente; *manager* = la app, que hoy muestra y más adelante gestionará artefactos Jira.

**Decisión de arquitectura (pipeline en el repo de la app):** el refresco diario futuro (cron + Pages) necesita los secretos en el repo donde corre el workflow; mantener pipeline y app juntos elimina el push cruzado entre repos y la coordinación de contrato de esquema. El harness queda como toolbox reutilizable sin duplicar la cadena de automatización.

## 4. Data pipeline

```
Jira Cloud (REST v3)  --(1)pull-->  fetch-jira.ts  --(2)transform-->  graph model
                                        |                                |
                                        +--(3)validate trace.schema.json |
                                        |      inválido / 0 issues:      |
                                        |      NO se escribe nada (X)     |
                                        v                                v
                              data/trace.json  --(4)bun run build (Vite singlefile)-->  dist/index.html
```

1. **Pull** — JQL `project = {{JIRA_PROJECT_KEY}}`, paginación de 50 contra `/rest/api/3/search/jql`. Campos por issue: summary, issuetype, status (con `statusCategory`), parent, assignee, priority, labels, components, sprint, story points, created/updated, `resolutiondate`, fixVersions, attachments (metadata), `issuelinks` (tipo + dirección). Components → `/rest/api/3/project/{key}/components`. Sprints desde el campo sprint de los issues. Los custom fields que varían por instancia (sprint, story points) se resuelven por nombre canónico contra `/rest/api/3/field` en el primer pull y se cachean en `scripts/lib/field-map.json` (commiteado).
2. **Transform** — normaliza a grafo: `nodes[]` (issues, components, sprints, artefactos Xray) y `edges[]` con `kind` discriminatorio (ver §5). Jerarquía épica→story→subtask derivada de `parent`.
3. **Validate** — `trace.schema.json` valida el grafo completo antes de escribir. Escritura atómica (tmp → rename).
4. **Build** — Vite + `vite-plugin-singlefile` incrusta el JSON en `dist/index.html`.

**Fail-safe:** 0 issues, esquema inválido o error de red → aborta sin sobreescribir el `trace.json`/`dist` buenos.

**Comandos:**

| Comando | Efecto |
|---|---|
| `bun run trace:pull` | fetch + transform + validate → `data/trace.json` |
| `bun run build` | `data/trace.json` → `dist/index.html` |
| `bun run trace:refresh` | pull + build (atómico) |

## 5. Data contract — `trace.schema.json`

```jsonc
{
  "meta": { "schemaVersion": 1, "projectKey": "BK", "generatedAt": "ISO8601",
            "counts": { "nodes": 0, "edges": 0 } },
  "nodes": [
    { "key": "BK-101", "kind": "issue", "issueType": "Story",
      "summary": "...", "status": "...", "statusCategory": "indeterminate",
      "assignee": "...", "priority": "...", "labels": [], "components": [],
      "sprint": "...", "points": 3, "url": "https://..." }
    // kind: issue | component | sprint | xray
  ],
  "edges": [
    { "from": "BK-10", "to": "BK-101", "kind": "hierarchy" }
    // kind: hierarchy | link:<linkTypeName> | sprint | component | xray-test
    // dirección preservada: from -> to es outward de `from`
  ]
}
```

- El esquema es la fuente de verdad del contrato entre pipeline y vistas; cualquier cambio incrementa `schemaVersion`.
- Dirección de vínculos siempre preservada (bloquea ≠ bloqueado por).

## 6. Dashboard — layout y pestañas

Layout aprobado (wireframe `dashboard-layout.html`): barra superior (proyecto, fecha de generación, buscador global con `/`), fila de 5 pestañas con contador de alertas, columna izquierda de filtros (tipo, estado, componente), área central, columna derecha de detalle.

| Pestaña | Contenido |
|---|---|
| **Árbol** | Jerarquía proyecto → épicas → stories → bugs/subtasks; colores por estado; nodo con alerta visual; clic → detalle, doble clic → abrir en Jira. |
| **Grafo** | Cytoscape force-directed: nodos por tipo, aristas por tipo/dirección de vínculo, filtros, búsqueda, zoom/drag. |
| **Matriz** | Issues × tipos de vínculo (quién bloquea a quién, densidad de conexiones). |
| **Alertas** | Huérfanos (story sin épica), épicas vacías, bugs sin story, bloqueos abiertos; contador en la pestaña. |
| **Métricas** | KPIs + widgets de gráficos calculados 100% en el navegador desde el snapshot (sin backend). |

**Panel de detalle:** resumen, campos clave, lista de vínculos con dirección (`⊣ bloquea`, `⊣ bloqueado por`, `↔ relacionado`), link "Abrir en Jira".

### 6.1 Pestaña Métricas

Fila de KPIs: issues totales · abiertos/cerrados · bugs abiertos (con contador >30d) · story points · vínculos · alertas.

**Convención de títulos: cada widget es una pregunta** — las métricas existen para responderlas:

| # | Widget (título-pregunta) | Gráfico | Responde con |
|---|---|---|---|
| 1 | ¿En qué estado está el trabajo? | Donut por `status` | distribución de issues |
| 2 | ¿Cómo va cada épica? | Barras apiladas por estado × épica | progreso por épica |
| 3 | ¿Cuánto creamos y cuánto cerramos por semana? | Línea (creados vs cerrados, últimas 6 semanas) | throughput — usa `created` y `resolutiondate` |
| 4 | ¿Dónde se concentran los story points? | Barras por épica | reparto de esfuerzo |
| 5 | ¿Quién tiene más carga? | Barras horizontales top 8 | workload por assignee |
| 6 | ¿Qué tipos de vínculos predominan? | Barras por `link type` | composición del grafo |
| 7 | ¿Cuáles son los issues más centrales? | Ranking por grado (nº de vínculos) | nodos de mayor acoplamiento |
| 8 | ¿Cuánto tiempo llevan abiertos los bugs? | Barras con buckets <7d / 7–30d / >30d | aging desde `created` |
| 9 | ¿Cómo van los tests? | Barras por estado de ejecución Xray | **solo si hay credenciales Xray**, si no se oculta |

**Filtro global de la pestaña** (extra ⑩): rango de fechas (`created`/`resolutiondate`) + selector de épica (subárbol completo). Recalcula KPIs y todos los widgets en el cliente. Con Xray ausente, el widget 9 no se renderiza (misma degradación que el resto del pipeline).

## 7. Agent layer (harness)

- **Skills:** `acli`, `xray-cli`, `git-flow-master` copiados del boilerplate; `caveman` vendorizado de `https://github.com/JuliusBrussee/caveman` (Apache-2.0 — conservar LICENSE y atribución; solo la skill, no proxy/engine/mcp).
- **MCPs:** `engram` (memoria persistente) y `tavily` (búsqueda web) en `opencode.jsonc` y `.mcp.json`.
- **`AGENTS.md` del harness:** credenciales siempre desde `.env`; fallo MCP/auth = STOP nombrando la variable; git-flow para commits/PRs; caveman por defecto en salida conversacional.
- **`AGENTS.md` del manager:** comandos de pipeline, fail-safe, convención de que `trace.json`/`dist` se regeneran, no se editan a mano.

## 8. Error handling

| Fallo | Respuesta |
|---|---|
| Auth 401/403 | Aborta nombrando la variable de entorno faltante; sin workarounds. |
| 429 rate limit | Retry con backoff respetando `Retry-After`; si persiste, aborta sin tocar datos. |
| 0 issues / JQL vacío | Nunca sobreescribe snapshot bueno. |
| Esquema inválido | Error con la ruta del campo (`nodes[12].kind`); nada se escribe. |
| Xray sin credenciales | Warning + omisión; el resto se genera igual. |
| Red caída / timeout | Mensaje claro; el `dist` anterior sigue abriéndose. |
| `trace.json` corrupto en build | Exit 1; jamás dashboard vacío. |

## 9. Testing & verification (orden: tests → types → lint)

1. `bun test` — unitarios de `model.ts` (selectores, detección de huérfanos/épicas vacías), `metrics.ts` (cálculos de KPIs/widgets: buckets de aging, throughput por semana, filtrado por épica/fechas) y `jira-client` (paginación, normalización de vínculos inward/outward).
2. Validación de esquema en cada `trace:pull`.
3. `types:check` + `lint` en el manager.
4. Prueba de fail-safe: pull vacío → `trace.json` inalterado.
5. Revisión visual del dashboard: la hace el usuario (sin Playwright).

## 10. Environment variables (`.env.example`, ambas configs)

| Variable | Repo | Obligatoria |
|---|---|---|
| `ATLASSIAN_URL` | harness + manager | sí |
| `ATLASSIAN_EMAIL` | harness + manager | sí |
| `ATLASSIAN_API_TOKEN` | harness + manager | sí |
| `JIRA_PROJECT_KEY` | manager | sí |
| `XRAY_CLIENT_ID` / `XRAY_CLIENT_SECRET` / `XRAY_PROJECT_KEY` | manager | no (Xray opcional) |
| `TAVILY_API_KEY` | harness | sí (MCP tavily) |

`.env` jamás se commitea; `.env.example` siempre actualizado.

## 11. Future extensions (fuera de alcance v1)

1. **CI**: GitHub Actions cron diario → `trace:refresh` → deploy a GitHub Pages (secretos en el repo del manager).
2. **Gestión de artefactos**: transiciones/creación de vínculos vía agente + `acli` en el harness, seguida de `trace:refresh`.
3. **Comentarios** en el pull bajo flag `--comments`.
4. **Multi-proyecto**: `JIRA_PROJECT_KEY` como lista; selector de proyecto en la barra superior.
