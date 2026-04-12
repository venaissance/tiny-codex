/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Collapsible } from '@/renderer/components/Sidebar/Collapsible';

describe('Collapsible', () => {
  it('hides children by default', () => {
    render(<Collapsible title="TEST"><div>hidden content</div></Collapsible>);
    expect(screen.queryByText('hidden content')).not.toBeInTheDocument();
  });

  it('shows children when defaultOpen=true', () => {
    render(<Collapsible title="TEST" defaultOpen><div>visible content</div></Collapsible>);
    expect(screen.getByText('visible content')).toBeInTheDocument();
  });

  it('toggles on click', () => {
    render(<Collapsible title="TOGGLE ME"><div>toggle content</div></Collapsible>);
    expect(screen.queryByText('toggle content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('TOGGLE ME'));
    expect(screen.getByText('toggle content')).toBeInTheDocument();

    fireEvent.click(screen.getByText('TOGGLE ME'));
    expect(screen.queryByText('toggle content')).not.toBeInTheDocument();
  });

  it('auto-expands when forceOpen becomes true', () => {
    const { rerender } = render(
      <Collapsible title="FORCE" forceOpen={false}><div>forced content</div></Collapsible>,
    );
    expect(screen.queryByText('forced content')).not.toBeInTheDocument();

    rerender(
      <Collapsible title="FORCE" forceOpen={true}><div>forced content</div></Collapsible>,
    );
    expect(screen.getByText('forced content')).toBeInTheDocument();
  });
});
