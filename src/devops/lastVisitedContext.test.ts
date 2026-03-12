import {
  parseLastVisitedDevOpsContext,
  tryCreateLastVisitedDevOpsContext
} from './lastVisitedContext';

describe('lastVisitedContext', () => {
  describe('tryCreateLastVisitedDevOpsContext', () => {
    it('returns context for a valid dev.azure.com project url', () => {
      const updatedAt = 123456;
      const rawUrl =
        'https://dev.azure.com/org%20name/proj%20name/_workitems/edit/42';

      expect(tryCreateLastVisitedDevOpsContext(rawUrl, updatedAt)).toEqual({
        organization: 'org name',
        project: 'proj name',
        url: rawUrl,
        updatedAt
      });
    });

    it('returns null for malformed urls', () => {
      expect(tryCreateLastVisitedDevOpsContext('not-a-url')).toBeNull();
    });

    it('returns null for non-dev.azure.com hosts', () => {
      expect(
        tryCreateLastVisitedDevOpsContext(
          'https://contoso.visualstudio.com/Project/_workitems'
        )
      ).toBeNull();
    });

    it('returns null when organization/project are missing', () => {
      expect(
        tryCreateLastVisitedDevOpsContext('https://dev.azure.com/only-org')
      ).toBeNull();
    });
  });

  describe('parseLastVisitedDevOpsContext', () => {
    it('returns null for non-object values', () => {
      expect(parseLastVisitedDevOpsContext(null)).toBeNull();
      expect(parseLastVisitedDevOpsContext('bad')).toBeNull();
      expect(parseLastVisitedDevOpsContext(123)).toBeNull();
    });

    it('returns null for invalid object shapes', () => {
      expect(
        parseLastVisitedDevOpsContext({
          organization: 'org',
          project: 'proj',
          updatedAt: Date.now()
        })
      ).toBeNull();

      expect(
        parseLastVisitedDevOpsContext({
          organization: 'org',
          project: 'proj',
          url: 'https://dev.azure.com/org/proj',
          updatedAt: 'not-a-number'
        })
      ).toBeNull();
    });

    it('normalizes organization/project and falls back to url-derived values', () => {
      const updatedAt = 999;
      const value = {
        organization: '   ',
        project: ' custom-project ',
        url: 'https://dev.azure.com/url-org/url-project/_workitems',
        updatedAt
      };

      expect(parseLastVisitedDevOpsContext(value)).toEqual({
        organization: 'url-org',
        project: 'custom-project',
        url: value.url,
        updatedAt
      });
    });

    it('returns null when url is invalid for devops context', () => {
      expect(
        parseLastVisitedDevOpsContext({
          organization: 'org',
          project: 'proj',
          url: 'https://example.com/org/proj',
          updatedAt: Date.now()
        })
      ).toBeNull();
    });
  });
});
