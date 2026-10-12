import { useCallback } from 'react';
import classes from './ColumnSplitter.module.css';

interface ColumnSplitterProps {
  label: string;
  width: number;
  min: number;
  max: number;
  onResize: (width: number) => void;
  /** -1 when the column being sized is to the *right* of the handle. */
  direction?: 1 | -1;
}

const KEYBOARD_STEP = 24;

/**
 * The drag handle between two columns.
 *
 * Pointer events rather than mouse events, so a pen or a touch screen works the
 * same way, and the pointer is captured so the drag survives the cursor leaving
 * the four pixels of the handle — without that, a fast drag stops the moment it
 * outruns the element.
 *
 * It is also a real separator for the keyboard: arrow keys move it, because a
 * layout that can only be set by dragging cannot be set at all by someone who
 * does not drag.
 */
export function ColumnSplitter({
  label,
  width,
  min,
  max,
  onResize,
  direction = 1
}: ColumnSplitterProps) {
  const clamp = useCallback(
    (value: number) => Math.min(max, Math.max(min, value)),
    [max, min]
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      className={classes.splitter}
      onPointerDown={(event) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = width;
        const handle = event.currentTarget;
        handle.setPointerCapture(event.pointerId);

        const move = (moveEvent: PointerEvent) => {
          onResize(
            clamp(startWidth + (moveEvent.clientX - startX) * direction)
          );
        };
        const up = () => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', up);
          handle.removeEventListener('pointercancel', up);
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
        handle.addEventListener('pointercancel', up);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          onResize(clamp(width - KEYBOARD_STEP * direction));
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          onResize(clamp(width + KEYBOARD_STEP * direction));
        }
      }}
    />
  );
}
