/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ProcessStep } from '@/renderer/components/ChatPanel/AgentProcess';

/* ---------- zustand store mock ---------- */

let mockState: Record<string, any> = {};

const defaultState = {
  agentState: 'idle',
  agentStep: 0,
  agentToolName: null,
  isStreaming: false,
  streamingText: '',
  streamingThinking: '',
};

vi.mock('@/renderer/stores/thread-store', () => ({
  useThreadStore: Object.assign(
    (selector: any) => selector(mockState),
    { getState: () => mockState },
  ),
}));

import { AgentStateIndicator, AgentProcess } from '@/renderer/components/ChatPanel/AgentProcess';

beforeEach(() => {
  mockState = { ...defaultState };
});

/* =========================================================
 * AgentStateIndicator
 * ========================================================= */

describe('AgentStateIndicator', () => {
  it('returns null when not streaming', () => {
    mockState = { ...defaultState, isStreaming: false };
    const { container } = render(<AgentStateIndicator />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when streamingText has content', () => {
    mockState = { ...defaultState, isStreaming: true, streamingText: 'Some output' };
    const { container } = render(<AgentStateIndicator />);
    expect(container.innerHTML).toBe('');
  });

  it('shows "Thinking" with brain icon when agentState=thinking, step 1', () => {
    mockState = {
      ...defaultState,
      isStreaming: true,
      agentState: 'thinking',
      agentStep: 1,
    };
    render(<AgentStateIndicator />);
    expect(screen.getByText('Thinking')).toBeInTheDocument();
    expect(screen.getByText('\uD83E\uDDE0')).toBeInTheDocument(); // brain emoji
  });

  it('shows step prefix and "Deciding next step..." when step > 1', () => {
    mockState = {
      ...defaultState,
      isStreaming: true,
      agentState: 'thinking',
      agentStep: 2,
    };
    render(<AgentStateIndicator />);
    expect(screen.getByText('Step 2 \u00B7 Thinking')).toBeInTheDocument();
    expect(screen.getByText('Deciding next step...')).toBeInTheDocument();
  });

  it('shows tool name when agentState=tool_calling', () => {
    mockState = {
      ...defaultState,
      isStreaming: true,
      agentState: 'tool_calling',
      agentStep: 1,
      agentToolName: 'write_file',
    };
    render(<AgentStateIndicator />);
    expect(screen.getByText('Step 1 \u00B7 write_file')).toBeInTheDocument();
    expect(screen.getByText('Writing file...')).toBeInTheDocument();
  });

  it('shows "Reflecting / Processing tool results..." when reflecting', () => {
    mockState = {
      ...defaultState,
      isStreaming: true,
      agentState: 'reflecting',
      agentStep: 3,
    };
    render(<AgentStateIndicator />);
    expect(screen.getByText('Step 3 \u00B7 Reflecting')).toBeInTheDocument();
    expect(screen.getByText('Processing tool results...')).toBeInTheDocument();
  });

  it('shows expand arrow when streamingThinking has content', () => {
    mockState = {
      ...defaultState,
      isStreaming: true,
      agentState: 'thinking',
      agentStep: 1,
      streamingThinking: 'Internal reasoning...',
    };
    render(<AgentStateIndicator />);
    // The arrow is &#9654; (U+25B6 right-pointing triangle)
    expect(screen.getByText('\u25B6')).toBeInTheDocument();
  });

  it('does NOT show expand arrow when streamingThinking is empty', () => {
    mockState = {
      ...defaultState,
      isStreaming: true,
      agentState: 'thinking',
      agentStep: 1,
      streamingThinking: '',
    };
    render(<AgentStateIndicator />);
    expect(screen.queryByText('\u25B6')).not.toBeInTheDocument();
  });

  it('clicking header toggles expanded thinking content', () => {
    mockState = {
      ...defaultState,
      isStreaming: true,
      agentState: 'thinking',
      agentStep: 1,
      streamingThinking: 'Deep thought about the problem',
    };
    render(<AgentStateIndicator />);

    // Not visible initially
    expect(screen.queryByText('Deep thought about the problem')).not.toBeInTheDocument();

    // Click header to expand
    fireEvent.click(screen.getByText('Thinking'));
    expect(screen.getByText('Deep thought about the problem')).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(screen.getByText('Thinking'));
    expect(screen.queryByText('Deep thought about the problem')).not.toBeInTheDocument();
  });

  it('shows thinking text in expanded section', () => {
    const thinkingContent = 'Analyzing the user request step by step...';
    mockState = {
      ...defaultState,
      isStreaming: true,
      agentState: 'thinking',
      agentStep: 1,
      streamingThinking: thinkingContent,
    };
    render(<AgentStateIndicator />);

    fireEvent.click(screen.getByText('Thinking'));
    const expanded = screen.getByText(thinkingContent);
    expect(expanded).toBeInTheDocument();
    expect(expanded).toHaveStyle({ whiteSpace: 'pre-wrap' });
  });
});

/* =========================================================
 * AgentProcess
 * ========================================================= */

describe('AgentProcess', () => {
  const sampleSteps: ProcessStep[] = [
    { type: 'thinking', icon: '\uD83E\uDDE0', label: 'Thinking...', content: 'Analyzing request' },
    { type: 'tool_call', icon: '\u26A1', label: 'bash', detail: 'ls -la' },
    { type: 'tool_result', icon: '\u2705', label: 'Result', content: 'file1.txt\nfile2.txt' },
  ];

  it('renders collapsed summary text', () => {
    render(<AgentProcess steps={sampleSteps} summary="Used 3 tools" />);
    expect(screen.getByText('Used 3 tools')).toBeInTheDocument();
    // Timeline should not be visible when collapsed
    expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
  });

  it('clicking summary toggles expanded timeline', () => {
    render(<AgentProcess steps={sampleSteps} summary="Used 3 tools" />);

    // Click to expand
    fireEvent.click(screen.getByText('Used 3 tools'));
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    expect(screen.getByText('bash')).toBeInTheDocument();
    expect(screen.getByText('Result')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByText('Used 3 tools'));
    expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
  });

  it('shows timeline dots with correct colors', () => {
    render(<AgentProcess steps={sampleSteps} summary="3 steps" />);
    fireEvent.click(screen.getByText('3 steps'));

    // Each step renders a dot div; query by computed background style
    const dots = document.querySelectorAll('[style*="border-radius: 50%"]');
    expect(dots).toHaveLength(3);

    // thinking -> var(--text-muted)
    expect((dots[0] as HTMLElement).style.background).toBe('var(--text-muted)');
    // tool_call -> var(--accent)
    expect((dots[1] as HTMLElement).style.background).toBe('var(--accent)');
    // tool_result -> var(--success)
    expect((dots[2] as HTMLElement).style.background).toBe('var(--success)');
  });

  it('renders tool result content in expanded view', () => {
    render(<AgentProcess steps={sampleSteps} summary="3 steps" />);
    fireEvent.click(screen.getByText('3 steps'));

    expect(screen.getByText(/file1\.txt/)).toBeInTheDocument();
    expect(screen.getByText(/file2\.txt/)).toBeInTheDocument();
    expect(screen.getByText('Analyzing request')).toBeInTheDocument();
  });

  it('shows shimmer class when isActive and summary contains "Thinking"', () => {
    const { rerender } = render(
      <AgentProcess steps={sampleSteps} summary="Thinking about it" isActive={true} />,
    );
    const summarySpan = screen.getByText('Thinking about it');
    expect(summarySpan.className).toContain('thinking-shimmer');

    // No shimmer when isActive=false
    rerender(<AgentProcess steps={sampleSteps} summary="Thinking about it" isActive={false} />);
    expect(screen.getByText('Thinking about it').className).not.toContain('thinking-shimmer');

    // No shimmer when summary does not contain "Thinking"
    rerender(<AgentProcess steps={sampleSteps} summary="Done processing" isActive={true} />);
    expect(screen.getByText('Done processing').className).not.toContain('thinking-shimmer');
  });
});
