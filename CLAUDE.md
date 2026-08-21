[root](./README.md) / CLAUDE.md

# CLAUDE.md

Entry point for Claude Code. The execution guide for this repo lives in
[`AGENTS.md`](./AGENTS.md) and is imported below — this file deliberately adds no
duplicate rules, so there is nothing here to drift out of sync.

@AGENTS.md

## Read these before non-trivial work

| Document | Why it matters |
| --- | --- |
| [`CONTEXT.md`](./CONTEXT.md) | Ubiquitous language for authentication. Use these exact terms — **PAT**, **Bearer token**, **rotate**, **token registry**, **connected** — and respect the _Avoid_ lists. Getting the vocabulary wrong here produces subtly wrong code. |
| [`docs/principles.md`](./docs/principles.md) | Non-negotiable project principles, including runtime-acquired credentials and replaceable provider adapters. |
| [`specs/`](./specs/README.md) | Promoted feature specs; [`specs/ideas/`](./specs/ideas/README.md) is the incubator. Check for an existing spec before designing something new. |

## Commands

| Task | Command |
| --- | --- |
| Build (extension → `dist/`) | `npm run build` |
| Dev server | `npm run dev` |
| Tests | `npm test` (Vitest, globals enabled) |
| Tests (watch) | `npm run test:watch` |
| Lint | `npm run lint` — `npm run lint:fix` to autofix, `npm run lint:strict` for zero-warning |
| Types | `npm run typecheck` |

Run `npm run lint`, `npm test`, and `npm run build` after non-trivial changes.

Install with `npm ci`, not `npm i` — it installs exactly what the lockfile pins.

## Hard constraints

- **This is a public repository.** Never version anything that could grant access to
  someone's Azure DevOps: PAT values, Bearer/JWT tokens, cookies, device ids, or real
  organization/project identifiers. All authentication material is minted at runtime
  and stored in `chrome.storage.local`. This binds every contributor, not just the
  repo owner — see [principles](./docs/principles.md) I.
- **Never hardcode** organization, project, or user names. They are hydrated from
  browser storage via `src/sidepanel/chromeStorage.ts`; defaults in
  `src/sidepanel/defaultSettings.ts` stay **empty**. Do not add a real value as a
  convenience default.
- **Keep the provider seam intact.** All Azure DevOps specifics — including the entire
  auth mechanism — live under `src/devops/`. The generic core (side panel, service
  worker message router) must not learn backend details.

## Orientation

The point of this extension is to cover shortcomings of the Azure DevOps web platform
and give at-a-glance insight into the user's own work. The runtime-PAT machinery exists
because the tenant's Bearer token expires unpredictably and would otherwise break that
glance several times a day — it is plumbing in service of the goal, not the goal.
