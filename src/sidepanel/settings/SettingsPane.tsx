import type { PatRecord, Settings } from '@/types';
import { useEffect, useState } from 'react';
import {
  clearPatData,
  loadPatStatus,
  refreshTabIcons,
  revokeAllExtensionPats,
  rotatePat
} from '@/sidepanel/tabMessaging';
import { loadLastVisitedDevOpsContext } from '@/sidepanel/chromeStorage';
import classes from './SettingsCard.module.css';

interface SettingsCardProps {
  settings: Settings;
  onChange: (nextSettings: Settings) => void;
  onSave: () => Promise<void>;
  onReloadExtension: () => void;
  isLoading: boolean;
}

export function SettingsPane({
  settings,
  onChange,
  onSave,
  onReloadExtension,
  isLoading
}: SettingsCardProps) {
  const [todoStatesText, setTodoStatesText] = useState(() =>
    settings.todoStates.join(', ')
  );
  const [refreshingIcons, setRefreshingIcons] = useState(false);
  const [iconRefreshStatus, setIconRefreshStatus] = useState<string | null>(
    null
  );

  const [patRecord, setPatRecord] = useState<PatRecord | null>(null);
  const [patDeviceId, setPatDeviceId] = useState<string | null>(null);
  const [patOrg, setPatOrg] = useState('');
  const [patAction, setPatAction] = useState<'idle' | 'rotating' | 'revoking'>(
    'idle'
  );
  const [patActionMessage, setPatActionMessage] = useState<string | null>(null);

  useEffect(() => {
    const jointedTodosStates = settings.todoStates.join(', ');
    if (jointedTodosStates !== todoStatesText)
      setTodoStatesText(jointedTodosStates);
  }, [settings.todoStates, todoStatesText]);

  useEffect(() => {
    void (async () => {
      const [status, context] = await Promise.all([
        loadPatStatus(),
        loadLastVisitedDevOpsContext()
      ]);

      setPatRecord(status.record);

      setPatDeviceId(status.deviceId);

      setPatOrg(settings.organization.trim() || (context?.organization ?? ''));
    })();
  }, [settings.organization]);

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

  async function handleRefreshIcons() {
    setRefreshingIcons(true);
    setIconRefreshStatus(null);
    try {
      await refreshTabIcons();
      setIconRefreshStatus('Icons refreshed.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setIconRefreshStatus(`Failed: ${msg}`);
    } finally {
      setRefreshingIcons(false);
    }
  }

  async function handleRotatePat() {
    if (!patOrg) {
      setPatActionMessage(
        'Open an Azure DevOps page first so the extension knows your organization.'
      );
      return;
    }
    setPatAction('rotating');
    setPatActionMessage(null);
    try {
      const record = await rotatePat(patOrg);
      setPatRecord(record);
      setPatActionMessage('PAT rotated successfully.');
    } catch (err) {
      setPatActionMessage(
        `Rotation failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setPatAction('idle');
    }
  }

  async function handleRevokeAll() {
    if (!patOrg) {
      setPatActionMessage(
        'Open an Azure DevOps page first so the extension knows your organization.'
      );
      return;
    }
    setPatAction('revoking');
    setPatActionMessage(null);
    try {
      const count = await revokeAllExtensionPats(patOrg);
      setPatRecord(null);
      setPatActionMessage(`Revoked ${count} PAT${count !== 1 ? 's' : ''}.`);
    } catch (err) {
      setPatActionMessage(
        `Revoke failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setPatAction('idle');
    }
  }

  async function handleClearPatData() {
    setPatAction('rotating');
    setPatActionMessage(null);
    try {
      await clearPatData();
      setPatRecord(null);
      setPatDeviceId(null);
      setPatActionMessage(
        'PAT data cleared. The extension will mint a fresh PAT on next sign-in.'
      );
    } catch (err) {
      setPatActionMessage(
        `Clear failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setPatAction('idle');
    }
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
        <button
          className={classes.button}
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload
        </button>
        <button className={classes.button} onClick={onReloadExtension}>
          Reload extension
        </button>
      </div>

      <hr className={classes.separator} />

      <p className={classes.description}>
        Re-scrape the Azure DevOps section icons from the live page and persist
        them for instant loading. The active tab must be an Azure DevOps page.
      </p>

      <div className={classes.buttonRow}>
        <button
          className={classes.button}
          onClick={() => void handleRefreshIcons()}
          disabled={refreshingIcons}
        >
          {refreshingIcons ? 'Refreshing…' : 'Refresh Tab Icons'}
        </button>
        {iconRefreshStatus && (
          <span className={classes.helperText}>{iconRefreshStatus}</span>
        )}
      </div>

      <hr className={classes.separator} />

      <p className={classes.description}>
        The extension uses a Personal Access Token (PAT) for authenticated
        requests. It is created and rotated automatically — no manual setup
        required.
      </p>

      <div style={{ fontSize: 13, marginBottom: 10 }}>
        <span style={{ marginRight: 8 }}>
          Status:{' '}
          <strong style={{ color: getPatStatusColor(patRecord) }}>
            {getPatStatusLabel(patRecord)}
          </strong>
        </span>
        {patRecord && (
          <span style={{ color: '#555' }}>
            · expires {formatExpiry(patRecord.expiresAt)}
          </span>
        )}
        {patDeviceId && (
          <div style={{ color: '#888', marginTop: 2 }}>
            ID: {patDeviceId}-devopsext
          </div>
        )}
        {patOrg && (
          <div style={{ marginTop: 4 }}>
            <a
              href={`https://dev.azure.com/${encodeURIComponent(patOrg)}/_usersSettings/tokens`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12 }}
            >
              Manage in Azure DevOps ↗
            </a>
          </div>
        )}
      </div>

      <div className={classes.buttonRow}>
        <button
          className={classes.button}
          onClick={() => void handleRotatePat()}
          disabled={patAction !== 'idle'}
        >
          {patAction === 'rotating' ? 'Rotating…' : 'Rotate now'}
        </button>
        <button
          className={classes.button}
          onClick={() => void handleRevokeAll()}
          disabled={patAction !== 'idle'}
        >
          {patAction === 'revoking' ? 'Revoking…' : 'Revoke all'}
        </button>
        <button
          className={classes.button}
          onClick={() => void handleClearPatData()}
          disabled={patAction !== 'idle'}
          title="Wipe stored PAT and device ID so the extension starts fresh on next sign-in"
        >
          Clear PAT data
        </button>
      </div>
      {patActionMessage && (
        <span
          style={{
            fontSize: 12,
            color: /failed|error/i.test(patActionMessage)
              ? '#c62828'
              : '#2e7d32',
            marginTop: 6,
            display: 'block',
            fontWeight: 500
          }}
        >
          {patActionMessage}
        </span>
      )}
    </section>
  );
}

const EXPIRING_SOON_MS = 12 * 60 * 60 * 1000; // matches PAT rotation threshold

function getPatStatusLabel(record: PatRecord | null): string {
  if (!record) return 'Not set up';
  const msLeft = record.expiresAt - Date.now();
  if (msLeft <= 0) return 'Expired';
  if (msLeft < EXPIRING_SOON_MS) return 'Expiring soon';
  return 'Active';
}

function getPatStatusColor(record: PatRecord | null): string {
  if (!record) return '#888';
  const msLeft = record.expiresAt - Date.now();
  if (msLeft <= 0) return '#d32f2f';
  if (msLeft < EXPIRING_SOON_MS) return '#f57c00';
  return '#388e3c';
}

function formatExpiry(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
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
