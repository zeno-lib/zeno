---
"@zeno-lib/schema": minor
---

`insert` and `update` check the format of a string-mode `date` or `timestamp` column, where Drizzle's bridge only asked for a string. A date must be a calendar date (`2026-09-17`). A timestamp takes a calendar date and a time, ISO 8601 or the text Postgres returns (`2026-09-17 07:53:56.357127+00`); one with a time zone needs its offset, and one without refuses an offset, which Postgres would drop. Both take `infinity` and `-infinity`, and an array column's elements go unchecked. The messages are Zod's own, so its locale applies. `select` stays unchecked.
