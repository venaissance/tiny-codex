/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MessageHistory } from '@/renderer/components/ChatPanel/MessageHistory';

// Mock MarkdownRenderer to avoid Streamdown dependency in tests
vi.mock('@/renderer/components/ChatPanel/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="markdown">{text}</div>,
}));

// Mock zustand store for AgentStateIndicator
vi.mock('@/renderer/stores/thread-store', () => ({
  useThreadStore: Object.assign(
    (selector: any) => selector({ agentState: 'idle', agentStep: 0, agentToolName: null, isStreaming: false }),
    { getState: () => ({ agentState: 'idle', agentStep: 0, agentToolName: null, isStreaming: false }) },
  ),
}));

describe('MessageHistory', () => {
  it('renders user message', () => {
    const messages = [
      { role: 'user', content: [{ type: 'text', text: 'Hello world' }] },
    ];
    render(<MessageHistory messages={messages} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders assistant text message via markdown', () => {
    const messages = [
      { role: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] },
    ];
    render(<MessageHistory messages={messages} />);
    expect(screen.getByTestId('markdown')).toHaveTextContent('Hi there!');
  });

  it('renders tool use + tool result as process block', () => {
    const messages = [
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'call-1', name: 'bash', input: { command: 'ls' } },
        ],
      },
      {
        role: 'tool',
        content: [
          { type: 'tool_result', toolUseId: 'call-1', content: 'file1.txt\nfile2.txt' },
        ],
      },
    ];
    render(<MessageHistory messages={messages} />);
    expect(screen.getByText('Used bash')).toBeInTheDocument();
  });

  it('renders thinking block in process', () => {
    const messages = [
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'Let me think about this...' },
          { type: 'text', text: 'Done thinking' },
        ],
      },
    ];
    render(<MessageHistory messages={messages} />);
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('renders streaming text when streaming', () => {
    render(<MessageHistory messages={[]} streamingText="partial response..." />);
    expect(screen.getByTestId('markdown')).toHaveTextContent('partial response...');
  });

  it('renders multiple user/assistant messages in order', () => {
    const messages = [
      { role: 'user', content: [{ type: 'text', text: 'First' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Response 1' }] },
      { role: 'user', content: [{ type: 'text', text: 'Second' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Response 2' }] },
    ];
    render(<MessageHistory messages={messages} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getAllByTestId('markdown')).toHaveLength(2);
  });
});
