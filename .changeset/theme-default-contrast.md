---
"@zeno-lib/ui": patch
---

The `theme` registry item now ships shadcn's stone defaults. Raising the control edge, focus ring and muted text to WCAG 2.2's 3:1 drew every input, select, checkbox and radio with a heavy grey frame, which made dense forms harder to scan for no gain in legibility, so they go back to shadcn's faint values. In dark, the popover, primary, hover fill and sidebar ring take shadcn's values too. Run `shadcn add zeno-lib/zeno/theme` again to pick it up.

| Token | Light | Dark |
|---|---|---|
| `--input` | gray-200 | white at 15% |
| `--ring` | gray-400 | gray-500 |
| `--sidebar-ring` | gray-400 | gray-500 |
| `--muted-foreground` | gray-500 | gray-400 |
| `--accent` | gray-100 | gray-800 |
| `--popover` | white | gray-900 |
| `--primary` | gray-900 | gray-200 |
