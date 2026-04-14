import React from 'react';

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
}

export function SkillList({ skills, onSelect }: { skills: SkillInfo[]; onSelect?: (skill: SkillInfo) => void }) {
  if (skills.length === 0) {
    return <div className="sidebar-empty">No skills found</div>;
  }

  return (
    <div>
      {skills.map((s) => (
        <div
          key={s.name}
          className="sidebar-item skill-item"
          onClick={() => onSelect?.(s)}
          title={s.description}
        >
          <span className="skill-name">{s.name}</span>
          <span className="skill-desc">{s.description}</span>
        </div>
      ))}
    </div>
  );
}
