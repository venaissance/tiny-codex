import React from 'react';

interface QuickCard {
  icon: string;
  title: string;
  desc: string;
  skillName: string;
}

const CARDS: QuickCard[] = [
  { icon: '\uD83D\uDCBB', title: 'Create a React page', desc: 'Build a new component from scratch', skillName: 'frontend-design' },
  { icon: '\uD83D\uDD0D', title: 'Find and fix bugs', desc: 'Scan codebase for issues', skillName: 'systematic-debugging' },
  { icon: '\uD83D\uDCDD', title: 'Write a tech blog', desc: 'Generate Markdown article', skillName: 'technical-writing' },
  { icon: '\uD83C\uDFA8', title: 'Generate images', desc: 'Create visuals with AI', skillName: 'image-generation' },
];

export function QuickCards({ onSelect, disabled }: {
  onSelect: (title: string, skillName: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="quick-cards">
      {CARDS.map((card) => (
        <button
          key={card.title}
          className="quick-card"
          disabled={disabled}
          onClick={() => !disabled && onSelect(card.title, card.skillName)}
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
