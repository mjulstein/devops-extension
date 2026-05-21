// All domains involved in Azure DevOps SSO authentication
const SSO_DOMAINS = [
  'dev.azure.com',
  'login.microsoftonline.com',
  'app.vssps.visualstudio.com',
];

async function removeCookiesForDomain(domain: string): Promise<number> {
  const cookies = await chrome.cookies.getAll({ domain });
  for (const cookie of cookies) {
    const protocol = cookie.secure ? 'https' : 'http';
    // Cookie domain may have a leading dot (e.g. ".microsoftonline.com") — strip it for the URL
    const cookieDomain = cookie.domain.startsWith('.')
      ? cookie.domain.slice(1)
      : cookie.domain;
    await chrome.cookies.remove({
      url: `${protocol}://${cookieDomain}${cookie.path}`,
      name: cookie.name,
    });
  }
  return cookies.length;
}

export async function clearDevOpsCookies(): Promise<number> {
  let total = 0;
  for (const domain of SSO_DOMAINS) {
    total += await removeCookiesForDomain(domain);
  }

  // Navigate an existing Azure DevOps tab, or redirect the active tab there,
  // so the user always lands on a fresh SSO prompt regardless of which domain
  // they were on when they triggered the clear.
  const [devOpsTab] = await chrome.tabs.query({ url: 'https://dev.azure.com/*' });
  if (devOpsTab?.id != null) {
    await chrome.tabs.reload(devOpsTab.id);
  } else {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab?.id != null) {
      await chrome.tabs.update(activeTab.id, { url: 'https://dev.azure.com/' });
    }
  }

  return total;
}
