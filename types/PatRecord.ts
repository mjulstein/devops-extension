export interface PatRecord {
  token: string;
  authorizationId: string;
  expiresAt: number;
  displayName: string;
  /**
   * Scope the PAT was minted with. Optional because records written before
   * scopes were tracked have none; a missing or differing scope forces a
   * rotation so the credential catches up with what the extension needs.
   */
  scope?: string;
  /**
   * True when `scope` is a narrower fallback, because Azure DevOps refused the
   * scope the extension prefers — an organization policy may forbid it. Without
   * this marker the rotation policy would read the narrower scope as out of date
   * and mint a replacement on every call, forever.
   */
  scopeFallback?: boolean;
}
