# Screenshots — SignDocu Visual Tour

This folder contains annotated SVG mockups of the four-step SignDocu signing flow: **Upload → Sign → Place Fields → Export**.

Each file is a self-contained SVG that renders on GitHub, in VS Code Preview, and in any browser. They are sized for documentation (mobile-shape frame with side annotations) and use the production color tokens (`#2563eb` primary, `#f97316` accent, `#22c55e` success, `#06b6d4` secondary).

## Files

| # | File | Step | Highlights |
|---|------|------|------------|
| 01 | [`01-upload.svg`](./01-upload.svg) | **Upload** | Drag-drop, file picker, Smart Scan, Quick Photo |
| 02 | [`02-place.svg`](./02-place.svg) | **Place fields** | OCR auto-detect, 5 field types, drag/resize/pinch, templates |
| 03 | [`03-sign.svg`](./03-sign.svg) | **Create signature** | Draw · Type · Photo · Upload — Quick Sign mode |
| 04 | [`04-export.svg`](./04-export.svg) | **Download / share** | Paper-dust burst, SHA-256 audit certificate, native share sheet |

## How they're used

The main [`README.md`](../README.md) embeds these via relative paths:

```markdown
![Upload step](screenshots/01-upload.svg)
```

GitHub renders the SVG inline with full fidelity (gradients, text, callouts). No build step is needed.

For the full annotated walkthrough with implementation details, see [`docs/screenshots.md`](../docs/screenshots.md).

## Updating

If the UI changes meaningfully (new color, new component, new flow step), update the relevant `.svg` file. The mockups are hand-authored rather than screenshot captures so they stay diffable in git, lightweight (~5–8 KB each), and re-render correctly even when the dev server is offline.
