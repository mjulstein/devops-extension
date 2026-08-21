import classes from './DevToolbar.module.css';
import { SCENARIO_IDS, SCENARIOS } from './scenarios';
import type { ScenarioId } from './scenarios';

// 360 is the real Edge/Chrome side-panel default width — iterate against that.
const WIDTHS = [320, 360, 400, 480, 600];

interface DevToolbarProps {
  scenarioId: ScenarioId;
  width: number;
  onSelectScenario: (id: ScenarioId) => void;
  onSelectWidth: (width: number) => void;
  onResetStorage: () => void;
}

export function DevToolbar({
  scenarioId,
  width,
  onSelectScenario,
  onSelectWidth,
  onResetStorage
}: DevToolbarProps) {
  return (
    <div className={classes.bar} data-testid="dev-toolbar">
      <span className={classes.mock} title="No network calls are made. Settings and org/project are ignored; all data comes from dev/scenarios.ts.">
        MOCK DATA
      </span>
      <span className={classes.label}>Scenario</span>
      <select
        className={classes.select}
        value={scenarioId}
        onChange={(event) => {
          onSelectScenario(event.target.value as ScenarioId);
        }}
      >
        {SCENARIO_IDS.map((id) => (
          <option key={id} value={id}>
            {SCENARIOS[id].label}
          </option>
        ))}
      </select>

      <span className={classes.label}>Width</span>
      <div className={classes.group}>
        {WIDTHS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={classes.button}
            aria-pressed={candidate === width}
            onClick={() => {
              onSelectWidth(candidate);
            }}
          >
            {candidate}
          </button>
        ))}
      </div>

      <button type="button" className={classes.button} onClick={onResetStorage}>
        Reset storage
      </button>

      <span className={classes.description}>
        {SCENARIOS[scenarioId].description}
      </span>
    </div>
  );
}
