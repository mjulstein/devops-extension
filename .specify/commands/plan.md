[root](../../README.md) / [.specify](../README.md) / [commands](./README.md) / plan.md

# `/plan`

Use this command when a numbered spec is ready to be broken down into implementation sequencing and delivery details.

## Goals

- map the spec into implementation phases
- call out impacted modules, storage changes, tests, and documentation updates
- preserve repository boundaries such as `src/content-script.ts` staying generic and Azure DevOps logic living under `src/devops/`

## Command Checklist

1. Review the target `spec.md` in `specs/###-feature-name/`.
2. Review [`.specify/memory/constitution.md`](../memory/constitution.md) and any relevant repository docs.
3. Start from [`.specify/templates/plan-template.md`](../templates/plan-template.md).
4. Create `plan.md` in the same spec folder.
5. If execution is ready to be decomposed further, follow with [`.specify/templates/tasks-template.md`](../templates/tasks-template.md) for `tasks.md`.
6. Highlight validation expectations such as `npm run lint`, `npm test`, and `npm run build` when implementation begins.

## Expected Output

A plan that sequences the work into coherent steps, calls out key technical constraints, and prepares the spec for task breakdown and implementation.

