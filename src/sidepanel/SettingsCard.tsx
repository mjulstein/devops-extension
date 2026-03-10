import type { Settings } from "./types";

type SettingsCardProps = {
  settings: Settings;
  onChange: (nextSettings: Settings) => void;
  onSave: () => Promise<void>;
  onReloadExtension: () => void;
  isLoading: boolean;
};

export function SettingsCard({
  settings,
  onChange,
  onSave,
  onReloadExtension,
  isLoading
}: SettingsCardProps) {
  return (
    <section className="card">
      <h2>Settings</h2>
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

      <div className="button-row">
        <button onClick={() => void onSave()} disabled={isLoading}>
          Save settings
        </button>
        <button onClick={onReloadExtension} disabled={isLoading}>
          Reload extension
        </button>
      </div>
    </section>
  );
}
