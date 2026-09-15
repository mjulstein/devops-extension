import clsx from 'clsx';
import classes from './ThemeSwitch.module.css';
import type { AdoTheme } from '@/devops/theme';

interface ThemeSwitchProps {
  theme: AdoTheme;
  /**
   * Whether Azure DevOps's own setting could be read. It changes what the
   * tooltip promises, not whether the switch works: the panel's appearance is
   * this panel's business, and refusing to restyle it because a REST call failed
   * would be the wrong trade.
   */
  isAdoReachable: boolean;
  isBusy: boolean;
  onToggle: () => void;
}

export function ThemeSwitch({
  theme,
  isAdoReachable,
  isBusy,
  onToggle
}: ThemeSwitchProps) {
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className={clsx(classes.button, isBusy && classes.busy)}
      aria-pressed={theme === 'dark'}
      aria-label={`Switch to ${next} mode`}
      title={
        isAdoReachable
          ? `In ${theme} mode, matching Azure DevOps. Switch to ${next}.`
          : `In ${theme} mode. Switch to ${next} — Azure DevOps's own setting could not be read, so this changes the panel only.`
      }
      onClick={onToggle}
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}
