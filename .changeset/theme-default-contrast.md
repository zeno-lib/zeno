---
"@zeno-lib/ui": patch
---

Restore the `theme` registry item's earlier control, focus and muted text values. Raising them to WCAG 2.2's 3:1 for control edges drew every input, select, checkbox and radio with a heavy grey frame, and moved the dark popover and hover fills, which made dense forms harder to scan for no gain in legibility. Text keeps its contrast: muted text stays readable on every surface. Run `shadcn add zeno-lib/zeno/theme` again to pick it up.

| Token | Light | Dark |
|---|---|---|
| `--input` | gray-200 | white at 15% |
| `--ring` | gray-400 | gray-500 |
| `--sidebar-ring` | gray-400 | gray-600 |
| `--muted-foreground` | gray-500 | gray-400 (unchanged) |
| `--accent` | gray-100 (unchanged) | gray-700 |
| `--popover` | white (unchanged) | gray-800 |
