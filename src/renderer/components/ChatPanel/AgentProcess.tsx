import React, { useState } from 'react';
import { useThreadStore, type AgentStepState } from '../../stores/thread-store';

export interface ProcessStep {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text';
  icon: string;
  label: string;
  detail?: string;
  content?: string;
}

function AgentStateIndicator() {
  const agentState = useThreadStore((s) => s.agentState);
  const toolName = useThreadStore((s) => s.agentToolName);
  const isStreaming = useThreadStore((s) => s.isStreaming);
  const streamingText = useThreadStore((s) => s.streamingText);

  // Show whenever streaming and no text output yet (i.e., waiting for LLM or running tools)
  if (!isStreaming) return null;
  // Hide once LLM starts outputting text
  if (streamingText) return null;

  let icon = '';
  let label = '';
  let sublabel = '';

  if (agentState === 'tool_calling' && toolName) {
    icon = '\u26A1';
    label = toolName;
    sublabel = toolName === 'bash' ? 'Executing command...'
      : toolName === 'read_file' ? 'Reading file...'
      : toolName === 'write_file' ? 'Writing file...'
      : toolName === 'str_replace' ? 'Editing file...'
      : toolName === 'glob' ? 'Searching files...'
      : toolName === 'grep' ? 'Searching content...'
      : 'Running...';
  } else {
    // Default: thinking/reflecting/waiting — always show brain
    icon = '\uD83E\uDDE0';
    label = 'Thinking';
    sublabel = agentState === 'reflecting' ? 'Processing results...' : 'Analyzing your request...';
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', margin: '8px 0',
      background: 'var(--surface-hover)',
      borderRadius: 12,
      border: '1px solid var(--border-subtle)',
    }}>
      <div className="thinking-shimmer" style={{ fontSize: 20, lineHeight: 1 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sublabel}</div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
        <span className="thinking-dot" style={{ animationDelay: '0s' }} />
        <span className="thinking-dot" style={{ animationDelay: '0.2s' }} />
        <span className="thinking-dot" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  );
}

export { AgentStateIndicator };

export function AgentProcess({ steps, summary, isActive = false }: { steps: ProcessStep[]; summary: string; isActive?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Collapsed summary */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 13, padding: '4px 0',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 11, transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
        <span className={isActive && summary.includes('Thinking') ? 'thinking-shimmer' : ''}>{summary}</span>
      </div>

      {/* Expanded timeline */}
      {expanded && (
        <div style={{
          borderLeft: '2px solid var(--border)',
          marginLeft: 6,
          paddingLeft: 16,
          marginTop: 4,
        }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              position: 'relative',
              paddingBottom: i < steps.length - 1 ? 12 : 4,
              fontSize: 13,
            }}>
              {/* Timeline dot */}
              <div style={{
                position: 'absolute', left: -22, top: 3,
                width: 10, height: 10, borderRadius: '50%',
                background: step.type === 'tool_result' ? 'var(--success)' :
                             step.type === 'thinking' ? 'var(--text-muted)' : 'var(--accent)',
                border: '2px solid var(--surface-bg)',
              }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                <span>{step.icon}</span>
                <span>{step.label}</span>
                {step.detail && <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 'auto' }}>{step.detail}</span>}
              </div>

              {/* Tool result or thinking content - collapsible */}
              {step.content && (
                <div style={{
                  marginTop: 6,
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontFamily: "'SF Mono', Menlo, monospace",
                  color: 'var(--text-secondary)',
                  maxHeight: 150,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {step.content.length > 500 ? step.content.slice(0, 500) + '...' : step.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
