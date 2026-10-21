---
"@zeno-lib/schema": minor
---

`insert` and `update` check the format of a string-mode `date` or `timestamp` column, where Drizzle's bridge only asked for a string. A date must be a calendar date (`2026-09-17`). A timestamp takes ISO 8601 or the text Postgres returns (`2026-09-17 07:53:56.357127+00`), and one with a time zone needs its offset. The messages are Zod's own, so its locale applies. `select` stays unchecked.
