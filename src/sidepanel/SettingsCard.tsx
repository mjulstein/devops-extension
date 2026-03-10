import type { Settings } from "./types";

type SettingsCardProps = {
  settings: Settings;
  onChange: (nextSettings: Settings) => void;
  onSave: () => Promise<void>;
  isLoading: boolean;
};

export function SettingsCard({ settings, onChange, onSave, isLoading }: SettingsCardProps) {
  return (
    <details className="card">
      <summary>
        <h2>Settings</h2>
      </summary>
      <p>Organization and project are read from the active Azure DevOps tab URL.</p>

      <label>
        Assigned to
        <input
          type="text"
          placeholder="John Doe"
          value={settings.assignedTo}
          onChange={(event) => onChange({ ...settings, assignedTo: event.target.value })}
        />
      </label>

      <button onClick={() => void onSave()} disabled={isLoading}>
        Save settings
      </button>
    </details>
  );
}
