/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FileList } from '@/renderer/components/Sidebar/FileList';

// Mock window.api
function createMockApi() {
  return {
    listFiles: vi.fn(),
    createFile: vi.fn(),
    createDir: vi.fn(),
    deleteFile: vi.fn(),
    renameFile: vi.fn(),
  };
}

let mockApi: ReturnType<typeof createMockApi>;

beforeEach(() => {
  mockApi = createMockApi();
  (window as any).api = mockApi;
  // Mock window.confirm for delete tests (happy-dom doesn't have it)
  window.confirm = vi.fn(() => true);
});

describe('FileList — flat rendering', () => {
  it('renders flat file list', async () => {
    mockApi.listFiles.mockResolvedValue([
      { name: 'index.ts', isDirectory: false },
      { name: 'style.css', isDirectory: false },
    ]);

    render(<FileList projectPath="/project" />);

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
      expect(screen.getByText('style.css')).toBeInTheDocument();
    });
  });
});

describe('FileList — folder expand/collapse', () => {
  it('shows folder expand arrow', async () => {
    mockApi.listFiles.mockResolvedValue([
      { name: 'src', isDirectory: true },
    ]);

    render(<FileList projectPath="/project" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });
    // The expand arrow should be present (a clickable chevron)
    const row = screen.getByText('src').closest('[data-testid="file-tree-item"]');
    expect(row).toBeInTheDocument();
    const arrow = row!.querySelector('[data-testid="expand-arrow"]');
    expect(arrow).toBeInTheDocument();
  });

  it('clicking folder expands to show children', async () => {
    // Root listing
    mockApi.listFiles.mockResolvedValueOnce([
      { name: 'src', isDirectory: true },
      { name: 'README.md', isDirectory: false },
    ]);
    // Children of src/
    mockApi.listFiles.mockResolvedValueOnce([
      { name: 'app.ts', isDirectory: false },
      { name: 'utils', isDirectory: true },
    ]);

    render(<FileList projectPath="/project" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    const row = screen.getByText('src').closest('[data-testid="file-tree-item"]')!;
    const arrow = row.querySelector('[data-testid="expand-arrow"]')!;
    await act(async () => {
      fireEvent.click(arrow);
    });

    await waitFor(() => {
      expect(screen.getByText('app.ts')).toBeInTheDocument();
      expect(screen.getByText('utils')).toBeInTheDocument();
    });
    expect(mockApi.listFiles).toHaveBeenCalledWith('/project/src');
  });

  it('clicking expanded folder collapses it', async () => {
    mockApi.listFiles.mockResolvedValueOnce([
      { name: 'src', isDirectory: true },
    ]);
    mockApi.listFiles.mockResolvedValueOnce([
      { name: 'app.ts', isDirectory: false },
    ]);

    render(<FileList projectPath="/project" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    const row = screen.getByText('src').closest('[data-testid="file-tree-item"]')!;
    const arrow = row.querySelector('[data-testid="expand-arrow"]')!;

    // Expand
    await act(async () => {
      fireEvent.click(arrow);
    });
    await waitFor(() => {
      expect(screen.getByText('app.ts')).toBeInTheDocument();
    });

    // Collapse
    await act(async () => {
      fireEvent.click(arrow);
    });
    await waitFor(() => {
      expect(screen.queryByText('app.ts')).not.toBeInTheDocument();
    });
  });
});

describe('FileList — file icons', () => {
  it('shows correct file icon by extension', async () => {
    mockApi.listFiles.mockResolvedValue([
      { name: 'main.ts', isDirectory: false },
      { name: 'style.css', isDirectory: false },
      { name: 'notes.md', isDirectory: false },
      { name: 'data.json', isDirectory: false },
      { name: 'index.html', isDirectory: false },
      { name: 'photo.png', isDirectory: false },
      { name: 'other.txt', isDirectory: false },
      { name: 'lib', isDirectory: true },
    ]);

    render(<FileList projectPath="/project" />);

    await waitFor(() => {
      expect(screen.getByText('main.ts')).toBeInTheDocument();
    });

    // Check icons by finding the icon span next to each name
    function getIcon(name: string) {
      const row = screen.getByText(name).closest('[data-testid="file-tree-item"]')!;
      return row.querySelector('[data-testid="file-icon"]')!.textContent;
    }

    expect(getIcon('main.ts')).toBe('\uD83D\uDFE8');    // 🟨
    expect(getIcon('style.css')).toBe('\uD83C\uDFA8');   // 🎨
    expect(getIcon('notes.md')).toBe('\uD83D\uDCDD');    // 📝
    expect(getIcon('data.json')).toBe('\uD83D\uDCCA');   // 📊
    expect(getIcon('index.html')).toBe('\uD83C\uDF10');  // 🌐
    expect(getIcon('photo.png')).toBe('\uD83D\uDDBC\uFE0F');   // 🖼️
    expect(getIcon('other.txt')).toBe('\uD83D\uDCC4');   // 📄
    expect(getIcon('lib')).toBe('\uD83D\uDCC1');         // 📁
  });
});

describe('FileList — indentation', () => {
  it('indentation increases with depth', async () => {
    mockApi.listFiles.mockResolvedValueOnce([
      { name: 'src', isDirectory: true },
    ]);
    mockApi.listFiles.mockResolvedValueOnce([
      { name: 'app.ts', isDirectory: false },
    ]);

    render(<FileList projectPath="/project" />);

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Expand src
    const row = screen.getByText('src').closest('[data-testid="file-tree-item"]')!;
    const arrow = row.querySelector('[data-testid="expand-arrow"]')!;
    await act(async () => {
      fireEvent.click(arrow);
    });

    await waitFor(() => {
      expect(screen.getByText('app.ts')).toBeInTheDocument();
    });

    // Root level (depth=0) should have paddingLeft of 4px (base)
    const srcRow = screen.getByText('src').closest('[data-testid="file-tree-item"]') as HTMLElement;
    // Child level (depth=1) should have more padding
    const childRow = screen.getByText('app.ts').closest('[data-testid="file-tree-item"]') as HTMLElement;

    const srcPadding = parseInt(srcRow.style.paddingLeft || '0');
    const childPadding = parseInt(childRow.style.paddingLeft || '0');
    expect(childPadding).toBeGreaterThan(srcPadding);
  });
});

describe('FileList — selection', () => {
  it('selected file has data-active="true"', async () => {
    mockApi.listFiles.mockResolvedValue([
      { name: 'index.ts', isDirectory: false },
      { name: 'style.css', isDirectory: false },
    ]);

    render(
      <FileList
        projectPath="/project"
        selectedFile="/project/index.ts"
        onSelectFile={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    const activeRow = screen.getByText('index.ts').closest('[data-active]') as HTMLElement;
    expect(activeRow?.getAttribute('data-active')).toBe('true');

    const inactiveRow = screen.getByText('style.css').closest('[data-active]') as HTMLElement;
    expect(inactiveRow?.getAttribute('data-active')).toBe('false');
  });
});

describe('FileList — context menu', () => {
  it('context menu appears on right-click', async () => {
    mockApi.listFiles.mockResolvedValue([
      { name: 'index.ts', isDirectory: false },
    ]);

    render(<FileList projectPath="/project" />);

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    const row = screen.getByText('index.ts').closest('[data-testid="file-tree-item"]')!;
    fireEvent.contextMenu(row);

    await waitFor(() => {
      expect(screen.getByTestId('context-menu')).toBeInTheDocument();
    });
  });

  it('context menu disappears on click outside', async () => {
    mockApi.listFiles.mockResolvedValue([
      { name: 'index.ts', isDirectory: false },
    ]);

    const { container } = render(<FileList projectPath="/project" />);

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    const row = screen.getByText('index.ts').closest('[data-testid="file-tree-item"]')!;
    fireEvent.contextMenu(row);

    await waitFor(() => {
      expect(screen.getByTestId('context-menu')).toBeInTheDocument();
    });

    // Click outside
    fireEvent.mouseDown(container);

    await waitFor(() => {
      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
    });
  });
});

describe('FileList — search filter', () => {
  it('search filter hides non-matching files', async () => {
    mockApi.listFiles.mockResolvedValue([
      { name: 'index.ts', isDirectory: false },
      { name: 'style.css', isDirectory: false },
      { name: 'app.ts', isDirectory: false },
    ]);

    render(<FileList projectPath="/project" />);

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search files...');
    fireEvent.change(searchInput, { target: { value: 'app' } });

    await waitFor(() => {
      expect(screen.getByText('app.ts')).toBeInTheDocument();
      expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
      expect(screen.queryByText('style.css')).not.toBeInTheDocument();
    });
  });

  it('clear button resets search', async () => {
    mockApi.listFiles.mockResolvedValue([
      { name: 'index.ts', isDirectory: false },
      { name: 'style.css', isDirectory: false },
    ]);

    render(<FileList projectPath="/project" />);

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search files...');
    fireEvent.change(searchInput, { target: { value: 'index' } });

    await waitFor(() => {
      expect(screen.queryByText('style.css')).not.toBeInTheDocument();
    });

    const clearBtn = screen.getByTestId('search-clear');
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
      expect(screen.getByText('style.css')).toBeInTheDocument();
    });
  });
});

describe('FileList — inline rename', () => {
  it('rename mode activates on double-click', async () => {
    mockApi.listFiles.mockResolvedValue([
      { name: 'index.ts', isDirectory: false },
    ]);

    render(<FileList projectPath="/project" />);

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    const nameSpan = screen.getByText('index.ts');
    fireEvent.doubleClick(nameSpan);

    await waitFor(() => {
      const input = screen.getByDisplayValue('index.ts');
      expect(input).toBeInTheDocument();
      expect(input.tagName.toLowerCase()).toBe('input');
    });
  });

  it('rename confirms on Enter', async () => {
    mockApi.listFiles.mockResolvedValue([
      { name: 'index.ts', isDirectory: false },
    ]);
    mockApi.renameFile.mockResolvedValue({ success: true });

    render(<FileList projectPath="/project" />);

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    const nameSpan = screen.getByText('index.ts');
    fireEvent.doubleClick(nameSpan);

    const input = screen.getByDisplayValue('index.ts');
    fireEvent.change(input, { target: { value: 'main.ts' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(mockApi.renameFile).toHaveBeenCalledWith(
      '/project/index.ts',
      '/project/main.ts',
    );
  });

  it('rename cancels on Escape', async () => {
    mockApi.listFiles.mockResolvedValue([
      { name: 'index.ts', isDirectory: false },
    ]);

    render(<FileList projectPath="/project" />);

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    const nameSpan = screen.getByText('index.ts');
    fireEvent.doubleClick(nameSpan);

    const input = screen.getByDisplayValue('index.ts');
    fireEvent.change(input, { target: { value: 'main.ts' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    // Should revert to original name, not call rename
    expect(mockApi.renameFile).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });
  });
});

describe('FileList — delete', () => {
  it('delete calls api.deleteFile from context menu', async () => {
    mockApi.listFiles.mockResolvedValue([
      { name: 'index.ts', isDirectory: false },
    ]);
    mockApi.deleteFile.mockResolvedValue({ success: true });

    render(<FileList projectPath="/project" />);

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    });

    const row = screen.getByText('index.ts').closest('[data-testid="file-tree-item"]')!;
    fireEvent.contextMenu(row);

    await waitFor(() => {
      expect(screen.getByTestId('context-menu')).toBeInTheDocument();
    });

    const deleteOption = screen.getByText('Delete');
    await act(async () => {
      fireEvent.click(deleteOption);
    });

    expect(mockApi.deleteFile).toHaveBeenCalledWith('/project/index.ts');
  });
});
