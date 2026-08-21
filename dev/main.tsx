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
        todoStates: ['To Do', 'In Progress']
      });
    }
  });

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
