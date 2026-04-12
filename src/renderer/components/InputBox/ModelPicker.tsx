import React, { useState } from 'react';

export function ModelPicker({ models, current, onChange }: {
  models: string[];
  current: string;
  onChange: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="model-picker" onClick={() => setOpen(!open)}>
      {current} &#x25BE;
      {open && (
        <div className="model-dropdown">
          {models.map((m) => (
            <div
              key={m}
              onClick={(e) => { e.stopPropagation(); onChange(m); setOpen(false); }}
              className="model-option"
              data-selected={m === current ? 'true' : undefined}
            >
              {m}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
