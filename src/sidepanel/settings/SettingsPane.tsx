import type { PatRecord, Settings } from '@/types';
import type { AdoTheme } from '@/devops/theme';
import { useEffect, useState } from 'react';
import {
  clearPatData,
  loadPatStatus,
  refreshTabIcons,
  revokeAllExtensionPats,
  rotatePat
} from '@/sidepanel/tabMessaging';
import { loadLastVisitedDevOpsContext } from '@/sidepanel/chromeStorage';
import {
  SectionTabs,
  type SectionTabDescriptor
} from '@/sidepanel/atoms/SectionTabs';
import {
  describeUnsavedSettings,
  findChangedSettingsTabs,
  SETTINGS_TAB_LABELS,
  type SettingsTab
} from './settingsDirty';
import classes from './SettingsCard.module.css';
import { FavoritesEditor } from './FavoritesEditor';
import { SettingsHelp } from './SettingsHelp';
import { ShortcutStatus } from './ShortcutStatus';
import { ThemeEditor } from './ThemeEditor';
import { Button } from '../atoms/Button';
import type { StarredPage } from '../starredPages';

interface SettingsCardProps {
  settings: Settings;
  onChange: (nextSettings: Settings) => void;
  onSave: () => Promise<void>;
  onReloadExtension: () => void;
  isLoading: boolean;
  starredPages: StarredPage[];
  /** Settings as persisted, so Save can be offered only when they differ. */
  savedSettings: Settings;
  bookmarkSyncStatus: string | null;
  onSaveStarredPages: (pages: StarredPage[]) => Promise<void>;
  /** The theme in force, so the theme editor opens on the one in view. */
  activeTheme: AdoTheme;
}

export function SettingsPane({
  settings,
  onChange,
  onSave,
  onReloadExtension,
  isLoading,
  starredPages,
  savedSettings,
  bookmarkSyncStatus,
  onSaveStarredPages,
  activeTheme
}: SettingsCardProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('connection');
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
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    setTodoStatesText(settings.todoStates.join(', '));
  }, [settings.todoStates]);

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

  const tabs: SectionTabDescriptor<SettingsTab>[] = [
    {
      id: 'connection',
      label: SETTINGS_TAB_LABELS.connection,
      title: 'Organization, project and TODO states'
    },
    {
      id: 'quick',
      label: SETTINGS_TAB_LABELS.quick,
      title: 'Quick-task parent and archive'
    },
    {
      id: 'favorites',
      label: 'Favorites',
      count: starredPages.length,
      title: 'Starred pages and bookmark syncing'
    },
    {
      id: 'theme',
      label: SETTINGS_TAB_LABELS.theme,
      title: 'Colours for light and dark mode'
    },
    {
      id: 'token',
      label: SETTINGS_TAB_LABELS.token,
      title: 'Personal access token status'
    },
    {
      id: 'maintenance',
      label: SETTINGS_TAB_LABELS.maintenance,
      title: 'Tab icons and reloading'
    }
  ];

  // The typed TODO states only reach `settings` on blur, so the draft compared
  // here uses the text in the box; otherwise an edit in progress would leave
  // Save disabled.
  const changedTabs = findChangedSettingsTabs(
    {
      organization: settings.organization.trim(),
      project: settings.project.trim(),
      assignedTo: settings.assignedTo.trim(),
      todoStates: parseTodoStatesInput(todoStatesText),
      quickTaskParentId: settings.quickTaskParentId.trim(),
      quickTaskArchiveId: settings.quickTaskArchiveId.trim(),
      bookmarkFolderName: settings.bookmarkFolderName.trim(),
      themeOverrides: settings.themeOverrides
    },
    savedSettings
  );
  const hasUnsavedSettings = changedTabs.length > 0;

  return (
    <section className={classes.card}>
      <SectionTabs
        label="Settings sections"
        tabs={tabs}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        actions={
          <Button
            variant="primary"
            size="compact"
            onClick={handleSaveClick}
            disabled={isLoading || !hasUnsavedSettings}
            title={describeUnsavedSettings(changedTabs)}
          >
            Save
          </Button>
        }
      />

      {activeTab === 'connection' && (
        <>
          <SettingsHelp summary="About organization and project">
            <p>
              Organization/project auto-fill from the last visited dev.azure.com
              project URL when empty. You can override them here and saved
              values stay until you change them. Leave Assigned to empty to use
              the current signed-in Azure DevOps user.
            </p>
          </SettingsHelp>

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
        </>
      )}

      {activeTab === 'quick' && (
        <>
          <div className={classes.fieldRow}>
            <label className={classes.fieldLabel}>
              Quick-task parent id
              <input
                className={classes.textInput}
                type="text"
                inputMode="numeric"
                placeholder="e.g. 12345"
                value={settings.quickTaskParentId}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    quickTaskParentId: event.target.value
                  })
                }
              />
            </label>

            <label className={classes.fieldLabel}>
              Archive id
              <input
                className={classes.textInput}
                type="text"
                inputMode="numeric"
                placeholder="e.g. 12346"
                value={settings.quickTaskArchiveId}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    quickTaskArchiveId: event.target.value
                  })
                }
              />
            </label>
          </div>

          <SettingsHelp summary="About quick tasks">
            <p>
              The parent is a personal catch-all for small jobs not linked to
              planned work. The button beside the Quick tab’s input creates a
              task under it, in progress, assigned to you — titled after the
              active page when the input is empty, or after what you typed.
              Quick tasks are kept out of the TODO tab and listed in Quick
              instead.
            </p>
            <p>
              Finished quick tasks can be archived under the archive item, which
              consolidates them out of the Quick list without deleting them. The
              archive button only appears on completed tasks. Leave either id
              blank to disable that half.
            </p>
          </SettingsHelp>
        </>
      )}

      {activeTab === 'favorites' && (
        <>
          <label className={classes.fieldLabel}>
            Sync favorites with bookmarks folder
            <input
              className={classes.textInput}
              type="text"
              placeholder="Folder name (leave blank to disable)"
              value={settings.bookmarkFolderName}
              onChange={(event) =>
                onChange({
                  ...settings,
                  bookmarkFolderName: event.target.value
                })
              }
            />
          </label>
          <SettingsHelp summary="About bookmark syncing">
            <p>
              Favorites are kept in step with a bookmarks folder in both
              directions, so they appear in address-bar autocomplete and travel
              between machines over the browser’s own bookmark sync. The folder
              is found wherever it already is, or created under one of the
              bookmark roots.
            </p>
            <p>
              The folder is the shared copy, so a favorite added, renamed or
              deleted on another machine is adopted here as soon as the browser
              syncs it. The panel only overrides the folder for a favorite you
              have just added here. Saving below writes your edits into the
              actual bookmarks so they sync onward.
            </p>
          </SettingsHelp>
          {bookmarkSyncStatus ? (
            <p className={classes.description}>
              <strong>Bookmark sync:</strong> {bookmarkSyncStatus}
            </p>
          ) : null}
          <FavoritesEditor pages={starredPages} onSave={onSaveStarredPages} />
        </>
      )}

      {activeTab === 'token' && (
        <>
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
              <span style={{ color: 'var(--color-text-secondary)' }}>
                · expires {formatExpiry(patRecord.expiresAt)}
              </span>
            )}
            {patDeviceId && (
              <div style={{ color: 'var(--color-text-subtle)', marginTop: 2 }}>
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
            <Button
              onClick={() => void handleRotatePat()}
              disabled={patAction !== 'idle'}
              description="Mint a new token now and revoke the current one"
            >
              {patAction === 'rotating' ? 'Rotating…' : 'Rotate now'}
            </Button>
            <Button
              onClick={() => void handleRevokeAll()}
              disabled={patAction !== 'idle'}
              description="Revoke every token this extension has minted, on every machine"
            >
              {patAction === 'revoking' ? 'Revoking…' : 'Revoke all'}
            </Button>
            <Button
              onClick={() => void handleClearPatData()}
              disabled={patAction !== 'idle'}
              description="Wipe stored PAT and device ID so the extension starts fresh on next sign-in"
            >
              Clear PAT data
            </Button>
          </div>
          {patActionMessage && (
            <span
              style={{
                fontSize: 12,
                color: /failed|error/i.test(patActionMessage)
                  ? 'var(--color-danger)'
                  : 'var(--color-success)',
                marginTop: 6,
                display: 'block',
                fontWeight: 500
              }}
            >
              {patActionMessage}
            </span>
          )}
        </>
      )}

      {activeTab === 'theme' && (
        <>
          <SettingsHelp summary="About theme colours">
            <p>
              The panel follows Azure DevOps&apos;s light/dark setting — the
              switch at the top right changes it for both. These are the colours
              each theme uses; change one and it applies to the panel and to the
              favorites palette. Only what you change is stored, so anything
              left alone keeps following the defaults.
            </p>
          </SettingsHelp>

          <ThemeEditor
            settings={settings}
            activeTheme={activeTheme}
            onChange={onChange}
          />
        </>
      )}

      {activeTab === 'maintenance' && (
        <>
          <SettingsHelp summary="About tab icons">
            <p>
              Re-scrape the Azure DevOps section icons from the live page and
              persist them for instant loading. The active tab must be an Azure
              DevOps page.
            </p>
          </SettingsHelp>

          <div className={classes.buttonRow}>
            <Button
              onClick={() => void handleRefreshIcons()}
              disabled={refreshingIcons}
              description="Re-scrape the section icons from the Azure DevOps page in front"
            >
              {refreshingIcons ? 'Refreshing…' : 'Refresh tab icons'}
            </Button>
            {iconRefreshStatus && (
              <span className={classes.helperText}>{iconRefreshStatus}</span>
            )}
          </div>

          <ShortcutStatus />

          <div className={classes.buttonRow}>
            <Button
              onClick={() => {
                window.location.reload();
              }}
              description="Reload this panel only, keeping the extension as it is"
            >
              Reload panel
            </Button>
            <Button
              onClick={onReloadExtension}
              description="Reload the whole extension, which service worker changes need"
            >
              Reload extension
            </Button>
          </div>
        </>
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
  if (!record) return 'var(--color-text-subtle)';
  const msLeft = record.expiresAt - Date.now();
  if (msLeft <= 0) return 'var(--color-danger)';
  if (msLeft < EXPIRING_SOON_MS) return 'var(--color-warning)';
  return 'var(--color-success)';
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
