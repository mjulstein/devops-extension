/**
 * Removes all cookies for dev.azure.com and reloads the active tab
 * so the user gets a fresh sign-in prompt. Intended as a debug
 * convenience when an Azure DevOps session gets stuck.
 */
export async function clearDevOpsCookies(): Promise<number> {
  const cookies = await chrome.cookies.getAll({ domain: 'dev.azure.com' });

  // Remove cookies sequentially to avoid overwhelming the cookie store
  for (const cookie of cookies) {
    const protocol = cookie.secure ? 'https' : 'http';
    const url = `${protocol}://dev.azure.com${cookie.path}`;
    await chrome.cookies.remove({ url, name: cookie.name });
  }

  // Verify all cookies are actually gone before reloading
  let remaining = await chrome.cookies.getAll({ domain: 'dev.azure.com' });
  let retries = 0;
  while (remaining.length > 0 && retries < 10) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    for (const cookie of remaining) {
      const protocol = cookie.secure ? 'https' : 'http';
      const url = `${protocol}://dev.azure.com${cookie.path}`;
      await chrome.cookies.remove({ url, name: cookie.name });
    }
    remaining = await chrome.cookies.getAll({ domain: 'dev.azure.com' });
    retries++;
  }

  // Reload the active tab so the user lands on a fresh login prompt
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await chrome.tabs.reload(tab.id);
  }

  return cookies.length;
}
