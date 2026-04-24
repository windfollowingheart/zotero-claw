# ZoteroClaw Agent Guidelines

## UI Notifications

Always use `ztoolkit.ProgressWindow` for user notifications (success/failure messages) instead of simple logging.

Example:
```typescript
// Success notification
new ztoolkit.ProgressWindow("ZoteroClaw")
  .createLine({
    type: "success",
    text: "Operation completed",
  })
  .show();

// Failure notification
new ztoolkit.ProgressWindow("ZoteroClaw")
  .createLine({
    type: "fail",
    text: "Operation failed",
  })
  .show();
```

## Project Info

This is a Zotero plugin built with zotero-plugin-toolkit.