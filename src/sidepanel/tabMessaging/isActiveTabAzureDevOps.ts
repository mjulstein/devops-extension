import { isAzureDevOpsUrl } from './isAzureDevOpsUrl';

export async function isActiveTabAzureDevOps(): Promise<boolean> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return isAzureDevOpsUrl(tab?.url);
}
