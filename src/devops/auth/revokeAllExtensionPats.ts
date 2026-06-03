import { isFresh } from './bearerToken';
import { listExtensionPats, revokePat } from './patApi';
import { clearPatRecord } from './patStore';
import { readBearerFromTab } from './readBearerFromTab';

// Manual maintenance action (Settings → "Revoke all"): revoke every
// `…-devopsext` entry in the token registry and forget the stored PAT. Needs a
// fresh Bearer from an open Azure DevOps tab, like any other PAT-API call.
export async function revokeAllExtensionPats(
  organization: string
): Promise<number> {
  const bearer = await readBearerFromTab();
  if (!bearer || !isFresh(bearer)) {
    throw new Error(
      'Open an Azure DevOps tab and wait for it to finish loading, then try again.'
    );
  }

  const pats = await listExtensionPats(bearer, organization);
  await Promise.all(
    pats.map((pat) =>
      revokePat(bearer, organization, pat.authorizationId).catch(
        () => undefined
      )
    )
  );
  await clearPatRecord();
  return pats.length;
}
