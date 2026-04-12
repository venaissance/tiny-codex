import React from 'react';

interface Command {
  name: string;
  description: string;
  icon: string;
}

const BUILT_IN_COMMANDS: Command[] = [
  { name: 'add-files', description: 'Open file picker', icon: '📎' },
  { name: 'export', description: 'Export conversation', icon: '↗' },
];

export function CommandPicker({ skills, visible, filter, onSelectCommand, onSelectSkill }: {
  skills: Array<{ name: string; icon: string }>;
  visible: boolean;
  filter: string;
  onSelectCommand: (command: string) => void;
  onSelectSkill: (skill: { name: string; icon: string }) => void;
}) {
  if (!visible) return null;

  const allItems = [
    ...BUILT_IN_COMMANDS.map((c) => ({ type: 'command' as const, ...c })),
    ...skills.map((s) => ({ type: 'skill' as const, name: s.name, description: '', icon: s.icon })),
  ];

  const filtered = filter
    ? allItems.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()))
    : allItems;

  return (
    <div className="skill-picker" style={{ maxHeight: 250, overflowY: 'auto' }}>
      {filtered.length === 0 && (
        <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>No matching commands</div>
      )}
      {filtered.map((item) => (
        <div
          key={item.name}
          className="skill-picker-item"
          onClick={() => {
            if (item.type === 'command') onSelectCommand(item.name);
            else onSelectSkill({ name: item.name, icon: item.icon });
          }}
        >
          <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
          <div>
            <div style={{ fontWeight: 500 }}>{item.name}</div>
            {item.description && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{item.description}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
