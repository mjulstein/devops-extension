import { useState } from 'react';
import { Button } from '@/sidepanel/atoms/Button';
import { createTabGroup } from '@/sidepanel/tabGroups';
import type { TabGroupSetting } from '@/types';
import classes from './SettingsCard.module.css';
import rows from '@/sidepanel/tabs/TabGroupList.module.css';

interface TabGroupsEditorProps {
  groups: TabGroupSetting[];
  onChange: (groups: TabGroupSetting[]) => void;
}

/**
 * The domains whose tabs get a group of their own, and how each is narrowed.
 *
 * A domain is all it takes to start, because a domain is the thing you can name
 * without looking anything up. The narrowing comes after you have seen what
 * lands in the group — which is why adding one asks for nothing else, and the
 * rules are edited on the group afterwards.
 *
 * Past a bare domain the field is a pattern: `wiki.*` followed by `/spaces`, `localhost:3000`,
 * `http://*:1234/path`. `*` stands for any run of characters, a port counts as
 * part of the address, and the scheme is https unless another is typed.
 */
export function TabGroupsEditor({ groups, onChange }: TabGroupsEditorProps) {
  const [domain, setDomain] = useState('');

  function update(index: number, next: TabGroupSetting): void {
    onChange(groups.map((group, at) => (at === index ? next : group)));
  }

  return (
    <div>
      <div className={classes.buttonRow}>
        <input
          className={classes.textInput}
          value={domain}
          placeholder="example.com or http://localhost:3000"
          aria-label="Domain or pattern to group tabs for"
          onChange={(event) => {
            setDomain(event.target.value);
          }}
        />
        <Button
          disabled={domain.trim() === ''}
          onClick={() => {
            onChange([...groups, createTabGroup(domain)]);
            setDomain('');
          }}
        >
          Add domain
        </Button>
      </div>

      {/* Keyed by position on purpose: a group's domain and a rule's match are
          both editable and can be empty or duplicated mid-typing, so neither is
          an identity. Position is — the rules are ordered and the first match
          wins, and removal is by position too. */}
      {groups.map((group, index) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key
        <section key={`${group.domain}:${index}`} className={classes.help}>
          <div className={rows.row}>
            <Button
              size="compact"
              variant="quiet"
              icon="✕"
              description={`Remove the ${group.label} group`}
              onClick={() => {
                onChange(groups.filter((_, at) => at !== index));
              }}
            />
            <input
              className={classes.textInput}
              value={group.label}
              aria-label={`Name of the ${group.domain} group`}
              onChange={(event) => {
                update(index, { ...group, label: event.target.value });
              }}
            />
          </div>
          <span className={classes.helperText}>{group.domain}</span>

          {group.rules.map((rule, ruleIndex) => (
            // eslint-disable-next-line @eslint-react/no-array-index-key
            <div key={ruleIndex} className={rows.row}>
              <Button
                size="compact"
                variant="quiet"
                icon="✕"
                description={`Remove the ${rule.label || rule.match} split`}
                onClick={() => {
                  update(index, {
                    ...group,
                    rules: group.rules.filter((_, at) => at !== ruleIndex)
                  });
                }}
              />
              <div className={classes.fieldRow}>
                <input
                  className={classes.textInput}
                  value={rule.label}
                  placeholder="Name"
                  aria-label="Name of this split"
                  onChange={(event) => {
                    update(index, {
                      ...group,
                      rules: group.rules.map((entry, at) =>
                        at === ruleIndex
                          ? { ...entry, label: event.target.value }
                          : entry
                      )
                    });
                  }}
                />
                <input
                  className={classes.textInput}
                  value={rule.match}
                  placeholder="wiki. or /spaces/"
                  aria-label="Sub-domain or path this split matches"
                  onChange={(event) => {
                    update(index, {
                      ...group,
                      rules: group.rules.map((entry, at) =>
                        at === ruleIndex
                          ? { ...entry, match: event.target.value }
                          : entry
                      )
                    });
                  }}
                />
              </div>
            </div>
          ))}

          <Button
            size="compact"
            variant="quiet"
            onClick={() => {
              update(index, {
                ...group,
                rules: [...group.rules, { label: '', match: '' }]
              });
            }}
          >
            Add a split
          </Button>
        </section>
      ))}
    </div>
  );
}
