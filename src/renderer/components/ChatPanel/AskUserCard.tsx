import React, { useState, useRef, useEffect } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Option {
  label: string;
  value: string;
}

export interface PendingQuestion {
  threadId: string;
  question: string;
  options?: Option[];
}

export function AskUserCard({ pending, onRespond }: {
  pending: PendingQuestion;
  onRespond: (threadId: string, response: string) => void;
}) {
  const [customText, setCustomText] = useState('');
  const [answered, setAnswered] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSelect = (value: string) => {
    setSelectedValue(value);
    setAnswered(true);
    onRespond(pending.threadId, value);
  };

  const handleSubmitCustom = () => {
    if (!customText.trim()) return;
    setSelectedValue(customText.trim());
    setAnswered(true);
    onRespond(pending.threadId, customText.trim());
  };

  return (
    <div className="ask-user-card">
      <div className="ask-user-header">
        <span className="ask-user-icon">?</span>
        <span>Agent is asking for your input</span>
      </div>

      <div className="ask-user-question">
        <MarkdownRenderer text={pending.question} />
      </div>

      {pending.options && pending.options.length > 0 && (
        <div className="ask-user-options">
          {pending.options.map((opt, i) => (
            <button
              key={i}
              className={`ask-user-option ${answered && selectedValue === opt.value ? 'selected' : ''}`}
              onClick={() => handleSelect(opt.value)}
              disabled={answered}
            >
              <span className="ask-user-option-indicator">
                {answered && selectedValue === opt.value ? '\u2713' : String.fromCharCode(65 + i) }
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {!answered && (
        <div className="ask-user-input">
          <textarea
            ref={inputRef}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSubmitCustom();
              }
            }}
            placeholder={pending.options?.length ? 'Or type a custom response...' : 'Type your response...'}
            rows={1}
          />
          <button
            className="ask-user-send"
            onClick={handleSubmitCustom}
            disabled={!customText.trim()}
          >
            {'\u2191'}
          </button>
        </div>
      )}

      {answered && (
        <div className="ask-user-answered">
          Answered: {selectedValue}
        </div>
      )}
    </div>
  );
}
