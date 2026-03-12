import type { Settings } from '@/types';

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
  return (
    <section className="card">
      <p>
        Organization/project auto-fill from the last visited dev.azure.com
        project URL when empty. You can override them here and saved values stay
        until you change them.
      </p>

      <label>
        Organization
        <input
          type="text"
          placeholder="my-organization"
          value={settings.organization}
          onChange={(event) =>
            onChange({ ...settings, organization: event.target.value })
          }
        />
      </label>

      <label>
        Project
        <input
          type="text"
          placeholder="my-project"
          value={settings.project}
          onChange={(event) =>
            onChange({ ...settings, project: event.target.value })
          }
        />
      </label>

      <label>
        Assigned to
        <input
          type="text"
          placeholder="John Doe"
          value={settings.assignedTo}
          onChange={(event) =>
            onChange({ ...settings, assignedTo: event.target.value })
          }
        />
      </label>

      <div className="button-row">
        <button onClick={() => void onSave()} disabled={isLoading}>
          Save settings
        </button>
        <button onClick={onReloadExtension}>Reload extension</button>
      </div>
    </section>
  );
}
