export function getOrganizationAndProjectFromUrl(rawUrl: string): {
  organization: string;
  project: string;
} {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error('Could not parse the current page URL.');
  }

  const segments = parsedUrl.pathname.split('/').filter(Boolean);

  if (segments.length < 2) {
    throw new Error(
      'Could not derive organization/project from URL. Open a project page in Azure DevOps.'
    );
  }

  return {
    organization: decodeURIComponent(segments[0]),
    project: decodeURIComponent(segments[1])
  };
}

export function getWorkItemIdFromUrl(rawUrl: string): number | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }

  const editMatch = /\/_workitems\/edit\/(\d+)/i.exec(parsedUrl.pathname);
  if (editMatch) {
    return Number(editMatch[1]);
  }

  const candidates = [
    parsedUrl.searchParams.get('id'),
    parsedUrl.searchParams.get('workitem'),
    parsedUrl.searchParams.get('workItem'),
    parsedUrl.searchParams.get('workItemId'),
    ...getHashParamCandidates(parsedUrl.hash)
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const hashIdMatch = /(?:^|[?&/#])(?:id|workitem|workItem|workItemId)=(\d+)(?:[&#/]|$)/i.exec(
    parsedUrl.hash
  );

  if (!hashIdMatch) {
    return null;
  }

  const parsed = Number(hashIdMatch[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getHashParamCandidates(rawHash: string): Array<string | null> {
  if (!rawHash) {
    return [];
  }

  const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  const queryStart = hash.indexOf('?');

  if (queryStart < 0) {
    return [];
  }

  const hashParams = new URLSearchParams(hash.slice(queryStart + 1));
  return [
    hashParams.get('id'),
    hashParams.get('workitem'),
    hashParams.get('workItem'),
    hashParams.get('workItemId')
  ];
}

