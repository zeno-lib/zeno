// The approval card as one HTML document: the host's default CSP allows inline
// scripts and styles and no other origin, so everything is inline.
import script from "./card.ts?inline-script"

// The host's theme variables, with fallbacks for a host that sends none.
const style = `
:root {
  color-scheme: light dark;
  --zeno-text: var(--color-text-primary, light-dark(#1a1a1a, #f2f2f2));
  --zeno-muted: var(--color-text-secondary, light-dark(#5c5c5c, #b0b0b0));
  --zeno-surface: var(--color-background-primary, light-dark(#fff, #1f1f1f));
  --zeno-subtle: var(--color-background-secondary, light-dark(#f5f5f5, #2a2a2a));
  --zeno-border: var(--color-border-primary, light-dark(#d9d9d9, #3d3d3d));
  --zeno-danger: var(--color-text-danger, light-dark(#b42318, #ff8a80));
  --zeno-success: var(--color-text-success, light-dark(#05794d, #6ee7b7));
  --zeno-accent: var(--color-text-primary, light-dark(#1a1a1a, #f2f2f2));
  --zeno-on-accent: var(--color-background-primary, light-dark(#fff, #1f1f1f));
  --zeno-radius: var(--border-radius-md, 8px);
  font-family: var(--font-sans, system-ui, sans-serif);
  font-size: var(--font-text-md-size, 14px);
  line-height: 1.45;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--zeno-surface); color: var(--zeno-text); }
main { padding: 16px; display: grid; gap: 12px; }
#eyebrow { margin: 0; color: var(--zeno-muted); font-size: 0.85em; }
h1 { margin: 0; font-size: 1.1em; font-weight: 600; overflow-wrap: anywhere; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { padding: 6px 8px; text-align: start; vertical-align: top; border-top: 1px solid var(--zeno-border); overflow-wrap: anywhere; }
thead th { border-top: 0; color: var(--zeno-muted); font-weight: 500; font-size: 0.85em; }
tbody th { font-weight: 500; }
td { font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.9em; }
td.old { color: var(--zeno-muted); }
#note { margin: 0; color: var(--zeno-muted); }
#actions { display: flex; gap: 8px; }
button { font: inherit; padding: 6px 14px; border-radius: var(--zeno-radius); border: 1px solid var(--zeno-border); background: var(--zeno-subtle); color: var(--zeno-text); cursor: pointer; }
button.primary { background: var(--zeno-accent); border-color: var(--zeno-accent); color: var(--zeno-on-accent); }
button:disabled { opacity: 0.6; cursor: default; }
button:focus-visible { outline: 2px solid var(--zeno-accent); outline-offset: 2px; }
#status { margin: 0; min-height: 1.45em; color: var(--zeno-muted); }
#status[data-tone="danger"] { color: var(--zeno-danger); }
#status[data-tone="success"] { color: var(--zeno-success); }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
[hidden] { display: none !important; }
`

/** The approval card's HTML, served as the card's UI resource. */
export const cardHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Change approval</title>
<style>${style}</style>
</head>
<body>
<main aria-labelledby="entity">
<p id="eyebrow">Proposed change</p>
<h1 id="entity">Loading the change…</h1>
<table id="changes" hidden>
<caption class="visually-hidden">Each field this change sets, before and after</caption>
<thead><tr><th scope="col">Field</th><th scope="col">Now</th><th scope="col">After</th></tr></thead>
<tbody id="rows"></tbody>
</table>
<p id="note" hidden></p>
<div id="actions" hidden>
<button id="confirm" class="primary" type="button">Confirm</button>
<button id="cancel" type="button">Cancel</button>
</div>
<p id="status" role="status" aria-live="polite"></p>
</main>
<script type="module">${script}</script>
</body>
</html>
`
