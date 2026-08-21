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
}
