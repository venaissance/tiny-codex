# File Explorer Rename/Create/Delete Not Working

## Symptom
- Rename: pressing Enter did nothing, clicking away canceled the rename
- Create File/Dir: created on disk but didn't appear in tree, no rename mode entered
- Delete: no confirmation, inconsistent behavior

## Root Cause
**Rename race condition**: `onBlur` fired before the async `confirmRename` could complete. The blur handler called `cancelRename`, discarding the pending rename.

**Create not visible**: File was created on disk via IPC but never inserted into the in-memory tree state. No rename mode was entered for the new node.

## Fix
- `isConfirmingRef` guard: `confirmRename` sets ref to `true` before async work; `cancelRename` checks flag before canceling
- Create: insert node into tree inline + auto-enter rename mode
- Delete: `window.confirm()` before deletion
- Context menu: New File/Folder available for files too (uses parent dir)

## Key Files
- `src/renderer/components/Sidebar/FileList.tsx`
