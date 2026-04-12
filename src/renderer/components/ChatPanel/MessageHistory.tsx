import React, { useEffect, useRef } from 'react';
import { AgentProcess, AgentStateIndicator, type ProcessStep } from './AgentProcess';
import { CopyButton } from './CopyButton';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Message {
  role: string;
  content: Array<{ type: string; [key: string]: any }>;
}

function describeToolUse(name: string, input: any): string {
  const fileName = (p: string) => p?.split('/').pop() ?? p;
  switch (name) {
    case 'write_file': return `Wrote ${fileName(input?.path)}`;
    case 'read_file': return `Read ${fileName(input?.path)}`;
    case 'str_replace': return `Edited ${fileName(input?.path)}`;
    case 'bash': return `Ran \`${(input?.command ?? '').slice(0, 40)}\``;
    case 'list_dir': return `Listed ${fileName(input?.path) || 'files'}`;
    case 'glob': return `Searched ${input?.pattern ?? 'files'}`;
    case 'grep': return `Grep \`${(input?.pattern ?? '').slice(0, 30)}\``;
    case 'ask_user': return 'Asked user';
    default: return `Used ${name}`;
  }
}

type GroupedItem =
  | { type: 'user'; text: string }
  | { type: 'process'; steps: ProcessStep[]; summary: string }
  | { type: 'text'; text: string };

// Group consecutive assistant+tool messages into agent process blocks
function groupMessages(messages: Message[]): GroupedItem[] {
  const groups: GroupedItem[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === 'user') {
      const text = msg.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      groups.push({ type: 'user', text });
      i++;
      continue;
    }

    if (msg.role === 'assistant') {
      const hasToolUse = msg.content.some((c) => c.type === 'tool_use');

      if (hasToolUse) {
        // Collect this assistant message + following tool results into a process block
        const steps: ProcessStep[] = [];
        const toolDescriptions: string[] = [];

        for (const c of msg.content) {
          if (c.type === 'thinking') {
            steps.push({
              type: 'thinking',
              icon: '\uD83D\uDD50',
              label: c.thinking.slice(0, 80) + (c.thinking.length > 80 ? '...' : ''),
              content: c.thinking,
            });
          } else if (c.type === 'tool_use') {
            toolDescriptions.push(describeToolUse(c.name, c.input));
            steps.push({
              type: 'tool_call',
              icon: '\uD83D\uDD27',
              label: c.name,
              detail: JSON.stringify(c.input).slice(0, 60),
            });
          } else if (c.type === 'text' && c.text.trim()) {
            steps.push({ type: 'text', icon: '\uD83D\uDCAC', label: c.text.slice(0, 80) });
          }
        }
        i++;

        // Collect following tool result messages
        while (i < messages.length && messages[i].role === 'tool') {
          for (const c of messages[i].content) {
            steps.push({
              type: 'tool_result',
              icon: '\u2705',
              label: 'Result',
              content: typeof c.content === 'string' ? c.content : JSON.stringify(c.content),
            });
          }
          i++;
        }

        const summary = toolDescriptions.length > 0
          ? toolDescriptions.join(' \u2192 ')
          : 'Agent processing';

        groups.push({ type: 'process', steps, summary });
        continue;
      }

      // Plain text assistant message (final response)
      const textParts = msg.content.filter((c) => c.type === 'text').map((c) => c.text);
      const thinkingParts = msg.content.filter((c) => c.type === 'thinking');

      if (thinkingParts.length > 0) {
        const steps: ProcessStep[] = thinkingParts.map((c) => ({
          type: 'thinking' as const,
          icon: '\uD83D\uDD50',
          label: c.thinking.slice(0, 80) + '...',
          content: c.thinking,
        }));
        groups.push({ type: 'process', steps, summary: 'Thinking...' });
      }

      if (textParts.length > 0) {
        groups.push({ type: 'text', text: textParts.join('\n') });
      }
      i++;
      continue;
    }

    // Skip standalone tool messages (they should have been consumed above)
    if (msg.role === 'tool') {
      i++;
      continue;
    }

    i++;
  }

  return groups;
}

export function MessageHistory({ messages, streamingText, isStreaming: isStreamingProp = false }: { messages: Message[]; streamingText?: string; isStreaming?: boolean }) {
  const grouped = groupMessages(messages);
  const isStreaming = isStreamingProp;
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages or streaming text changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingText]);

  return (
    <div className="chat-messages">
      {grouped.map((group, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          {group.type === 'user' && (
            <div className="msg-user">{group.text}</div>
          )}
          {group.type === 'process' && (
            <AgentProcess steps={group.steps} summary={group.summary} isActive={isStreaming && i === grouped.length - 1} />
          )}
          {group.type === 'text' && (
            <div className="msg-assistant">
              <MarkdownRenderer text={group.text} />
              <CopyButton text={group.text} />
            </div>
          )}
        </div>
      ))}
      {/* Agent state indicator — shows between tool calls and during LLM thinking */}
      {isStreaming && <AgentStateIndicator />}
      {/* Streaming text — Streamdown handles animation + caret */}
      {isStreaming && streamingText && (
        <div style={{ marginBottom: 16 }}>
          <div className="msg-assistant">
            <MarkdownRenderer text={streamingText} streaming />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
