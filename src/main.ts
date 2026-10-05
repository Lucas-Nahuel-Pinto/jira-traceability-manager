const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <div style="font-family: monospace; padding: 2rem;">
      <h1>Jira Traceability Manager</h1>
      <p>Shell Fase 1 — sin datos todavía. Ejecuta <code>bun run trace:refresh</code>.</p>
    </div>
  `;
}
