import { useEffect, useState } from 'react';
import classes from './SettingsCard.module.css';
import {
  diagnoseShortcut,
  readStarredSearchBinding,
  type ShortcutBinding
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
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void readStarredSearchBinding().then((result) => {
      if (!cancelled) {
        setBinding(result);
        setIsLoaded(true);
      }
    });
    return () => {
      cancelled = true;
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
    </div>
  );
}
