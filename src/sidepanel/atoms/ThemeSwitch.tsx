import clsx from 'clsx';
import classes from './ThemeSwitch.module.css';
import type { AdoTheme } from '@/devops/theme';

interface ThemeSwitchProps {
  theme: AdoTheme;
  /**
   * False while the theme is unknown or unreachable — without a connection the
   * switch cannot read or change Azure DevOps's setting, and a control that
   * silently does nothing is worse than a disabled one.
   */
  isEnabled: boolean;
  isBusy: boolean;
  onToggle: () => void;
}

export function ThemeSwitch({
  theme,
  isEnabled,
  isBusy,
  onToggle
}: ThemeSwitchProps) {
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className={clsx(classes.button, isBusy && classes.busy)}
      disabled={!isEnabled || isBusy}
      aria-pressed={theme === 'dark'}
      aria-label={`Switch Azure DevOps to ${next} mode`}
      title={
        isEnabled
          ? `Azure DevOps is in ${theme} mode. Switch to ${next}.`
          : 'Connect to Azure DevOps to change its theme.'
      }
      onClick={onToggle}
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}
