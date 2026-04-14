/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Welcome } from '@/renderer/components/Welcome/Welcome';

describe('Welcome', () => {
  it('renders title and rocket emoji', () => {
    render(<Welcome onQuickAction={() => {}} />);
    expect(screen.getByText("Let's build")).toBeInTheDocument();
  });

  it('shows project name when projectPath provided', () => {
    render(<Welcome onQuickAction={() => {}} projectPath="/Users/dev/my-project" />);
    expect(screen.getByText('my-project')).toBeInTheDocument();
  });

  it('shows open project link when no projectPath', () => {
    render(<Welcome onQuickAction={() => {}} />);
    expect(screen.getByText('Open a project')).toBeInTheDocument();
  });

  it('calls onOpenProject when link clicked', () => {
    const onOpen = vi.fn();
    render(<Welcome onQuickAction={() => {}} onOpenProject={onOpen} />);
    fireEvent.click(screen.getByText('Open a project'));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('renders 4 quick action cards', () => {
    render(<Welcome onQuickAction={() => {}} />);
    expect(screen.getByText('Create a React page')).toBeInTheDocument();
    expect(screen.getByText('Find and fix bugs')).toBeInTheDocument();
    expect(screen.getByText('Write a tech blog')).toBeInTheDocument();
    expect(screen.getByText('Generate images')).toBeInTheDocument();
  });

  it('calls onQuickAction with card title when clicked', () => {
    const onAction = vi.fn();
    render(<Welcome onQuickAction={onAction} projectPath="/tmp/test" />);
    fireEvent.click(screen.getByText('Write a tech blog'));
    expect(onAction).toHaveBeenCalledWith('Write a tech blog', 'technical-writing');
  });
});
