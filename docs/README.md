# SignDocu Documentation Index

Long-form project documentation, organized by category.

## Documents in this folder

| Document | Covers |
|---|---|
| [`SPECS.md`](./SPECS.md) | Full data model, API surface, state management, legal posture, competitive analysis, roadmap |
| [`screenshots.md`](./screenshots.md) | Annotated visual walkthrough of the four-step signing flow with implementation notes per callout |

## [`design/`](./design/)

Implementation plans and design rationale for the major feature pillars. Each file is a stand-alone markdown doc — read in any order.

| Document | Pillar / topic |
|---|---|
| [`design/p5-market-ready.md`](./design/p5-market-ready.md) | Pillars 1–5 — Quick Sign, Native UX, Multi-Party signing, Offline marketing |
| [`design/premium-animations.md`](./design/premium-animations.md) | Animation system design rationale |

## Adjacent: [`../screenshots/`](../screenshots/)

Rendered SVG mockups of each flow step with numbered annotations. The four `.svg` files are referenced from the top-level [`README.md`](../README.md) and from [`screenshots.md`](./screenshots.md).

## Conventions

- Long-form **reference docs** (specs, tours) live directly in `docs/`.
- **Implementation plans and design rationale** live in `docs/design/`.
- Each plan file begins with a metadata table that lists its own location — keep that in sync when moving a file.
- Do not introduce new docs at the repository root. If you need a new category, add a sub-folder under `docs/` (e.g. `docs/architecture/`, `docs/runbook/`).
