import { useState } from 'react';
import { Button } from '../sidepanel/atoms/Button';
import { SectionTabs } from '../sidepanel/atoms/SectionTabs';
import { BookmarkRow } from './BookmarkRow';
import {
  duplicateFolderNameGroups,
  duplicateNameGroups,
  duplicatePathGroups,
  emptyFolders,
  filterFolderGroups,
  filterFolders,
  filterGroups,
  flattenBookmarks,
  type BookmarkNode,
  type FolderEntry
} from './bookmarksModel';
import classes from './IssuesPanel.module.css';

type IssueTab =
  | 'duplicate-name'
  | 'duplicate-path'
  | 'duplicate-folder'
  | 'empty-folders';

interface IssuesPanelProps {
  /** The tree the lists describe: the whole thing, or the selected subtree. */
  tree: BookmarkNode[];
  /** Every folder, for the move controls, regardless of what is scoped. */
  folders: FolderEntry[];
  /** Names the scope in the heading, so a short list is never a mystery. */
  scopeLabel: string | null;
  /** Shows a row's folder in the tree, so a duplicate can be placed at a glance. */
  onReveal: (folderId: string) => void;
  /** The bulk selection, so a duplicate can be checked where it is found. */
  checkedIds: Set<string>;
  onToggleChecked: (id: string) => void;
  onEdit: (id: string, changes: { title: string; url: string }) => void;
  onDelete: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameFolder: (id: string, title: string) => void;
  onMove: (id: string, parentId: string) => void;
}

/**
 * The three lists of things worth fixing, one at a time.
 *
 * They are tabbed rather than stacked because they are all long and only one is
 * ever the job at hand; stacked, the one being worked on keeps being pushed off
 * screen by the other two. Each keeps its own filter, since a filter that
 * followed the tab switch would silently hide rows in a list you just opened.
 */
export function IssuesPanel({
  tree,
  folders,
  scopeLabel,
  onReveal,
  checkedIds,
  onToggleChecked,
  onEdit,
  onDelete,
  onDeleteFolder,
  onRenameFolder,
  onMove
}: IssuesPanelProps) {
  const [tab, setTab] = useState<IssueTab>('duplicate-name');
  const [filters, setFilters] = useState<Record<IssueTab, string>>({
    'duplicate-name': '',
    'duplicate-path': '',
    'duplicate-folder': '',
    'empty-folders': ''
  });

  const entries = flattenBookmarks(tree);
  const nameGroups = duplicateNameGroups(entries);
  const pathGroups = duplicatePathGroups(entries);
  const folderGroups = duplicateFolderNameGroups(tree);
  const empties = emptyFolders(tree);

  const filter = filters[tab];
  const setFilter = (value: string) => {
    setFilters((current) => ({ ...current, [tab]: value }));
  };

  const shownGroups =
    tab === 'duplicate-name'
      ? filterGroups(nameGroups, filter)
      : tab === 'duplicate-path'
        ? filterGroups(pathGroups, filter)
        : [];
  const shownFolders =
    tab === 'empty-folders' ? filterFolders(empties, filter) : [];
  const shownFolderGroups =
    tab === 'duplicate-folder' ? filterFolderGroups(folderGroups, filter) : [];

  return (
    <section className={classes.panel}>
      <SectionTabs
        tabs={[
          {
            id: 'duplicate-name',
            label: 'Duplicate name',
            count: nameGroups.length,
            title: 'Bookmarks sharing a title'
          },
          {
            id: 'duplicate-path',
            label: 'Duplicate path',
            count: pathGroups.length,
            title: 'Same address, ignoring search params, filed in two folders'
          },
          {
            id: 'duplicate-folder',
            label: 'Duplicate folder',
            count: folderGroups.length,
            title: 'Folders sharing a name'
          },
          {
            id: 'empty-folders',
            label: 'Empty folders',
            count: empties.length,
            title: 'Folders holding nothing'
          }
        ]}
        activeTab={tab}
        onSelectTab={setTab}
        label="Bookmark issues"
      />

      {scopeLabel ? (
        <p className={classes.scope}>
          Showing what is inside <strong>{scopeLabel}</strong>.
        </p>
      ) : null}

      <input
        className={classes.filter}
        value={filter}
        placeholder="Filter this list"
        aria-label="Filter this list"
        onChange={(event) => {
          setFilter(event.target.value);
        }}
      />

      {tab === 'duplicate-folder' ? (
        shownFolderGroups.length === 0 ? (
          <p className={classes.empty}>No folder name is used twice.</p>
        ) : (
          shownFolderGroups.map((group) => (
            <div key={group.key} className={classes.group}>
              <h3 className={classes.groupHeading}>{group.key}</h3>
              <ul className={classes.list}>
                {group.folders.map((folder) => (
                  <FolderIssueRow
                    key={folder.id}
                    folder={folder}
                    folders={folders}
                    onReveal={onReveal}
                    onRename={onRenameFolder}
                    onMove={onMove}
                  />
                ))}
              </ul>
            </div>
          ))
        )
      ) : tab === 'empty-folders' ? (
        shownFolders.length === 0 ? (
          <p className={classes.empty}>No empty folders.</p>
        ) : (
          <ul className={classes.list}>
            {shownFolders.map((folder) => (
              <FolderIssueRow
                key={folder.id}
                folder={folder}
                folders={folders}
                onReveal={onReveal}
                onDelete={onDeleteFolder}
                onRename={onRenameFolder}
                onMove={onMove}
              />
            ))}
          </ul>
        )
      ) : shownGroups.length === 0 ? (
        <p className={classes.empty}>Nothing to clean up here.</p>
      ) : (
        shownGroups.map((group) => (
          <div key={group.key} className={classes.group}>
            <h3 className={classes.groupHeading}>{group.key}</h3>
            <ul className={classes.list}>
              {group.entries.map((entry) => (
                <BookmarkRow
                  key={entry.id}
                  entry={entry}
                  folders={folders}
                  showFolder
                  onReveal={onReveal}
                  checked={checkedIds.has(entry.id)}
                  onToggleChecked={onToggleChecked}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMove={onMove}
                />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

interface FolderIssueRowProps {
  folder: FolderEntry;
  folders: FolderEntry[];
  onReveal: (folderId: string) => void;
  /**
   * Omitted where deleting is the wrong offer. A folder listed for a duplicated
   * name may be full, and a trash can beside it invites taking its contents with
   * it when the fix is a rename.
   */
  onDelete?: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onMove: (id: string, parentId: string) => void;
}

function FolderIssueRow({
  folder,
  folders,
  onReveal,
  onDelete,
  onRename,
  onMove
}: FolderIssueRowProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(folder.title);

  return (
    <li className={classes.folderRow}>
      <span aria-hidden="true">📁</span>
      {editing ? (
        <input
          className={classes.filter}
          value={title}
          aria-label="Folder name"
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
      ) : (
        <button
          type="button"
          className={classes.folderText}
          title="Show this folder in the tree"
          onClick={() => {
            onReveal(folder.id);
          }}
        >
          <span>{folder.title || '(untitled)'}</span>
          <span className={classes.folderPath}>{folder.path}</span>
        </button>
      )}
      <div className={classes.folderActions}>
        {editing ? (
          <>
            <Button
              variant="primary"
              size="compact"
              onClick={() => {
                onRename(folder.id, title.trim());
                setEditing(false);
              }}
            >
              Save
            </Button>
            <Button
              size="compact"
              onClick={() => {
                setTitle(folder.title);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <select
              className={classes.moveSelect}
              aria-label={`Move ${folder.title} into a folder`}
              title="Move into folder"
              value=""
              onChange={(event) => {
                if (event.target.value) {
                  onMove(folder.id, event.target.value);
                }
              }}
            >
              <option value="">Move to…</option>
              {folders
                .filter((candidate) => candidate.id !== folder.id)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.path
                      ? `${candidate.path} / ${candidate.title}`
                      : candidate.title}
                  </option>
                ))}
            </select>
            <Button
              size="compact"
              variant="quiet"
              icon="✏️"
              description={`Rename ${folder.title}`}
              onClick={() => {
                setEditing(true);
              }}
            />
            {onDelete ? (
              <Button
                size="compact"
                variant="quiet"
                icon="🗑"
                description={`Delete ${folder.title}`}
                onClick={() => {
                  onDelete(folder.id);
                }}
              />
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}
