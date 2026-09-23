import clsx from 'clsx';
import type { ReactNode } from 'react';
import classes from './Button.module.css';

export type ButtonVariant = 'default' | 'primary' | 'quiet';
export type ButtonSize = 'default' | 'compact';

interface CommonButtonProps {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Set when the button toggles something, so its state is announced. */
  isPressed?: boolean;
  /**
   * Set when the button discloses a region rather than toggling a setting, with
   * `controls` naming that region. A disclosure announces expanded/collapsed,
   * which is a different thing from pressed and worth keeping distinct.
   */
  isExpanded?: boolean;
  controls?: string;
  /** Set when the button opens a menu, which is its own announcement. */
  hasPopup?: 'menu' | 'dialog' | 'listbox';
  type?: 'button' | 'submit';
  className?: string;
  title?: string;
  /** A leading glyph. Text or a description has to say what it means. */
  icon?: ReactNode;
}

/**
 * A button is either labelled or described, never neither.
 *
 * An icon on its own is a guess unless something says what it does, so the type
 * requires children (visible text) or a `description`. The description is also
 * the hover tooltip and the accessible name, which is why it is not optional for
 * an icon-only button: without it the button is unreadable to anyone using a
 * screen reader and ambiguous to everyone else.
 */
export type ButtonProps =
  | (CommonButtonProps & { children: ReactNode; description?: string })
  | (CommonButtonProps & { children?: undefined; description: string });

export function Button({
  children,
  description,
  icon,
  onClick,
  variant = 'default',
  size = 'default',
  disabled = false,
  isPressed,
  isExpanded,
  controls,
  hasPopup,
  type = 'button',
  className,
  title
}: ButtonProps) {
  const hasLabel = children !== undefined && children !== null;

  return (
    <button
      type={type}
      className={clsx(
        classes.button,
        variant === 'primary' && classes.primary,
        variant === 'quiet' && classes.quiet,
        size === 'compact' && classes.compact,
        !hasLabel && classes.iconOnly,
        className
      )}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isPressed}
      aria-expanded={isExpanded}
      aria-controls={controls}
      aria-haspopup={hasPopup}
      // The description doubles as the tooltip, so hovering explains an icon.
      title={title ?? description}
      aria-label={hasLabel ? undefined : description}
    >
      {icon !== undefined && (
        <span aria-hidden="true" className={classes.icon}>
          {icon}
        </span>
      )}
      {hasLabel && <span className={classes.label}>{children}</span>}
    </button>
  );
}
