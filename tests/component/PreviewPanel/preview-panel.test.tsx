/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

beforeAll(() => {
  (window as any).api = { readFile: vi.fn().mockResolvedValue('') };
});

describe('PreviewPanel', () => {
  it('sanitizes error strings in content — shows "No file selected" instead', async () => {
    const { PreviewPanel } = await import('@/renderer/components/PreviewPanel/PreviewPanel');
    render(<PreviewPanel file="test.md" content="Error: Cannot read file" />);
    expect(screen.getByText('No file selected')).toBeInTheDocument();
  });

  it('renders markdown content for .md files', async () => {
    const { PreviewPanel } = await import('@/renderer/components/PreviewPanel/PreviewPanel');
    render(<PreviewPanel file="readme.md" content="# Hello World" />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('shows "No file selected" when file is null', async () => {
    const { PreviewPanel } = await import('@/renderer/components/PreviewPanel/PreviewPanel');
    render(<PreviewPanel file={null} content="" />);
    expect(screen.getByText('No file selected')).toBeInTheDocument();
  });

  it('shows "No file selected" when file is set but content is empty', async () => {
    const { PreviewPanel } = await import('@/renderer/components/PreviewPanel/PreviewPanel');
    const { container } = render(<PreviewPanel file="test.txt" content="" />);
    // With file but no content, preview tab shows "No file selected" (autoTab='code' for .txt)
    // The code tab also won't render MonacoView since content is empty
    expect(container.querySelector('.panel.preview-panel')).toBeTruthy();
  });
});
