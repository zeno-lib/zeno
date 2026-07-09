/**
 * Static configuration for the shadcn registry generator (`build-registry.ts`).
 *
 * Zeno does NOT re-distribute the shadcn primitives — end users install those from
 * shadcn directly. The registry only ships Zeno's value-add (auth flows, form fields,
 * `create-form`, the theme) plus any Zeno-*original* primitive with no shadcn equivalent.
 */

/**
 * Every component name published by the shadcn `base-nova` registry
 * (https://ui.shadcn.com/r/index.json). A `@zeno-lib/ui/<name>` import whose `<name>`
 * is in this set becomes a bare `registryDependency` (installed from shadcn); a name
 * NOT in this set is treated as a Zeno-original registry item.
 *
 * Snapshot — refresh with:
 *   curl -s https://ui.shadcn.com/r/index.json | jq -r '.[].name'
 */
export const SHADCN_COMPONENTS = new Set<string>([
  "accordion",
  "alert",
  "alert-dialog",
  "aspect-ratio",
  "attachment",
  "avatar",
  "badge",
  "breadcrumb",
  "bubble",
  "button",
  "button-group",
  "calendar",
  "card",
  "carousel",
  "chart",
  "checkbox",
  "collapsible",
  "combobox",
  "command",
  "context-menu",
  "dialog",
  "direction",
  "drawer",
  "dropdown-menu",
  "empty",
  "field",
  "form",
  "hover-card",
  "input",
  "input-group",
  "input-otp",
  "item",
  "kbd",
  "label",
  "marker",
  "menubar",
  "message",
  "message-scroller",
  "native-select",
  "navigation-menu",
  "pagination",
  "popover",
  "progress",
  "radio-group",
  "resizable",
  "scroll-area",
  "select",
  "separator",
  "sheet",
  "sidebar",
  "skeleton",
  "slider",
  "sonner",
  "spinner",
  "switch",
  "table",
  "tabs",
  "textarea",
  "toggle",
  "toggle-group",
  "tooltip",
])

/**
 * npm packages assumed already present in any consumer app — never emitted as
 * registry-item `dependencies`.
 */
export const ASSUMED_PRESENT = new Set<string>([
  "react",
  "react-dom",
  "next",
  "tailwindcss",
  "zod",
])

/**
 * Extra npm dependencies the import scan cannot see because they are used only via
 * type positions or indirectly. Keyed by registry item name.
 */
export const DEP_OVERRIDES: Record<string, string[]> = {}

/** Registry item names to skip entirely (e.g. dev-only or non-distributable). */
export const SKIP = new Set<string>([])

export const REPO = "zeno-lib/zeno"
export const HOMEPAGE = "https://github.com/zeno-lib/zeno"
