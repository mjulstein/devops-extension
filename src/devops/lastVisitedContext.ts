import {
  getOrganizationAndProjectFromUrl,
  getWorkItemIdFromUrl
} from './urlContext';

export interface LastVisitedDevOpsContext {
  organization: string;
  project: string;
  url: string;
  updatedAt: number;
}

export const LAST_VISITED_DEVOPS_CONTEXT_KEY = 'lastVisitedDevOpsContext';
export const LAST_VISITED_WORK_ITEM_REF_KEY = 'lastVisitedWorkItemRef';

export interface LastVisitedWorkItemRef {
  url: string;
  updatedAt: number;
}

export function tryCreateLastVisitedDevOpsContext(
  rawUrl: string,
  updatedAt = Date.now()
): LastVisitedDevOpsContext | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsedUrl.hostname.toLowerCase() !== 'dev.azure.com') {
    return null;
  }

  try {
    const { organization, project } = getOrganizationAndProjectFromUrl(rawUrl);
    return {
      organization,
      project,
      url: rawUrl,
      updatedAt
    };
  } catch {
    return null;
  }
}

export function parseLastVisitedDevOpsContext(
  value: unknown
): LastVisitedDevOpsContext | null {
  if (!isRecord(value)) {
    return null;
  }

  const organization = value.organization;
  const project = value.project;
  const url = value.url;
  const updatedAt = value.updatedAt;

  if (
    typeof organization !== 'string' ||
    typeof project !== 'string' ||
    typeof url !== 'string' ||
    typeof updatedAt !== 'number'
  ) {
    return null;
  }

  const normalized = tryCreateLastVisitedDevOpsContext(url, updatedAt);
  if (!normalized) {
    return null;
  }

  return {
    ...normalized,
    organization: organization.trim() || normalized.organization,
    project: project.trim() || normalized.project
  };
}

export function tryCreateLastVisitedWorkItemRef(
  rawUrl: string,
  updatedAt = Date.now()
): LastVisitedWorkItemRef | null {
  const devOpsContext = tryCreateLastVisitedDevOpsContext(rawUrl, updatedAt);
  if (!devOpsContext) {
    return null;
  }

  const workItemId = getWorkItemIdFromUrl(rawUrl);
  if (!workItemId) {
    return null;
  }

  return {
    url: rawUrl,
    updatedAt
  };
}

export function parseLastVisitedWorkItemRef(
  value: unknown
): LastVisitedWorkItemRef | null {
  if (!isRecord(value)) {
    return null;
  }

  const url = value.url;
  const updatedAt = value.updatedAt;

  if (typeof url !== 'string' || typeof updatedAt !== 'number') {
    return null;
  }

  return tryCreateLastVisitedWorkItemRef(url, updatedAt);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
