/**
 * Removes all cookies for dev.azure.com and reloads the active tab
 * so the user gets a fresh sign-in prompt. Intended as a debug
 * convenience when an Azure DevOps session gets stuck.
 */
export async function clearDevOpsCookies(): Promise<number> {
  const cookies = await chrome.cookies.getAll({ domain: 'dev.azure.com' });

  await Promise.all(
    cookies.map((cookie) => {
      const protocol = cookie.secure ? 'https' : 'http';
      const url = `${protocol}://dev.azure.com${cookie.path}`;
      return chrome.cookies.remove({ url, name: cookie.name });
    })
  );

  // Reload the active tab so the user lands on a fresh login prompt
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await chrome.tabs.reload(tab.id);
  }

  return cookies.length;
}
