import React from 'react';

const CARDS = [
  { icon: '\uD83D\uDCBB', title: 'Create a React page', desc: 'Build a new component from scratch' },
  { icon: '\uD83D\uDD0D', title: 'Find and fix bugs', desc: 'Scan codebase for issues' },
  { icon: '\uD83D\uDCDD', title: 'Write a tech blog', desc: 'Generate Markdown article' },
  { icon: '\uD83C\uDFA8', title: 'Generate images', desc: 'Create visuals with AI' },
];

export function QuickCards({ onSelect, disabled }: { onSelect: (title: string) => void; disabled?: boolean }) {
  return (
    <div className="quick-cards">
      {CARDS.map((card) => (
        <button
          key={card.title}
          className="quick-card"
          disabled={disabled}
          onClick={() => !disabled && onSelect(card.title)}
          style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
        >
          <span className="quick-card-icon">{card.icon}</span>
          <div className="quick-card-title">{card.title}</div>
          <div>{card.desc}</div>
        </button>
      ))}
    </div>
  );
}
