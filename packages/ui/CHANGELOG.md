# @zeno-lib/ui

## 0.0.2

### Patch Changes

- 85ac860: Raise the contrast of the `theme` registry item so form controls, focus rings and muted text meet WCAG 2.2 (1.4.11 non-text contrast, 1.4.3 text contrast) in both themes. Every token still points at a step of the gray scale. Run `shadcn add zeno-lib/zeno/theme` again to pick it up.
  
  Light:
  
  | Token | Before | After | After, ratio |
  |---|---|---|---|
  | `--input` | gray-200, 1.26:1 on white | gray-500 | 4.81:1 on background, card and popover |
  | `--ring` | gray-400, 2.59:1 on white | gray-600 | 7.64:1 on background, card and popover |
  | `--sidebar-ring` | gray-400, 2.48:1 on sidebar | gray-600 | 7.32:1 on sidebar |
  | `--muted-foreground` | gray-500, 4.41:1 on gray-100 | gray-600 | 7.64:1 on background, 7.01:1 on muted, secondary and accent |
  
  Dark:
  
  | Token | Before | After | After, ratio |
  |---|---|---|---|
  | `--input` | white at 15%, 1.48:1 on background | gray-500 | 4.11:1 on background, 3.64:1 on card and popover |
  | `--ring` | gray-500, 3.16:1 on popover | gray-400 | 7.63:1 on background, 6.76:1 on card and popover |
  | `--sidebar-ring` | gray-600, 2.29:1 on sidebar | gray-400 | 6.76:1 on sidebar |
  | `--accent` | gray-700 | gray-800 | gray-400 muted text on it goes from 3.97:1 to 5.87:1 |
  | `--popover` | gray-800 | gray-900 | Matches the card, so the gray-800 hover fill (`--accent`) still shows on it |
  
  Inputs, textareas, selects, checkboxes, radios and OTP slots draw their edge from `--input`, and the unchecked switch track fills with it, so they now stand out from the page. `--border` is unchanged: it draws dividers and card outlines, which carry no state. Because the primitives also derive fills from `--input` (`dark:bg-input/30`, `disabled:bg-input/50`), dark inputs and disabled inputs read a little lighter than before. Light muted text is a step darker. A popover over a card in dark mode now stands apart by its border and shadow only.
  
  The ring is a step darker than `--input` in light and a step lighter in dark, so focus changes the border. The solid focus border (`border-ring`) carries the 3:1. The primitives' 3px halo is `ring-ring/50`, half the token's opacity, so on its own it composites to 2.35:1 in light and 2.67:1 in dark.

## 0.0.1

### Patch Changes

- 439319c: First npm release
