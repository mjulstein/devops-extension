import { Button } from '@/sidepanel/atoms/Button';
import type { AppFolder } from '@/sidepanel/appGroups';
import classes from './SettingsCard.module.css';

interface AppFoldersEditorProps {
  folders: AppFolder[];
  onOpenBookmarkManager: () => void;
}

/**
 * The app folders, which are also the tab groups.
 *
 * It mostly shows rather than edits, because the bookmarks in an app are the
 * few main ones — the addresses worth having on a machine with no extension —
 * and those are kept in the bookmark manager, not typed into a settings form.
 * Everything else you open on that app is grouped with it
 * anyway: the group's reach comes from what its bookmarks have in common, not
 * from bookmarking every page.
 *
 * So what this owes the user is the answer to "what does this group cover",
 * which is derived and therefore not written down anywhere they could read it.
 */
export function AppFoldersEditor({
  folders,
  onOpenBookmarkManager
}: AppFoldersEditorProps) {
  if (folders.length === 0) {
    return (
      <p className={classes.helperText}>
        No apps yet. Make a folder under <strong>Apps</strong> in your bookmarks
        and name it after a host, or press <strong>📌</strong> on anything under{' '}
        <strong>Other</strong> on the Tabs tab.
      </p>
    );
  }

  return (
    <div>
      {folders.map((folder) => (
        <FolderSummary key={folder.id} folder={folder} />
      ))}

      <div className={classes.buttonRow}>
        <Button variant="quiet" onClick={onOpenBookmarkManager}>
          Edit in the bookmark manager
        </Button>
      </div>
    </div>
  );
}

function FolderSummary({ folder }: { folder: AppFolder }) {
  return (
    <section>
      <div className={classes.sectionHeading}>{folder.name}</div>
      <span className={classes.helperText}>
        Every tab on {folder.name} · {folder.bookmarks.length} bookmark
        {folder.bookmarks.length === 1 ? '' : 's'}
      </span>
    </section>
  );
}
