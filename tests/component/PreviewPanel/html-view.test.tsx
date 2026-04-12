/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

// Must set window.api BEFORE importing the component (module-level cache)
const mockReadFile = vi.fn().mockResolvedValue('<html><body><h1>Hello</h1></body></html>');
beforeAll(() => {
  (window as any).api = { readFile: mockReadFile };
});

describe('HtmlView', () => {
  it('uses srcDoc instead of file:// src', async () => {
    // Dynamic import to ensure window.api is set first
    const { HtmlView } = await import('@/renderer/components/PreviewPanel/HtmlView');
    const { container } = render(<HtmlView file="/path/to/test.html" />);

    // Initially loading
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for readFile to resolve
    await vi.waitFor(() => {
      const iframe = container.querySelector('iframe');
      expect(iframe).toBeTruthy();
      // Must use srcDoc, NOT src with file:// protocol
      expect(iframe?.getAttribute('srcdoc')).toContain('<h1>Hello</h1>');
      expect(iframe?.getAttribute('src')).toBeNull();
    });

    expect(mockReadFile).toHaveBeenCalledWith('/path/to/test.html');
  });
});
