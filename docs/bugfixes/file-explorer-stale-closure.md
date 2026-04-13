# File Explorer Stale Closure Bug

## Symptom
Folder toggle worked once then stopped. Clicking a folder expanded it, but clicking again to collapse had no effect. Selecting a different file and coming back made it work once more.

## Root Cause
Two related bugs:
1. **find() returned boolean false for expanded nodes** — `find()` returned `false` (expanded=false) which was indistinguishable from "not found". Changed to `boolean | null` with `null` sentinel for "not found".
2. **useCallback stale closure** — `toggleDir` was in a `useCallback([api])` which captured an old `tree` state. Each render created new tree state but the callback still referenced the initial one.

## Fix
**treeRef pattern**: A ref (`treeRef`) is always synced with the latest tree state via a `setTree` wrapper. The `toggleDir` function reads from `treeRef.current` instead of the closure-captured `tree`.

```typescript
const treeRef = useRef(tree);
const setTreeWrapped = (newTree) => { treeRef.current = newTree; setTree(newTree); };
// In toggleDir: read treeRef.current, not tree
```

## Key Files
- `src/renderer/components/Sidebar/FileList.tsx`
