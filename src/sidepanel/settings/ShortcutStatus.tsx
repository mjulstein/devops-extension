import { useEffect, useState } from 'react';
import classes from './SettingsCard.module.css';
import {
  describeActiveTab,
  readActiveTab,
  type ActiveTabReading
} from '../activeTabDiagnostics';
import {
  describeShortcutRun,
  diagnoseShortcut,
  readShortcutRun,
  readStarredSearchBinding,
  SHORTCUT_RUN_KEY,
  type ShortcutBinding,
  type ShortcutRun
} from '../shortcutDiagnostics';

/**
 * What the browser actually bound for the starred-search shortcut.
 *
 * Shown in the panel because the alternative is the service worker's console,
 * which is several clicks into a page most people never open — and an unbound
 * command looks identical to a broken feature from the outside.
 */
export function ShortcutStatus() {
  const [binding, setBinding] = useState<ShortcutBinding | null>(null);
  const [run, setRun] = useState<ShortcutRun | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTabReading | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      readStarredSearchBinding(),
      readShortcutRun(),
      readActiveTab()
    ]).then(([nextBinding, nextRun, nextTab]) => {
      if (!cancelled) {
        setBinding(nextBinding);
        setRun(nextRun);
        setActiveTab(nextTab);
        setIsLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The panel is usually already open when the shortcut is pressed, so the
  // reading has to update in place — reopening Settings to check would hide the
  // very case being diagnosed.
  useEffect(() => {
    const storage = globalThis.chrome?.storage;
    if (!storage?.onChanged) {
      return;
    }
    function onChanged(changes: Record<string, { newValue?: unknown }>) {
      const change = changes[SHORTCUT_RUN_KEY];
      if (change) {
        setRun((change.newValue as ShortcutRun | undefined) ?? null);
      }
    }
    storage.onChanged.addListener(onChanged);
    return () => {
      storage.onChanged.removeListener(onChanged);
    };
  }, []);

  if (!isLoaded) {
    return null;
  }

  const diagnosis = diagnoseShortcut(binding);

  return (
    <div className={classes.helperText}>
      <strong>Favorites shortcut:</strong> {diagnosis.text}{' '}
      {diagnosis.settingsUrl && (
        // Rendered as text, not a link: the browser blocks an extension page
        // from navigating to its own settings pages, so a link would do
        // nothing. The address has to be pasted into the address bar.
        <code>{diagnosis.settingsUrl}</code>
      )}
      <div>{describeShortcutRun(run)}</div>
      {activeTab && (
        <div>
          <strong>Active tab:</strong> {describeActiveTab(activeTab)}
        </div>
      )}
    </div>
  );
}
