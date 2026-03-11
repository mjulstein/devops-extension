import { isObject } from './typeGuards';

export interface WorkItemDetails {
  workItemType: string;
  title: string;
  parentId: number | null;
  areaPath: string;
  iterationPath: string;
}

export async function getWorkItemDetails(
  organization: string,
  project: string,
  workItemId: number
): Promise<WorkItemDetails> {
  const url =
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
    `/_apis/wit/workitems/${workItemId}?fields=${encodeURIComponent('System.WorkItemType,System.Title,System.Parent,System.AreaPath,System.IterationPath')}` +
    '&api-version=7.0';

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Could not inspect the current work item: HTTP ${response.status} ${response.statusText}\n${text}`
    );
  }

  const data: unknown = await response.json();

  if (!isObject(data) || !isObject(data.fields)) {
    return {
      workItemType: '',
      title: '',
      parentId: null,
      areaPath: '',
      iterationPath: ''
    };
  }

  const workItemTypeRaw = data.fields['System.WorkItemType'];
  const titleRaw = data.fields['System.Title'];
  const parentIdRaw = data.fields['System.Parent'];
  const areaPathRaw = data.fields['System.AreaPath'];
  const iterationPathRaw = data.fields['System.IterationPath'];

  return {
    workItemType:
      typeof workItemTypeRaw === 'string' ? workItemTypeRaw.trim() : '',
    title: typeof titleRaw === 'string' ? titleRaw.trim() : '',
    parentId: typeof parentIdRaw === 'number' ? parentIdRaw : null,
    areaPath: typeof areaPathRaw === 'string' ? areaPathRaw.trim() : '',
    iterationPath:
      typeof iterationPathRaw === 'string' ? iterationPathRaw.trim() : ''
  };
}

export function isSupportedParentType(workItemType: string): boolean {
  const normalized = workItemType.toLowerCase();
  return (
    normalized === 'bug' ||
    normalized === 'pbi' ||
    normalized === 'product backlog item' ||
    normalized === 'improvement'
  );
}
