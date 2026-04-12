import React from 'react';

interface Skill { name: string; icon: string; }

export function SkillList({ skills, onSelect }: { skills: Skill[]; onSelect?: (skill: Skill) => void }) {
  return (
    <div>
      {skills.map((s) => (
        <div key={s.name} className="sidebar-item" onClick={() => onSelect?.(s)}>
          <span className="sidebar-item-icon">{s.icon}</span>
          {s.name}
        </div>
      ))}
    </div>
  );
}
