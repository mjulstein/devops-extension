import type { Settings } from '@/types';
import { useEffect, useState } from 'react';
import classes from './SettingsCard.module.css';

interface SettingsCardProps {
  settings: Settings;
  onChange: (nextSettings: Settings) => void;
  onSave: () => Promise<void>;
  onReloadExtension: () => void;
  isLoading: boolean;
}

export function SettingsCard({
  settings,
  onChange,
  onSave,
  onReloadExtension,
  isLoading
}: SettingsCardProps) {
  const [todoStatesText, setTodoStatesText] = useState(() =>
    settings.todoStates.join(', ')
  );

  useEffect(() => {
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    setTodoStatesText(settings.todoStates.join(', '));
  }, [settings.todoStates]);

  function commitTodoStates() {
    const nextStates = parseTodoStatesInput(todoStatesText);

    if (
      nextStates.length === settings.todoStates.length &&
      nextStates.every(
        (nextState, index) =>
          nextState.toLowerCase() === settings.todoStates[index]?.toLowerCase()
      )
    ) {
      return;
    }

    onChange({ ...settings, todoStates: nextStates });
    setTodoStatesText(nextStates.join(', '));
  }

  function handleSaveClick() {
    commitTodoStates();
    void onSave();
  }

  return (
    <section className={classes.card}>
      <p className={classes.description}>
        Organization/project auto-fill from the last visited dev.azure.com
        project URL when empty. You can override them here and saved values stay
        until you change them.
      </p>

      <label className={classes.fieldLabel}>
        Organization
        <input
          className={classes.textInput}
          type="text"
          placeholder="my-organization"
          value={settings.organization}
          onChange={(event) =>
            onChange({ ...settings, organization: event.target.value })
          }
        />
      </label>

      <label className={classes.fieldLabel}>
        Project
        <input
          className={classes.textInput}
          type="text"
          placeholder="my-project"
          value={settings.project}
          onChange={(event) =>
            onChange({ ...settings, project: event.target.value })
          }
        />
      </label>

      <label className={classes.fieldLabel}>
        Assigned to
        <input
          className={classes.textInput}
          type="text"
          placeholder="@me (leave blank to use current user)"
          value={settings.assignedTo}
          onChange={(event) =>
            onChange({ ...settings, assignedTo: event.target.value })
          }
        />
      </label>

      <label className={classes.fieldLabel}>
        TODO states
        <input
          className={classes.textInput}
          type="text"
          placeholder="e.g. Ready, New"
          value={todoStatesText}
          onChange={(event) => setTodoStatesText(event.target.value)}
          onBlur={commitTodoStates}
        />
        <span className={classes.helperText}>
          Comma-separated Azure DevOps state names to include in the TODO
          section in addition to the default To Do/In Progress states.
        </span>
      </label>

      <p className={classes.description}>
        Leave Assigned to empty to use the current signed-in Azure DevOps user
        (@me).
      </p>

      <div className={classes.buttonRow}>
        <button
          className={classes.button}
          onClick={handleSaveClick}
          disabled={isLoading}
        >
          Save settings
        </button>
        <button className={classes.button} onClick={onReloadExtension}>
          Reload extension
        </button>
      </div>
    </section>
  );
}

function parseTodoStatesInput(value: string): string[] {
  const segments = value
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const unique: string[] = [];

  for (const segment of segments) {
    const key = segment.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(segment);
  }

  return unique;
}
