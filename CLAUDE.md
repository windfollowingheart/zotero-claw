# ZoteroClaw Agent Guidelines

## UI Notifications

Always use `ztoolkit.ProgressWindow` for user notifications (success/failure messages) instead of simple logging.

Example:

```typescript
// Success notification
new ztoolkit.ProgressWindow("ZoteroClaw")
  .createLine({
    type: "success",
    text: "✅  Operation completed",
    progress: 100,
  })
  .show(2000);

// Failure notification
new ztoolkit.ProgressWindow("ZoteroClaw")
  .createLine({
    type: "error",
    text: "❌  Operation failed",
    progress: 100,
  })
  .show(2000);
```

## Project Info

This is a Zotero plugin built with zotero-plugin-toolkit.
