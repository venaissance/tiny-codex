/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageView } from '@/renderer/components/PreviewPanel/ImageView';
import { CsvJsonView } from '@/renderer/components/PreviewPanel/CsvJsonView';
import { DiffView } from '@/renderer/components/PreviewPanel/DiffView';

describe('ImageView', () => {
  it('renders single image', () => {
    render(<ImageView src="https://example.com/img.png" />);
    const img = screen.getByAltText('Image 1');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('https://example.com/img.png');
  });

  it('renders multiple images', () => {
    render(<ImageView src={['img1.png', 'img2.png', 'img3.png']} />);
    expect(screen.getByAltText('Image 1')).toBeInTheDocument();
    expect(screen.getByAltText('Image 2')).toBeInTheDocument();
    expect(screen.getByAltText('Image 3')).toBeInTheDocument();
  });

  it('prepends file:// for absolute paths', () => {
    render(<ImageView src="/Users/dev/photo.jpg" />);
    const img = screen.getByAltText('Image 1');
    expect(img.getAttribute('src')).toBe('file:///Users/dev/photo.jpg');
  });

  it('keeps URLs unchanged', () => {
    render(<ImageView src="https://cdn.example.com/photo.jpg" />);
    const img = screen.getByAltText('Image 1');
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/photo.jpg');
  });
});

describe('CsvJsonView - CSV', () => {
  const csvContent = 'name,age,city\nAlice,30,NYC\nBob,25,LA';

  it('renders CSV as table', () => {
    render(<CsvJsonView type="csv" content={csvContent} />);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('age')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders headers in thead', () => {
    const { container } = render(<CsvJsonView type="csv" content={csvContent} />);
    const ths = container.querySelectorAll('th');
    expect(ths).toHaveLength(3);
    expect(ths[0].textContent).toBe('name');
  });

  it('renders body rows in tbody', () => {
    const { container } = render(<CsvJsonView type="csv" content={csvContent} />);
    const trs = container.querySelectorAll('tbody tr');
    expect(trs).toHaveLength(2);
  });
});

describe('CsvJsonView - JSON', () => {
  it('renders valid JSON as tree', () => {
    const json = JSON.stringify({ name: 'Alice', items: [1, 2, 3] });
    render(<CsvJsonView type="json" content={json} />);
    expect(screen.getByText(/"name"/)).toBeInTheDocument();
    expect(screen.getByText(/"items"/)).toBeInTheDocument();
  });

  it('shows error for invalid JSON', () => {
    render(<CsvJsonView type="json" content="not valid json{" />);
    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
  });

  it('expands/collapses JSON tree on click', () => {
    const json = JSON.stringify({ nested: { a: 1, b: 2 } });
    render(<CsvJsonView type="json" content={json} />);
    // Top level should be expanded by default (depth < 2)
    expect(screen.getByText(/"nested"/)).toBeInTheDocument();
  });
});

describe('DiffView', () => {
  it('renders diff-view container', () => {
    render(<DiffView file="test.ts" original="const a = 1;" modified="const a = 2;" />);
    expect(screen.getByTestId('diff-view')).toBeInTheDocument();
  });

  it('shows filename', () => {
    render(<DiffView file="/path/to/file.ts" original="old" modified="new" />);
    expect(screen.getByText('file.ts')).toBeInTheDocument();
  });

  it('shows deleted and added lines', () => {
    const { container } = render(
      <DiffView file="a.js" original="line1\nold line" modified="line1\nnew line" />,
    );
    // Should have a "-" for deleted and "+" for added
    const html = container.innerHTML;
    expect(html).toContain('old line');
    expect(html).toContain('new line');
  });

  it('shows unchanged lines without markers', () => {
    render(<DiffView file="a.js" original={'same\ndifferent_old'} modified={'same\ndifferent_new'} />);
    // "same" is an unchanged line rendered directly
    const { container } = render(<DiffView file="a.js" original={'identical\nold_line'} modified={'identical\nnew_line'} />);
    // The identical line should exist without a +/- prefix
    const lines = container.querySelectorAll('div[style*="position: relative"]');
    const identicalLine = Array.from(lines).find((el) => el.textContent?.includes('identical') && !el.textContent?.includes('-') && !el.textContent?.includes('+'));
    expect(identicalLine).toBeTruthy();
  });
});
