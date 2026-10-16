---
"@zeno-lib/forms": patch
---

`FormDialog`'s unsaved-changes prompt no longer outlives its dialog or a
successful save, and no longer offers a Save that can't work:

- The prompt now closes whenever the dialog does. Before, a dialog closed
  while the prompt was open (a footer Save that succeeded, `dialog.close()`)
  left the prompt over the closed dialog, asking to save or discard changes
  that were already saved, and it showed again on the next open.
- Cancel, ×, Escape or an outside press while a footer Save is still running
  opens the prompt, as before. If that save succeeds and no field changed
  since, the leave now goes through and the dialog closes, `closeOnSubmit` or
  not. After an edit made during the save, the prompt stays until the user
  answers. If the save fails, the first invalid field gets focus once the
  prompt closes, as with the prompt's own Save.
- A dialog disabled by its `disabled` or by `useForm({ disabled })` still
  asks before discarding changes, but the prompt it opens is the discard
  one, without Save. A prompt that opened before the dialog became disabled
  keeps its Save, turned off.

Re-add the `form-dialog` item with the shadcn CLI to pick this up.
