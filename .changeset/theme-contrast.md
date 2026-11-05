---
"@zeno-lib/ui": patch
---

Raise the contrast of the `theme` registry item so form controls, focus rings and muted text meet WCAG 2.2 (1.4.11 non-text contrast, 1.4.3 text contrast) in both themes. Run `shadcn add zeno-lib/zeno/theme` again to pick it up.

Light:

| Token | Before | After | After, ratio |
|---|---|---|---|
| `--input` | gray-200, 1.26:1 on white | `oklch(63.1% 0.012 57)` (between gray-400 and gray-500) | 3.50:1 on background, card and popover |
| `--ring` | gray-400, 2.59:1 on white | gray-500 | 4.81:1 on background, card and popover |
| `--sidebar-ring` | gray-400, 2.48:1 on sidebar | gray-500 | 4.61:1 on sidebar |
| `--muted-foreground` | gray-500, 4.41:1 on gray-100 | `oklch(53.1% 0.013 61)` (a fifth of the way to gray-600) | 5.27:1 on background, 4.83:1 on muted, secondary and accent |

Dark:

| Token | Before | After | After, ratio |
|---|---|---|---|
| `--input` | white at 15%, 1.48:1 on background | gray-500 | 4.11:1 on background, 3.64:1 on card, 3.16:1 on popover |
| `--ring` | gray-500, 3.16:1 on popover | gray-400 | 7.63:1 on background, 6.76:1 on card, 5.87:1 on popover |
| `--sidebar-ring` | gray-600, 2.29:1 on sidebar | gray-400 | 6.76:1 on sidebar |
| `--muted-foreground` | gray-400, 3.97:1 on accent | `oklch(74.9% 0.009 56)` (a quarter of the way to gray-300) | 8.83:1 on background, 6.79:1 on muted and secondary, 4.59:1 on accent |

Inputs, textareas, selects, checkboxes, radios and OTP slots draw their edge from `--input`, and the unchecked switch track fills with it, so they now stand out from the page. `--border` is unchanged: it draws dividers and card outlines, which carry no state. Because the primitives also derive fills from `--input` (`dark:bg-input/30`, `disabled:bg-input/50`), dark inputs and disabled inputs read a little lighter than before.

The solid focus border (`border-ring`) carries the 3:1. The primitives' 3px halo is `ring-ring/50`, half the token's opacity, so on its own it composites to 1.97:1 in light and 2.5:1 in dark.
