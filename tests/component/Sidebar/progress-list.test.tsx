/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProgressList, type ProgressStep } from '@/renderer/components/Sidebar/ProgressList';

describe('ProgressList', () => {
  it('shows "No active task" when empty', () => {
    render(<ProgressList steps={[]} />);
    expect(screen.getByText('No active task')).toBeInTheDocument();
  });

  it('renders done step with checkmark', () => {
    const steps: ProgressStep[] = [
      { label: 'read_file', status: 'done' },
    ];
    render(<ProgressList steps={steps} />);
    expect(screen.getByText('read_file')).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  it('renders running step with hourglass', () => {
    const steps: ProgressStep[] = [
      { label: 'Calling bash...', status: 'running' },
    ];
    render(<ProgressList steps={steps} />);
    expect(screen.getByText('Calling bash...')).toBeInTheDocument();
    expect(screen.getByText('\u231B')).toBeInTheDocument();
  });

  it('renders pending step with circle', () => {
    const steps: ProgressStep[] = [
      { label: 'Waiting...', status: 'pending' },
    ];
    render(<ProgressList steps={steps} />);
    expect(screen.getByText('Waiting...')).toBeInTheDocument();
    expect(screen.getByText('○')).toBeInTheDocument();
  });

  it('renders multi-step to-do list in order', () => {
    const steps: ProgressStep[] = [
      { label: 'read_file', status: 'done' },
      { label: 'Calling bash...', status: 'running' },
      { label: 'Respond', status: 'pending' },
    ];
    const { container } = render(<ProgressList steps={steps} />);
    const items = container.querySelectorAll('.sidebar-progress-step');
    expect(items).toHaveLength(3);
  });

  it('renders step label with tool name, not just "Processing..."', () => {
    const steps: ProgressStep[] = [
      { label: 'Step 1 · read_file', status: 'done' },
      { label: 'Step 2 · Calling bash', status: 'running' },
    ];
    render(<ProgressList steps={steps} />);
    expect(screen.getByText('Step 1 · read_file')).toBeInTheDocument();
    expect(screen.getByText('Step 2 · Calling bash')).toBeInTheDocument();
  });
});
