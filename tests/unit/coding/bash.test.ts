import { describe, it, expect } from 'vitest';
import { bashTool } from '@/coding/tools/bash';

describe('bash tool', () => {
  it('executes a simple command and returns stdout', async () => {
    const result = await bashTool.invoke({ command: 'echo hello' });
    expect(result.trim()).toBe('hello');
  });

  it('returns stderr on command failure', async () => {
    const result = await bashTool.invoke({ command: 'ls /nonexistent-path-xyz-123' });
    expect(result).toContain('No such file');
  });

  it('handles command that produces output', async () => {
    const result = await bashTool.invoke({ command: 'echo done' });
    expect(result.trim()).toBe('done');
  });

  it('truncates output exceeding 16000 chars', async () => {
    // Generate output larger than 16000 chars
    const result = await bashTool.invoke({ command: 'python3 -c "print(\'x\' * 20000)"' });
    expect(result.length).toBeLessThan(20000);
    expect(result).toContain('[Output truncated:');
    expect(result).toMatch(/\d+ chars total/);
  });

  it('does not truncate output within limit', async () => {
    const result = await bashTool.invoke({ command: 'echo short' });
    expect(result).not.toContain('[Output truncated');
  });
});
