import { request, expect } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'https://staging.example.com';
const authFile = 'playwright/.auth/editor.json';

type ApiContext = Awaited<ReturnType<typeof request.newContext>>;

async function apiContext(): Promise<ApiContext> {
  // Reuses the editor session saved by tests/auth.setup.ts.
  return request.newContext({ baseURL, storageState: authFile });
}

async function csrfToken(api: ApiContext): Promise<string> {
  const res = await api.get('/session/token');
  expect(res.ok()).toBeTruthy();
  return (await res.text()).trim();
}

export function uniqueTitle(prefix = 'Playwright test'): string {
  return `${prefix} ${Date.now()}`;
}

export async function createTestArticle(title: string) {
  const api = await apiContext();
  try {
    const res = await api.post('/jsonapi/node/article', {
      headers: {
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
        'X-CSRF-Token': await csrfToken(api),
      },
      data: {
        data: {
          type: 'node--article',
          attributes: {
            title,
            status: true,
            body: { value: 'Playwright test body', format: 'basic_html' },
          },
        },
      },
    });
    if (!res.ok()) {
      throw new Error(`Failed to create article: ${res.status()} ${await res.text()}`);
    }
    const json = await res.json();
    return {
      uuid: json.data.id as string,
      nid: json.data.attributes.drupal_internal__nid as number,
    };
  } finally {
    await api.dispose();
  }
}

export async function deleteTestArticle(uuid: string): Promise<void> {
  const api = await apiContext();
  try {
    const res = await api.delete(`/jsonapi/node/article/${uuid}`, {
      headers: { 'X-CSRF-Token': await csrfToken(api) },
    });
    expect(res.ok()).toBeTruthy();
  } finally {
    await api.dispose();
  }
}

// Used by UI-create tests, where only the /node/<nid> URL is known.
// Looks the node up by its internal id, then deletes it by UUID.
export async function deleteTestArticleByNid(nid: number): Promise<void> {
  const api = await apiContext();
  try {
    const lookup = await api.get(
      `/jsonapi/node/article?filter[drupal_internal__nid][value]=${nid}`,
    );
    expect(lookup.ok()).toBeTruthy();
    const json = await lookup.json();
    const uuid = json.data?.[0]?.id as string | undefined;
    if (!uuid) return;
    const res = await api.delete(`/jsonapi/node/article/${uuid}`, {
      headers: { 'X-CSRF-Token': await csrfToken(api) },
    });
    expect(res.ok()).toBeTruthy();
  } finally {
    await api.dispose();
  }
}
