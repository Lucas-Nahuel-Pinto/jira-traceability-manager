import { describe, expect, test } from 'bun:test';
import { resolveFieldMap } from '../scripts/lib/field-map.ts';
import { createJiraClient, loadJiraEnv, MissingEnvError } from '../scripts/lib/jira-client.ts';

describe('loadJiraEnv', () => {
  test('throws naming every missing variable', () => {
    try {
      loadJiraEnv({});
      throw new Error('should have thrown');
    }
    catch (err) {
      expect(err).toBeInstanceOf(MissingEnvError);
      expect((err as Error).message).toContain('ATLASSIAN_URL');
      expect((err as Error).message).toContain('ATLASSIAN_API_TOKEN');
      expect((err as Error).message).toContain('JIRA_PROJECT_KEY');
    }
  });

  test('trims and normalizes base url', () => {
    const env = loadJiraEnv({
      ATLASSIAN_URL: 'https://acme.atlassian.net///',
      ATLASSIAN_EMAIL: ' me@x.com ',
      ATLASSIAN_API_TOKEN: 'token',
      JIRA_PROJECT_KEY: 'BK',
    });

    expect(env.baseUrl).toBe('https://acme.atlassian.net');
    expect(env.email).toBe('me@x.com');
  });
});

describe('resolveFieldMap', () => {
  const fields = [
    { id: 'assignee', name: 'Assignee', custom: false },
    { id: 'customfield_10020', name: 'Sprint', custom: true },
    { id: 'customfield_10016', name: 'Story Points', custom: true },
    { id: 'customfield_99999', name: 'Sprint Goal', custom: true },
  ];

  test('matches sprint and story points by canonical name only', () => {
    const map = resolveFieldMap(fields);
    expect(map.sprint).toBe('customfield_10020');
    expect(map.storyPoints).toBe('customfield_10016');
  });

  test('returns null when absent', () => {
    const map = resolveFieldMap([{ id: 'x', name: 'Custom', custom: true }]);
    expect(map.sprint).toBeNull();
    expect(map.storyPoints).toBeNull();
  });
});

describe('searchAll pagination', () => {
  test('merges pages following nextPageToken', async () => {
    const env = { baseUrl: 'https://acme.atlassian.net', email: 'e', token: 't', projectKey: 'BK' };
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      const page
        = url.includes('nextPageToken=2')
          ? { issues: [{ key: 'ACME-2' }] }
          : { issues: [{ key: 'ACME-1' }], nextPageToken: '2' };
      return new Response(JSON.stringify(page), { status: 200 });
    }) as typeof fetch;

    try {
      const client = createJiraClient(env);
      const issues = await client.searchAll<{ key: string }>('project = BK', ['summary']);
      expect(issues.map(i => i.key)).toEqual(['ACME-1', 'ACME-2']);
      expect(calls).toHaveLength(2);
      expect(calls[0]).toContain('pageSize=50');
    }
    finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('auth 401 fails fast naming env vars', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('nope', { status: 401 })) as unknown as typeof fetch;

    try {
      const client = createJiraClient({ baseUrl: 'https://x', email: 'e', token: 't', projectKey: 'BK' });
      const err = await client.get('/rest/api/3/field').then(
        () => null,
        (error: unknown) => error,
      );
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/ATLASSIAN_API_TOKEN/);
    }
    finally {
      globalThis.fetch = originalFetch;
    }
  });
});
