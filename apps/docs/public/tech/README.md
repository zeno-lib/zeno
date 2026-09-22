Technology marks from TechIcons (https://github.com/gui-bus/TechIcons), MIT licensed;
see LICENSE in this folder.

They are NOT used as shipped. Upstream each mark sits on a filled 256x256 rounded
tile (#1F222C dark / #E8E8E8 light) and embeds a raster image, so ten marks in two
variants run to ~1.2MB. Here the tile path is stripped and only the mark is kept,
rasterised to a transparent 96px PNG: ~77KB in total.

Folder names describe the BACKGROUND the mark is drawn for, not the mark itself.
Upstream a file is named for the tile it sat on, so the mark inside contrasts with
it, which inverts the mapping:

  on-light/  <- upstream Light/  dark marks, for the light theme
  on-dark/   <- upstream Dark/   light marks, for the dark theme

Regenerating: strip /<path d="M0 25C0 11.1929[^"]*" fill="#[0-9A-Fa-f]{6}"\/>/ from
the source SVG, then rasterise the remainder at 96x96.
