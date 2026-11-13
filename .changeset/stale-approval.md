---
"@zeno-lib/ai": minor
---

`toAiSdkTools` refuses an approved write when its record changed after the user approved it. Before the write runs, `describeChange` reads the record again; if the change no longer matches the one the approval showed, the write is not saved and the model reads the change as it is now, so it can ask again. A route that leaves `toolApproval` out still asks before each write, but the approved write is now refused, since the approval showed no change.
