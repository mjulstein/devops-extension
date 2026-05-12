[root](../README.md) / specs

# Specs

This directory stores promoted feature specs and the incubator for ideas that are not ready to become active implementation work.

## Files in this directory

Promoted features live in numbered subdirectories such as `specs/001-feature-name/`.

## Subdirectories

- [`001-api-sidepanel-tab`](./001-api-sidepanel-tab/spec.md) — promoted feature spec with plan/task breakdown for the new `API` sidepanel tab covering authenticated Azure DevOps request testing, console logging, copy helpers, and saved request macros.
- [`ideas`](./ideas) — incubator for rough feature ideas before they are promoted into numbered spec folders.

## Promotion Flow

1. Capture rough feature concepts in `specs/ideas/`.
2. Promote an idea into `specs/###-feature-name/` when goals, acceptance scenarios, and sequencing are clear enough to plan.
3. Add `spec.md` first, then `plan.md` and `tasks.md` when the work is ready to be broken down.
4. Use the optional helper prompts in [`.specify/commands`](../.specify/commands/README.md) when your tooling supports repo-local planning commands.


