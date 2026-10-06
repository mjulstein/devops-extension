import { findAppForUrl, suggestEnvName } from './appMatch';
import type { AppEntry } from './appDns';

const apps: AppEntry[] = [
  { name: 'my-app', environments: [] },
  { name: 'my-app-admin', environments: [] },
  { name: 'other', environments: [] }
];

describe('findAppForUrl', () => {
  it('files a page under the app whose name is in the address', () => {
    expect(findAppForUrl(apps, 'https://test.my-app.com/x')?.name).toBe(
      'my-app'
    );
  });

  it('ignores punctuation the deployment did not keep straight', () => {
    // The app is called my-app; this environment spells it myapp.
    expect(findAppForUrl(apps, 'https://myapp-dev.orgname.com/')?.name).toBe(
      'my-app'
    );
  });

  it('prefers the longest name, so a specific app is not swallowed', () => {
    expect(
      findAppForUrl(apps, 'https://my-app-admin-test.orgname.com/')?.name
    ).toBe('my-app-admin');
  });

  it('is null when no app name appears in the address', () => {
    expect(findAppForUrl(apps, 'https://example.test/')).toBeNull();
  });

  it('is null for something that is not an address', () => {
    expect(findAppForUrl(apps, 'not a url')).toBeNull();
  });
});

describe('suggestEnvName', () => {
  it('uses the environment the address names', () => {
    expect(suggestEnvName('https://uat.my-app.com/deep/path')).toBe('uat');
  });

  it('falls back to the host rather than inventing an environment name', () => {
    expect(suggestEnvName('https://my-app.orgname.com/')).toBe(
      'my-app.orgname.com'
    );
  });
});
