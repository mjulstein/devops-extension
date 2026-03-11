export function isAzureDevOpsUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) {
    return false;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return false;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  return hostname === 'dev.azure.com' || hostname.endsWith('.visualstudio.com');
}
