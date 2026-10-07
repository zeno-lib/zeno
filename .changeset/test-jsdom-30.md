---
"@zeno-lib/test": patch
---

Update `jsdom` to 30.1.2. jsdom 30 supports Node `^22.22.2 || ^24.15.0 || >=26`,
so the React preset now needs at least Node 24.15 on the 24 line.
