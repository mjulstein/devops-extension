import { isActiveTabAzureDevOps } from './isActiveTabAzureDevOps';
import { sendMessageToActiveTab } from './sendMessageToActiveTab';

export async function refreshTabIcons(): Promise<void> {
  const isDevOps = await isActiveTabAzureDevOps();
  if (!isDevOps) {
    throw new Error(
      'Active tab is not an Azure DevOps page. Switch to a dev.azure.com tab and try again.'
    );
  }
  await sendMessageToActiveTab({ type: 'REFRESH_TAB_ICONS' });
}
