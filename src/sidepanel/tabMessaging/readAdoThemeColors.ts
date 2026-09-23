import { sendMessageToActiveTab } from './sendMessageToActiveTab';
import { expectRuntimeResponse, type RuntimeResponse } from './runtimeResponse';

/**
 * Azure DevOps's own colours, read from the page in front.
 *
 * Goes to the tab rather than the REST API because a theme is a page's computed
 * style, not a stored setting — and it means the answer matches what the user is
 * looking at.
 */
export async function readAdoThemeColors(): Promise<
  RuntimeResponse<Record<string, string>>
> {
  return expectRuntimeResponse(
    await sendMessageToActiveTab<RuntimeResponse<Record<string, string>>>({
      type: 'READ_ADO_THEME_COLORS'
    }),
    'READ_ADO_THEME_COLORS'
  );
}
