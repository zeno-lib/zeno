---
"@zeno-lib/forms": patch
---

`FormDialog`'s unsaved-changes prompt no longer outlives a successful save,
and no longer asks about changes that can't be saved:

- Cancel, ×, Escape or an outside press while a footer Save is still running
  opens the prompt, as before. If that save then succeeds, the prompt now
  closes with the dialog, `closeOnSubmit` or not. Before, it stayed open over
  the closed dialog, asking to save or discard changes that were already
  saved.
- A disabled dialog now closes without the prompt, and doesn't warn on page
  unload, since none of its changes can be saved. That holds whether the
  dialog's `disabled` or the form's `useForm({ disabled })` turns off its
  Save. A prompt that is already open when the dialog becomes disabled stays
  until the user answers, with its Save off.

Re-add the `form-dialog` item with the shadcn CLI to pick this up.
