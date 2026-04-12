import React from 'react';

interface Skill { name: string; icon: string; }

export function SkillTagPicker({ skills, onSelect, visible }: {
  skills: Skill[];
  onSelect: (skill: Skill) => void;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="skill-picker">
      {skills.map((s) => (
        <div
          key={s.name}
          onClick={() => onSelect(s)}
          className="skill-picker-item"
        >
          <span>{s.icon}</span>
          {s.name}
        </div>
      ))}
    </div>
  );
}
