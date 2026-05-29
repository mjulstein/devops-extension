// Provides a minimal chrome API stub for tests that run outside the extension runtime.
// chrome.storage.local.get returns {} (no stored PAT), so authFetch falls back to
// the same credentials:'include' behaviour the tests already mock via vi.stubGlobal('fetch').
// Uses beforeEach so vi.unstubAllGlobals() in test afterEach hooks doesn't permanently remove it.

beforeEach(() => {
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined)
      }
    }
  });
});
