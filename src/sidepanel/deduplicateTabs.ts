export async function deduplicateTabs(): Promise<number> {
  const tabs = await chrome.tabs.query({});

  const byUrl = new Map<string, chrome.tabs.Tab[]>();
  for (const tab of tabs) {
    if (!tab.url) continue;
    const group = byUrl.get(tab.url) ?? [];
    group.push(tab);
    byUrl.set(tab.url, group);
  }

  const toClose: number[] = [];
  for (const group of byUrl.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort(
      (a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0)
    );
    for (const tab of sorted.slice(1)) {
      if (typeof tab.id === 'number') toClose.push(tab.id);
    }
  }

  if (toClose.length > 0) {
    await chrome.tabs.remove(toClose);
  }

  return toClose.length;
}
