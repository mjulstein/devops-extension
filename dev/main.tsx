import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DevToolbar } from './DevToolbar';
import classes from './DevToolbar.module.css';
import {
  installMockChrome,
  readScenarioId,
  resetStorage,
  writeScenarioId
} from './mockChrome';
import { DEV_ORGANIZATION, DEV_PROJECT, SCENARIOS } from './scenarios';
import type { ScenarioId } from './scenarios';

// The fake chrome global must exist before App (or anything it imports) runs.
let scenarioId: ScenarioId = readScenarioId();
installMockChrome(() => SCENARIOS[scenarioId]);

// Seed placeholder settings so the panel starts in a configured state.
void chrome.storage.local
  .get({ organization: '' })
  .then(async (stored: Record<string, unknown>) => {
    if (!stored.organization) {
      await chrome.storage.local.set({
        organization: DEV_ORGANIZATION,
        project: DEV_PROJECT,
        assignedTo: '',
        todoStates: ['To Do', 'In Progress'],
        // Placeholder ids so the quick-task create/archive actions are
        // reachable in the harness. Never real work-item ids.
        quickTaskParentId: '9000',
        quickTaskArchiveId: '9100',
        bookmarkFolderName: 'dev-favorites',
        // A few favorites so the starred menu has rows to lay out. Placeholder
        // boards on the harness org only — never real pages.
        starredPages: [
          {
            url: `https://dev.azure.com/${DEV_ORGANIZATION}/${DEV_PROJECT}/_boards/board/t/Frontend/Stories`,
            label: 'Frontend board',
            starredAt: 1
          },
          {
            url: `https://dev.azure.com/${DEV_ORGANIZATION}/${DEV_PROJECT}/_queries/query/?wiql=recently-updated-items-assigned-to-me`,
            label: 'Recently updated items assigned to me',
            starredAt: 2
          },
          {
            url: `https://dev.azure.com/${DEV_ORGANIZATION}/${DEV_PROJECT}/_dashboards`,
            label: 'Dashboards',
            starredAt: 3
          }
        ]
      });
    }
  });

// The palette is drawn into an Azure DevOps page by the content script, which
// the harness does not run. Exposed here so its layout and keyboard handling can
// be exercised; over a real page it covers that page, not the panel.
const { openFavoritesPalette } = await import(
  '@/favoritesPalette/favoritesPalette'
);
(globalThis as unknown as { devPalette: unknown }).devPalette = async () => {
  const stored = (await chrome.storage.local.get('starredPages')) as {
    starredPages?: unknown;
  };
  openFavoritesPalette({
    favorites: Array.isArray(stored.starredPages) ? stored.starredPages : [],
    onOpenPage: (url: string) => {
      (globalThis as unknown as { devPaletteOpened?: string }).devPaletteOpened =
        url;
    }
  });
};

const { App } = await import('@/sidepanel/App');

const WIDTH_KEY = 'devharness.width';

function DevHarness() {
  const [scenario, setScenario] = useState<ScenarioId>(scenarioId);
  const [width, setWidth] = useState<number>(
    Number(window.localStorage.getItem(WIDTH_KEY)) || 360
  );
  // Remount App on scenario change so it refetches from the new fixtures.
  const [generation, setGeneration] = useState(0);

  return (
    <>
      <DevToolbar
        scenarioId={scenario}
        width={width}
        onSelectScenario={(id) => {
          scenarioId = id;
          writeScenarioId(id);
          setScenario(id);
          setGeneration((value) => value + 1);
        }}
        onSelectWidth={(next) => {
          window.localStorage.setItem(WIDTH_KEY, String(next));
          setWidth(next);
        }}
        onResetStorage={() => {
          resetStorage();
          window.location.reload();
        }}
      />
      <div className={classes.stage}>
        <div className={classes.frame} style={{ width: `${width}px` }}>
          <App key={generation} />
        </div>
      </div>
    </>
  );
}

const container = document.getElementById('dev-root');
if (!container) throw new Error('Missing #dev-root element.');
createRoot(container).render(<DevHarness />);
