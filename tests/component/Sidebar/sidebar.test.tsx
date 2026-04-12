/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThreadList } from '@/renderer/components/Sidebar/ThreadList';
import { SkillList } from '@/renderer/components/Sidebar/SkillList';

describe('ThreadList', () => {
  const threads = [
    { id: 't1', title: 'Chat about React', updatedAt: Date.now() },
    { id: 't2', title: 'Debug CSS issue', updatedAt: Date.now() - 1000 },
  ];

  it('renders all threads', () => {
    render(<ThreadList threads={threads} activeId={null} onSelect={() => {}} />);
    expect(screen.getByText('Chat about React')).toBeInTheDocument();
    expect(screen.getByText('Debug CSS issue')).toBeInTheDocument();
  });

  it('marks active thread with data-active="true"', () => {
    render(<ThreadList threads={threads} activeId="t1" onSelect={() => {}} />);
    const item = screen.getByText('Chat about React').closest('[data-active]');
    expect(item?.getAttribute('data-active')).toBe('true');
  });

  it('marks inactive threads with data-active="false"', () => {
    render(<ThreadList threads={threads} activeId="t1" onSelect={() => {}} />);
    const item = screen.getByText('Debug CSS issue').closest('[data-active]');
    expect(item?.getAttribute('data-active')).toBe('false');
  });

  it('calls onSelect with thread id when clicked', () => {
    const onSelect = vi.fn();
    render(<ThreadList threads={threads} activeId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Debug CSS issue'));
    expect(onSelect).toHaveBeenCalledWith('t2');
  });

  it('renders empty when no threads', () => {
    const { container } = render(<ThreadList threads={[]} activeId={null} onSelect={() => {}} />);
    expect(container.querySelectorAll('[data-active]')).toHaveLength(0);
  });
});

describe('SkillList', () => {
  const skills = [
    { name: 'Image Gen', icon: '\uD83C\uDFA8' },
    { name: 'Code Review', icon: '\uD83D\uDD0D' },
  ];

  it('renders all skills with icons', () => {
    render(<SkillList skills={skills} />);
    expect(screen.getByText('Image Gen')).toBeInTheDocument();
    expect(screen.getByText('Code Review')).toBeInTheDocument();
  });

  it('calls onSelect when skill clicked', () => {
    const onSelect = vi.fn();
    render(<SkillList skills={skills} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Image Gen'));
    expect(onSelect).toHaveBeenCalledWith({ name: 'Image Gen', icon: '\uD83C\uDFA8' });
  });

  it('renders without onSelect (no crash)', () => {
    expect(() => {
      render(<SkillList skills={skills} />);
      fireEvent.click(screen.getByText('Image Gen'));
    }).not.toThrow();
  });
});
