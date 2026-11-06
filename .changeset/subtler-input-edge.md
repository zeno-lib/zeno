---
"@zeno-lib/ui": patch
---

Lighten the `theme` registry item's light `--input` to the faintest edge that still meets WCAG 2.2's 3:1 for form controls. It was gray-500 (4.81:1 on white), which read heavy on dense forms. It is now `color-mix(in oklch, var(--color-gray-400) 60%, var(--color-gray-500))`: 3.29:1 on white and 3.15:1 on gray-50. No step of the gray scale sits there, since gray-400 reaches only 2.59:1. Dark mode is unchanged. Run `shadcn add zeno-lib/zeno/theme` again to pick it up.
