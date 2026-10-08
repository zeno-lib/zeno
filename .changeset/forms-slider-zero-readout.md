---
"@zeno-lib/forms": patch
---

`SliderField` renders a `formatValue` readout of `0` in its readout slot. It
tested the readout for truthiness, so a formatter returning the number `0` left
a bare "0" without the readout's styling.
