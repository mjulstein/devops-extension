import { parsePatRecord, PAT_RECORD_KEY } from './patLifecycle';

export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const stored = await chrome.storage.local.get(PAT_RECORD_KEY);
  const pat = parsePatRecord(stored[PAT_RECORD_KEY]);

  if (pat?.token) {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Basic ${btoa(':' + pat.token)}`);
    const response = await fetch(url, { ...init, credentials: 'omit', headers });
    if (response.status !== 401) {
      return response;
    }
    // PAT rejected — fall through to cookie auth
  }

  return fetch(url, { ...init, credentials: 'include' });
}
