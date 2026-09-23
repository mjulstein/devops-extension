// What the panel can see of the active tab.
//
// Two features key off "is this an Azure DevOps page" — starring the page, and
// whether the shortcut draws the palette over it — and when the answer is
// unexpectedly no there is nothing on screen saying why. The address the panel
// actually read is the fact that settles it, so it is worth showing.

import { isAzureDevOpsUrl } from './tabMessaging/isAzureDevOpsUrl';

export interface ActiveTabReading {
  url: string | null;
  isAzureDevOps: boolean;
}

export function describeActiveTab(reading: ActiveTabReading): string {
  if (reading.url === null) {
    return 'The active tab’s address cannot be read. A browser page (settings, extensions, the new tab page) never reports one.';
  }

  const origin = safeOrigin(reading.url);
  return reading.isAzureDevOps
    ? `Active tab is ${origin}, recognised as Azure DevOps.`
    : `Active tab is ${origin}, which is not recognised as Azure DevOps — only dev.azure.com and *.visualstudio.com are.`;
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

export async function readActiveTab(): Promise<ActiveTabReading> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return {
    url: tab?.url ?? null,
    isAzureDevOps: isAzureDevOpsUrl(tab?.url)
  };
}
