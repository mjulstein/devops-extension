[root](../../README.md) / [specs](../README.md) / [ideas](./README.md) / separate-open-closed-work-item-results.md

# Idea: Separate Open And Closed Work Item Result Types

**Status**: Incubating  
**Created**: 2026-03-17  
**Source**: Conversation note about modeling open and closed work item results separately and enabling more independent refresh behavior

## Summary

Explore splitting the current combined work-items snapshot into more explicit open and closed result section types.

Today the shared DTO keeps `openItems`, `closedItems`, and `closedDateRange` together in one `WorkItemResult`. This idea would make the open and closed sections more strongly typed and better aligned with their different behaviors.

## Why It Might Matter

- Open items and closed items have different semantics and refresh triggers.
- Only the closed section depends on the selected closed-date range.
- Closed items require `closedDate`; open items do not.
- Stronger section-specific types could make later partial refresh, caching, and loading-state work simpler.

## User-Facing Flow

At first, the Work items tab could still render as one screen, but the implementation would internally treat:

- TODO/open items as a current-work section
- Closed items as a date-range-bound history section

Later, if the UX grows more section-specific controls, the app could refresh open items and closed items independently while still presenting them together in the same tab.

## Scope Notes

- In scope: exploring separate `OpenWorkItem` / `ClosedWorkItem` shapes or section DTOs, clarifying where `closedDateRange` belongs, and evaluating partial refresh support.
- Out of scope: committing right now to a separate endpoint, service worker message, or cache entry for each section.

## Open Questions

- Should the next step be separate item types inside one top-level snapshot, or fully separate top-level DTOs?
- Should open and closed sections eventually have separate loading states and cache entries?
- If partial refresh is added, should the fetch request support scopes such as `all`, `open`, or `closed`?
- How much UI complexity is acceptable before this idea should be promoted into a numbered spec?

## Risks Or Constraints

- Splitting the transport contract too early could add message, cache, and state-management churn without enough UX payoff.
- The side panel currently treats the Work items tab as one snapshot, so a staged migration would be lower risk than a full contract split.
- Any change should preserve browser-local cache compatibility in `src/sidepanel/chromeStorage.ts`.

## Promotion Checklist

- [ ] Goal is clear enough to describe in a spec
- [ ] Acceptance scenarios are concrete enough to test
- [ ] Dependencies and sequencing are understood well enough to plan
- [ ] This idea is ready to move into `specs/###-feature-name/`

