import React, { useState } from 'react';

function parseCsv(text: string): string[][] {
  return text.trim().split('\n').map((row) => row.split(',').map((cell) => cell.trim()));
}

function JsonTree({ data, depth = 0 }: { data: any; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (typeof data !== 'object' || data === null) {
    return <span style={{ color: typeof data === 'string' ? 'var(--success)' : 'var(--warning)' }}>{JSON.stringify(data)}</span>;
  }

  const entries = Array.isArray(data)
    ? data.map((v, i) => [String(i), v] as const)
    : Object.entries(data);

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      <span onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer', color: 'var(--accent)' }}>
        {expanded ? '▼' : '▶'} {Array.isArray(data) ? `[${data.length}]` : `{${Object.keys(data).length}}`}
      </span>
      {expanded && entries.map(([key, val]) => (
        <div key={key} style={{ marginLeft: 16 }}>
          <span style={{ color: 'var(--accent-hover)' }}>"{key}"</span>: <JsonTree data={val} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}

export function CsvJsonView({ type, content }: { type: 'csv' | 'json'; content: string }) {
  if (type === 'csv') {
    const rows = parseCsv(content);
    const headers = rows[0] ?? [];
    const body = rows.slice(1);

    return (
      <div style={{ padding: 16, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{ padding: '6px 12px', borderBottom: '2px solid var(--input-border)', textAlign: 'left', color: 'var(--accent)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // JSON
  try {
    const data = JSON.parse(content);
    return (
      <div style={{ padding: 16, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)' }}>
        <JsonTree data={data} />
      </div>
    );
  } catch {
    return <pre style={{ padding: 16, color: 'var(--error)' }}>Invalid JSON</pre>;
  }
}
