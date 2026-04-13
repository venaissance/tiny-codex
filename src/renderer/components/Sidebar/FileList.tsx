import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

interface FileEntry {
  name: string;
  isDirectory: boolean;
}

// --- Icon mapping ---
function getFileIcon(name: string, isDirectory: boolean): string {
  if (isDirectory) return '\uD83D\uDCC1'; // 📁
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return '\uD83D\uDFE8'; // 🟨
    case 'css':
    case 'scss':
    case 'less':
      return '\uD83C\uDFA8'; // 🎨
    case 'md':
    case 'mdx':
      return '\uD83D\uDCDD'; // 📝
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return '\uD83D\uDDBC\uFE0F'; // 🖼️
    case 'json':
      return '\uD83D\uDCCA'; // 📊
    case 'html':
    case 'htm':
      return '\uD83C\uDF10'; // 🌐
    default:
      return '\uD83D\uDCC4'; // 📄
  }
}

// --- Tree node state ---
interface TreeNode {
  name: string;
  fullPath: string;
  isDirectory: boolean;
  depth: number;
  children?: TreeNode[];
  expanded?: boolean;
  loading?: boolean;
}

// --- Context menu state ---
interface ContextMenuState {
  x: number;
  y: number;
  targetPath: string;
  targetIsDir: boolean;
}

// --- FileTreeItem ---
function FileTreeItem({
  node,
  isSelected,
  onClick,
  onToggle,
  onContextMenu,
  onDoubleClickName,
  renamingPath,
  renameValue,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  searchQuery,
}: {
  node: TreeNode;
  isSelected: boolean;
  onClick: () => void;
  onToggle: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDoubleClickName: () => void;
  renamingPath: string | null;
  renameValue: string;
  onRenameChange: (val: string) => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  searchQuery: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isRenaming = renamingPath === node.fullPath;

  useEffect(() => {
    if (isSelected) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Hide if search query doesn't match (only for files; directories always show if they have matching children -- handled at parent level)
  if (searchQuery && !node.isDirectory && !node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
    return null;
  }

  const paddingLeft = 4 + node.depth * 16;

  return (
    <div
      ref={ref}
      className="sidebar-item"
      data-active={isSelected ? 'true' : 'false'}
      data-testid="file-tree-item"
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        fontSize: 12,
        padding: '4px 10px',
        paddingLeft,
        cursor: node.isDirectory ? 'pointer' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {/* Expand arrow for directories */}
      {node.isDirectory ? (
        <span
          data-testid="expand-arrow"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          style={{
            display: 'inline-flex',
            width: 14,
            fontSize: 10,
            cursor: 'pointer',
            userSelect: 'none',
            flexShrink: 0,
            justifyContent: 'center',
            transition: 'transform 0.12s',
            transform: node.expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          &#9654;
        </span>
      ) : (
        <span style={{ display: 'inline-block', width: 14, flexShrink: 0 }} />
      )}

      {/* File icon */}
      <span data-testid="file-icon" style={{ fontSize: 12, flexShrink: 0 }}>
        {getFileIcon(node.name, node.isDirectory)}
      </span>

      {/* Name or rename input */}
      {isRenaming ? (
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRenameConfirm();
            if (e.key === 'Escape') onRenameCancel();
          }}
          onBlur={onRenameCancel}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            fontSize: 12,
            padding: '1px 4px',
            background: 'var(--input-bg)',
            border: '1px solid var(--accent)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <span
          onDoubleClick={(e) => {
            e.stopPropagation();
            onDoubleClickName();
          }}
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {node.name}
        </span>
      )}

      {node.loading && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>...</span>
      )}
    </div>
  );
}

// --- Main FileList ---
export function FileList({
  projectPath,
  selectedFile,
  onSelectFile,
  refreshKey,
}: {
  projectPath: string | null;
  selectedFile?: string | null;
  onSelectFile?: (filePath: string) => void;
  refreshKey?: number;
}) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const api = (window as any).api;

  // Load root files
  useEffect(() => {
    if (!projectPath) {
      setTree([]);
      return;
    }
    setLoading(true);
    if (api?.listFiles) {
      api.listFiles(projectPath).then((result: FileEntry[]) => {
        setTree(
          (result || []).map((f) => ({
            name: f.name,
            fullPath: `${projectPath}/${f.name}`,
            isDirectory: f.isDirectory,
            depth: 0,
            expanded: false,
            children: undefined,
          })),
        );
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setTree([]);
      setLoading(false);
    }
  }, [projectPath, refreshKey]);

  // Toggle expand/collapse directory
  const toggleDir = useCallback(async (targetPath: string) => {
    const updateNodes = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((node) => {
        if (node.fullPath === targetPath) {
          if (node.expanded) {
            // Collapse
            return { ...node, expanded: false, children: undefined };
          }
          // Expand -- load children
          return { ...node, loading: true };
        }
        if (node.children) {
          return { ...node, children: updateNodes(node.children) };
        }
        return node;
      });

    setTree((prev) => updateNodes(prev));

    // Load children
    if (api?.listFiles) {
      try {
        const entries: FileEntry[] = await api.listFiles(targetPath);
        const findNode = (nodes: TreeNode[]): TreeNode | undefined => {
          for (const n of nodes) {
            if (n.fullPath === targetPath) return n;
            if (n.children) {
              const found = findNode(n.children);
              if (found) return found;
            }
          }
          return undefined;
        };

        setTree((prev) => {
          const node = findNode(prev);
          if (!node || node.expanded) return prev; // was already collapsed in the meantime

          const depth = (node.depth ?? 0) + 1;
          const children = (entries || []).map((f) => ({
            name: f.name,
            fullPath: `${targetPath}/${f.name}`,
            isDirectory: f.isDirectory,
            depth,
            expanded: false,
            children: undefined,
          }));

          const update = (nodes: TreeNode[]): TreeNode[] =>
            nodes.map((n) => {
              if (n.fullPath === targetPath) {
                return { ...n, expanded: true, loading: false, children };
              }
              if (n.children) {
                return { ...n, children: update(n.children) };
              }
              return n;
            });

          return update(prev);
        });
      } catch {
        // revert loading state
        setTree((prev) => {
          const revert = (nodes: TreeNode[]): TreeNode[] =>
            nodes.map((n) => {
              if (n.fullPath === targetPath) {
                return { ...n, loading: false };
              }
              if (n.children) {
                return { ...n, children: revert(n.children) };
              }
              return n;
            });
          return revert(prev);
        });
      }
    }
  }, [api]);

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, path: string, isDir: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, targetPath: path, targetIsDir: isDir });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Rename
  const startRename = useCallback((path: string, name: string) => {
    setRenamingPath(path);
    setRenameValue(name);
  }, []);

  const isConfirmingRef = useRef(false);

  const confirmRename = useCallback(async () => {
    if (isConfirmingRef.current) return;
    isConfirmingRef.current = true;
    try {
      if (!renamingPath || !renameValue.trim()) {
        setRenamingPath(null);
        return;
      }
      const parentDir = renamingPath.substring(0, renamingPath.lastIndexOf('/'));
      const newPath = `${parentDir}/${renameValue.trim()}`;
      if (newPath !== renamingPath && api?.renameFile) {
        await api.renameFile(renamingPath, newPath);
        setTree((prev) => {
          const update = (nodes: TreeNode[]): TreeNode[] =>
            nodes.map((n) => {
              if (n.fullPath === renamingPath) {
                return { ...n, name: renameValue.trim(), fullPath: newPath };
              }
              if (n.children) {
                return { ...n, children: update(n.children) };
              }
              return n;
            });
          return update(prev);
        });
        onSelectFile?.(newPath);
        window.dispatchEvent(new CustomEvent('file-changed'));
      }
      setRenamingPath(null);
    } finally {
      isConfirmingRef.current = false;
    }
  }, [renamingPath, renameValue, api, onSelectFile]);

  const cancelRename = useCallback(() => {
    if (isConfirmingRef.current) return; // Don't cancel during confirm
    setRenamingPath(null);
  }, []);

  // Delete with confirmation
  const handleDelete = useCallback(async (path: string) => {
    const name = path.split('/').pop() ?? path;
    if (!window.confirm(`Delete "${name}"?`)) return;
    if (api?.deleteFile) {
      await api.deleteFile(path);
      setTree((prev) => {
        const remove = (nodes: TreeNode[]): TreeNode[] =>
          nodes.filter((n) => n.fullPath !== path).map((n) => {
            if (n.children) {
              return { ...n, children: remove(n.children) };
            }
            return n;
          });
        return remove(prev);
      });
      window.dispatchEvent(new CustomEvent('file-changed'));
    }
  }, [api]);

  // Create file/dir — add to tree, enter rename mode, dispatch refresh
  const handleCreateFile = useCallback(async (parentPath: string) => {
    const name = 'untitled';
    const filePath = `${parentPath}/${name}`;
    if (api?.createFile) {
      await api.createFile(filePath);
      // Find parent depth
      const findDepth = (nodes: TreeNode[]): number => {
        for (const n of nodes) {
          if (n.fullPath === parentPath) return n.depth + 1;
          if (n.children) { const d = findDepth(n.children); if (d >= 0) return d; }
        }
        return 0;
      };
      const depth = parentPath === projectPath ? 0 : findDepth(tree);
      const newNode: TreeNode = { name, fullPath: filePath, isDirectory: false, depth, expanded: false };

      setTree((prev) => {
        const insert = (nodes: TreeNode[]): TreeNode[] =>
          nodes.map((n) => {
            if (n.fullPath === parentPath && n.children) {
              return { ...n, children: [...n.children, newNode] };
            }
            if (n.children) return { ...n, children: insert(n.children) };
            return n;
          });
        return parentPath === projectPath ? [...prev, newNode] : insert(prev);
      });
      // Enter rename mode so user can name the file
      startRename(filePath, name);
      window.dispatchEvent(new CustomEvent('file-changed'));
    }
  }, [api, tree, projectPath, startRename]);

  const handleCreateDir = useCallback(async (parentPath: string) => {
    const name = 'new-folder';
    const dirPath = `${parentPath}/${name}`;
    if (api?.createDir) {
      await api.createDir(dirPath);
      const findDepth = (nodes: TreeNode[]): number => {
        for (const n of nodes) {
          if (n.fullPath === parentPath) return n.depth + 1;
          if (n.children) { const d = findDepth(n.children); if (d >= 0) return d; }
        }
        return 0;
      };
      const depth = parentPath === projectPath ? 0 : findDepth(tree);
      const newNode: TreeNode = { name, fullPath: dirPath, isDirectory: true, depth, expanded: false };

      setTree((prev) => {
        const insert = (nodes: TreeNode[]): TreeNode[] =>
          nodes.map((n) => {
            if (n.fullPath === parentPath && n.children) {
              return { ...n, children: [newNode, ...n.children] };
            }
            if (n.children) return { ...n, children: insert(n.children) };
            return n;
          });
        return parentPath === projectPath ? [newNode, ...prev] : insert(prev);
      });
      startRename(dirPath, name);
      window.dispatchEvent(new CustomEvent('file-changed'));
    }
  }, [api, tree, projectPath, startRename]);

  // Copy path
  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard?.writeText(path);
  }, []);

  // Build context menu items
  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (!contextMenu) return [];
    const { targetPath, targetIsDir } = contextMenu;
    const items: ContextMenuItem[] = [];

    const parentDir = targetIsDir ? targetPath : targetPath.substring(0, targetPath.lastIndexOf('/'));
    items.push({ label: 'New File', action: () => handleCreateFile(parentDir) });
    items.push({ label: 'New Folder', action: () => handleCreateDir(parentDir) });
    items.push({
      label: 'Rename',
      action: () => {
        const name = targetPath.split('/').pop() || '';
        startRename(targetPath, name);
      },
    });
    items.push({ label: 'Delete', action: () => handleDelete(targetPath) });
    items.push({ label: 'Copy Path', action: () => handleCopyPath(targetPath) });
    return items;
  }, [contextMenu, handleCreateFile, handleCreateDir, handleDelete, handleCopyPath, startRename]);

  // Filter nodes by search query (recursive)
  const filterNodes = useCallback((nodes: TreeNode[]): TreeNode[] => {
    if (!searchQuery) return nodes;
    return nodes.filter((node) => {
      if (node.name.toLowerCase().includes(searchQuery.toLowerCase())) return true;
      if (node.isDirectory && node.children) {
        return filterNodes(node.children).length > 0;
      }
      return false;
    });
  }, [searchQuery]);

  // Flatten tree to renderable list
  const renderTree = useCallback((nodes: TreeNode[]): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    const filtered = filterNodes(nodes);

    for (const node of filtered) {
      result.push(
        <FileTreeItem
          key={node.fullPath}
          node={node}
          isSelected={selectedFile === node.fullPath}
          onClick={() => {
            if (node.isDirectory) {
              toggleDir(node.fullPath);
            } else {
              onSelectFile?.(node.fullPath);
            }
          }}
          onToggle={() => toggleDir(node.fullPath)}
          onContextMenu={(e) => handleContextMenu(e, node.fullPath, node.isDirectory)}
          onDoubleClickName={() => startRename(node.fullPath, node.name)}
          renamingPath={renamingPath}
          renameValue={renameValue}
          onRenameChange={setRenameValue}
          onRenameConfirm={confirmRename}
          onRenameCancel={cancelRename}
          searchQuery={searchQuery}
        />,
      );
      if (node.expanded && node.children) {
        result.push(...renderTree(node.children));
      }
    }
    return result;
  }, [filterNodes, selectedFile, onSelectFile, toggleDir, handleContextMenu, startRename, renamingPath, renameValue, confirmRename, cancelRename, searchQuery]);

  if (!projectPath) {
    return <div style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-muted)' }}>No project opened</div>;
  }

  if (loading) {
    return <div style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Loading...</div>;
  }

  return (
    <div>
      {/* Search filter */}
      <div style={{ padding: '4px 8px', position: 'relative' }}>
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            fontSize: 12,
            padding: '4px 24px 4px 8px',
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        {searchQuery && (
          <span
            data-testid="search-clear"
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--text-muted)',
              lineHeight: 1,
            }}
          >
            &#10005;
          </span>
        )}
      </div>

      {/* File tree */}
      {tree.length === 0 && (
        <div style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Empty</div>
      )}
      {renderTree(tree)}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
