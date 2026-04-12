/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModelPicker } from '@/renderer/components/InputBox/ModelPicker';
import { ModePicker } from '@/renderer/components/InputBox/ModePicker';

describe('ModelPicker', () => {
  const models = ['MiniMax-M2.7', 'glm-5.1', 'claude-3.5-sonnet'];

  it('renders current model name', () => {
    render(<ModelPicker models={models} current="MiniMax-M2.7" onChange={() => {}} />);
    expect(screen.getByText(/MiniMax-M2\.7/)).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(<ModelPicker models={models} current="MiniMax-M2.7" onChange={() => {}} />);
    fireEvent.click(screen.getByText(/MiniMax-M2\.7/));
    expect(screen.getByText('glm-5.1')).toBeInTheDocument();
    expect(screen.getByText('claude-3.5-sonnet')).toBeInTheDocument();
  });

  it('calls onChange when model selected', () => {
    const onChange = vi.fn();
    render(<ModelPicker models={models} current="MiniMax-M2.7" onChange={onChange} />);
    fireEvent.click(screen.getByText(/MiniMax-M2\.7/));
    fireEvent.click(screen.getByText('glm-5.1'));
    expect(onChange).toHaveBeenCalledWith('glm-5.1');
  });

  it('marks current model as selected', () => {
    render(<ModelPicker models={models} current="glm-5.1" onChange={() => {}} />);
    fireEvent.click(screen.getByText(/glm-5\.1/));
    const option = screen.getAllByText('glm-5.1').find((el) => el.getAttribute('data-selected') === 'true');
    expect(option).toBeTruthy();
  });
});

describe('ModePicker', () => {
  it('renders Local and Worktree buttons', () => {
    render(<ModePicker mode="local" onChange={() => {}} />);
    expect(screen.getByText('Local')).toBeInTheDocument();
    expect(screen.getByText('Worktree')).toBeInTheDocument();
  });

  it('highlights active mode', () => {
    render(<ModePicker mode="local" onChange={() => {}} />);
    const localBtn = screen.getByText('Local');
    expect(localBtn.className).toContain('active');
  });

  it('calls onChange when mode clicked', () => {
    const onChange = vi.fn();
    render(<ModePicker mode="local" onChange={onChange} />);
    fireEvent.click(screen.getByText('Worktree'));
    expect(onChange).toHaveBeenCalledWith('worktree');
  });
});
