import {
  normalizeTypedUrl,
  parseAppUrl,
  appBaseHost,
  deriveEnvUrl,
  envToken,
  inferDnsStyle,
  type AppEntry
} from './appDns';

function app(name: string, envs: [string, string][]): AppEntry {
  return {
    name,
    environments: envs.map(([envName, url]) => ({ name: envName, url }))
  };
}

describe('inferDnsStyle', () => {
  it('reads the org-subdomain shape off two stored addresses', () => {
    expect(
      inferDnsStyle(
        app('my-app', [
          ['live', 'https://my-app.orgname.com/'],
          ['test', 'https://my-app-test.orgname.com/']
        ]).environments
      )
    ).toBe('org-subdomain');
  });

  it('reads the own-domain shape off two stored addresses', () => {
    expect(
      inferDnsStyle(
        app('my-app', [
          ['live', 'https://my-app.com/'],
          ['test', 'https://test.my-app.com/']
        ]).environments
      )
    ).toBe('own-domain');
  });

  it('trusts the evidence over the label count', () => {
    // Three labels would otherwise say org-subdomain, but the pair says
    // plainly that the environment goes in front.
    expect(
      inferDnsStyle(
        app('my-app', [
          ['live', 'https://my-app.co.uk/'],
          ['test', 'https://test.my-app.co.uk/']
        ]).environments
      )
    ).toBe('own-domain');
  });

  it('compares markers off when no environment is the plain one', () => {
    // Nothing here is the bare address, so neither can be the base of the
    // other; with the markers removed both are my-app.com.
    expect(
      inferDnsStyle(
        app('my-app', [
          ['test', 'https://test.my-app.com/'],
          ['dev', 'https://dev.my-app.com/']
        ]).environments
      )
    ).toBe('own-domain');

    expect(
      inferDnsStyle(
        app('my-app', [
          ['test', 'https://my-app-test.orgname.com/'],
          ['dev', 'https://my-app-dev.orgname.com/']
        ]).environments
      )
    ).toBe('org-subdomain');
  });

  it('falls back to the label count with only one address', () => {
    expect(
      inferDnsStyle(
        app('a', [['live', 'https://my-app.orgname.com/']]).environments
      )
    ).toBe('org-subdomain');
    expect(
      inferDnsStyle(app('a', [['live', 'https://my-app.com/']]).environments)
    ).toBe('own-domain');
  });

  it('does not fall over on an unusable address', () => {
    expect(inferDnsStyle([{ name: 'x', url: 'not a url' }])).toBe('own-domain');
    expect(inferDnsStyle([])).toBe('own-domain');
  });
});

describe('appBaseHost', () => {
  it('is the host itself when the first environment carries no marker', () => {
    expect(
      appBaseHost(app('my-app', [['live', 'https://my-app.orgname.com/']]))
    ).toBe('my-app.orgname.com');
  });

  it('strips a suffix the first environment put on the app label', () => {
    expect(
      appBaseHost(
        app('my-app', [
          ['test', 'https://my-app-test.orgname.com/'],
          ['dev', 'https://my-app-dev.orgname.com/']
        ])
      )
    ).toBe('my-app.orgname.com');
  });

  it('strips a label the first environment put in front', () => {
    expect(
      appBaseHost(
        app('my-app', [
          ['test', 'https://test.my-app.com/'],
          ['dev', 'https://dev.my-app.com/']
        ])
      )
    ).toBe('my-app.com');
  });

  it('is null for an app with nothing stored', () => {
    expect(appBaseHost(app('my-app', []))).toBeNull();
  });
});

describe('deriveEnvUrl', () => {
  it('suffixes the app label for the org-subdomain shape', () => {
    expect(
      deriveEnvUrl(
        app('my-app', [['live', 'https://my-app.orgname.com/']]),
        'test'
      )
    ).toBe('https://my-app-test.orgname.com/');
  });

  it('prefixes a label for the own-domain shape', () => {
    expect(
      deriveEnvUrl(app('my-app', [['live', 'https://my-app.com/']]), 'test')
    ).toBe('https://test.my-app.com/');
  });

  it('keeps the protocol, port and path of what it patterns on', () => {
    expect(
      deriveEnvUrl(
        app('my-app', [
          ['live', 'http://my-app.orgname.com:8080/dashboard?a=1']
        ]),
        'test'
      )
    ).toBe('http://my-app-test.orgname.com:8080/dashboard?a=1');
  });

  it('builds from the app address rather than from a marked-up one', () => {
    // Patterned on my-app-test, a naive derivation gives my-app-test-dev.
    expect(
      deriveEnvUrl(
        app('my-app', [['test', 'https://my-app-test.orgname.com/']]),
        'dev'
      )
    ).toBe('https://my-app-dev.orgname.com/');
  });

  it('accepts an environment name with a space in it', () => {
    expect(
      deriveEnvUrl(
        app('my-app', [['live', 'https://my-app.com/']]),
        'User Test'
      )
    ).toBe('https://user-test.my-app.com/');
  });

  it('has nothing to suggest without a stored address or a name', () => {
    expect(deriveEnvUrl(app('my-app', []), 'test')).toBeNull();
    expect(
      deriveEnvUrl(app('my-app', [['live', 'https://my-app.com/']]), '  ')
    ).toBeNull();
  });
});

describe('envToken', () => {
  it('is a hostname-safe form of the name the user typed', () => {
    expect(envToken('  User Test ')).toBe('user-test');
  });
});

describe('parseAppUrl', () => {
  it('reads a hyphenless subdomain as the environment', () => {
    expect(parseAppUrl('https://test.my-app.com/')).toEqual({
      appHost: 'my-app.com',
      appName: 'my-app',
      envName: 'test',
      style: 'own-domain'
    });
  });

  it('reads a hyphenated subdomain as the app under somebody else domain', () => {
    expect(parseAppUrl('https://my-app.orgname.com/')).toEqual({
      appHost: 'my-app.orgname.com',
      appName: 'my-app',
      envName: null,
      style: 'org-subdomain'
    });
  });

  it('treats www and a bare domain as the app itself, with no environment', () => {
    expect(parseAppUrl('https://www.my-app.com/')).toMatchObject({
      appHost: 'my-app.com',
      envName: null
    });
    expect(parseAppUrl('https://my-app.com/')).toMatchObject({
      appHost: 'my-app.com',
      envName: null
    });
  });

  it('takes the marker off once the environment is named', () => {
    // Without the name this looks like an app called my-app-test.
    expect(parseAppUrl('https://my-app-test.orgname.com/', 'test')).toEqual({
      appHost: 'my-app.orgname.com',
      appName: 'my-app',
      envName: 'test',
      style: 'org-subdomain'
    });
    expect(parseAppUrl('https://test.my-app.com/', 'test')).toMatchObject({
      appHost: 'my-app.com',
      style: 'own-domain'
    });
  });

  it('keeps the whole host when the named environment is not in the address', () => {
    // Inconsistent DNS: the environment is called live but the host says nothing.
    expect(parseAppUrl('https://my-app.orgname.com/', 'live')).toMatchObject({
      appHost: 'my-app.orgname.com',
      envName: 'live'
    });
  });

  it('is null for something that is not an address', () => {
    expect(parseAppUrl('not a url')).toBeNull();
  });
});

describe('normalizeTypedUrl', () => {
  it('assumes https for a bare host', () => {
    expect(normalizeTypedUrl('my-app-test.orgname.com')).toBe(
      'https://my-app-test.orgname.com'
    );
  });

  it('keeps an explicit http, which is the point of the rule', () => {
    // What http is for in practice: a local server on a port.
    expect(normalizeTypedUrl('http://localhost:8080/x')).toBe(
      'http://localhost:8080/x'
    );
  });

  it('still assumes https for a host:port with no scheme', () => {
    // A port is not a scheme. "localhost:3000" is https by this rule, so a
    // local server has to be typed with its http:// — which is the rule, not an
    // oversight: guessing http from the word localhost would break a local
    // server that does use https.
    expect(normalizeTypedUrl('localhost:3000')).toBe('https://localhost:3000');
  });

  it('keeps https and leaves any other scheme alone', () => {
    expect(normalizeTypedUrl('https://a.test/')).toBe('https://a.test/');
    expect(normalizeTypedUrl('chrome://bookmarks/')).toBe(
      'chrome://bookmarks/'
    );
  });

  it('trims what was typed', () => {
    expect(normalizeTypedUrl('  a.test  ')).toBe('https://a.test');
  });
});
