const MAX_RETRIES = 3;
const TIMEOUT_MS = 30_000;

export class MissingEnvError extends Error {
  constructor(vars: string[]) {
    super(
      `Missing required environment variable(s): ${vars.join(', ')}. `
      + 'Fill them in .env (see .env.example) and restart the session/shell.',
    );
    this.name = 'MissingEnvError';
  }
}

export class AuthError extends Error {
  constructor(status: number) {
    super(
      `Jira auth failed (HTTP ${status}). Check ATLASSIAN_URL, ATLASSIAN_EMAIL `
      + 'and ATLASSIAN_API_TOKEN in .env — fix .env, no workaround.',
    );
    this.name = 'AuthError';
  }
}

export interface JiraEnv {
  baseUrl: string
  email: string
  token: string
  projectKey: string
}

export function loadJiraEnv(env: NodeJS.ProcessEnv = process.env): JiraEnv {
  const required = ['ATLASSIAN_URL', 'ATLASSIAN_EMAIL', 'ATLASSIAN_API_TOKEN', 'JIRA_PROJECT_KEY'];
  const missing = required.filter(name => !env[name]?.trim());
  if (missing.length > 0) { throw new MissingEnvError(missing); }

  return {
    baseUrl: env.ATLASSIAN_URL!.trim().replace(/\/+$/, ''),
    email: env.ATLASSIAN_EMAIL!.trim(),
    token: env.ATLASSIAN_API_TOKEN!.trim(),
    projectKey: env.JIRA_PROJECT_KEY!.trim(),
  };
}

export interface JiraClient {
  get: <T>(path: string) => Promise<T>
  searchAll: <T>(jql: string, fields: string[], pageSize?: number) => Promise<T[]>
  jiraEnv: JiraEnv
}

function basicAuth(email: string, token: string): string {
  return `Basic ${btoa(`${email}:${token}`)}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function raiseForStatus(res: Response): Promise<void> {
  if (res.status === 401 || res.status === 403) { throw new AuthError(res.status); }
}

export function createJiraClient(env: JiraEnv = loadJiraEnv()): JiraClient {
  const auth = basicAuth(env.email, env.token);

  async function request(path: string): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${env.baseUrl}${path}`, {
          headers: { authorization: auth, accept: 'application/json' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      }
      catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        await sleep(1000 * 2 ** attempt);
        continue;
      }

      if (res.status === 401 || res.status === 403) { throw new AuthError(res.status); }

      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} from ${path}`);
        const retryAfter = Number(res.headers.get('retry-after'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
        await sleep(waitMs);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Jira request failed: ${path} -> HTTP ${res.status}\n${body.slice(0, 500)}`);
      }

      return res;
    }

    throw lastError ?? new Error(`Jira request failed after retries: ${path}`);
  }

  async function get<T>(path: string): Promise<T> {
    const res = await request(path);
    await raiseForStatus(res);
    return res.json() as Promise<T>;
  }

  async function searchAll<T>(jql: string, fields: string[], pageSize = 50): Promise<T[]> {
    const all: T[] = [];
    let nextPageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        jql,
        fields: fields.join(','),
        pageSize: String(pageSize),
      });
      if (nextPageToken) { params.set('nextPageToken', nextPageToken); }

      const res = await request(`/rest/api/3/search/jql?${params.toString()}`);
      const body = (await res.json()) as { issues?: T[], nextPageToken?: string };
      all.push(...(body.issues ?? []));
      nextPageToken = body.nextPageToken;
    } while (nextPageToken);

    return all;
  }

  return { get, searchAll, jiraEnv: env };
}
