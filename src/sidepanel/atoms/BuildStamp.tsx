import classes from './BuildStamp.module.css';

/**
 * The commit this panel was built from.
 *
 * Reloading an unpacked extension is easy to believe you have done, and a
 * panel that looks identical either way leaves no way to tell. The browser
 * draws the side panel's own header and an extension cannot write in it, so
 * the stamp sits at the end of the row of buttons below it.
 *
 * A trailing `+` means the build had uncommitted work in the tree, so the sha
 * names the commit it started from rather than what is running.
 */
export function BuildStamp() {
  return (
    <span
      className={classes.stamp}
      title={`Built from ${__BUILD_SHA__}`}
      aria-label={`Built from ${__BUILD_SHA__}`}
    >
      {__BUILD_SHA__}
    </span>
  );
}
