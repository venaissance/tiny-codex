/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SuggestionCards } from '@/renderer/components/ChatPanel/SuggestionCards';

describe('SuggestionCards', () => {
  it('renders nothing when no suggestions', () => {
    const { container } = render(<SuggestionCards suggestions={[]} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders suggestion buttons', () => {
    const suggestions = ['Fix the bug', 'Add tests', 'Refactor code'];
    render(<SuggestionCards suggestions={suggestions} onSelect={vi.fn()} />);
    expect(screen.getByText('Fix the bug')).toBeInTheDocument();
    expect(screen.getByText('Add tests')).toBeInTheDocument();
    expect(screen.getByText('Refactor code')).toBeInTheDocument();
  });

  it('calls onSelect when a suggestion is clicked', () => {
    const onSelect = vi.fn();
    render(<SuggestionCards suggestions={['Do something']} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Do something'));
    expect(onSelect).toHaveBeenCalledWith('Do something');
  });

  it('renders nothing when isStreaming is true', () => {
    const { container } = render(
      <SuggestionCards suggestions={['Test']} onSelect={vi.fn()} isStreaming={true} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('limits to max 3 suggestions', () => {
    const suggestions = ['A', 'B', 'C', 'D', 'E'];
    render(<SuggestionCards suggestions={suggestions} onSelect={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeLessThanOrEqual(3);
  });
});

describe('extractSuggestions', () => {
  // Import the extraction function
  let extractSuggestions: (text: string, toolNames: string[]) => string[];

  beforeAll(async () => {
    const mod = await import('@/renderer/components/ChatPanel/SuggestionCards');
    extractSuggestions = mod.extractSuggestions;
  });

  it('only extracts from HTML comment, not from body text', () => {
    const text = 'Would you like me to:\n1. Add images?\n2. Write another one?';
    const result = extractSuggestions(text, []);
    expect(result).toEqual([]);
  });

  it('extracts suggestions from HTML comment', () => {
    const text = 'Done! The file has been written.\n<!-- suggestions: ["Review the file", "Add tests"] -->';
    const result = extractSuggestions(text, []);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('Review the file');
    expect(result).toContain('Add tests');
  });

  it('returns empty for very short responses', () => {
    const result = extractSuggestions('OK', []);
    expect(result).toEqual([]);
  });
});
