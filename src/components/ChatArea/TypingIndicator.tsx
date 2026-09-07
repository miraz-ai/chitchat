import React from 'react';
import { useChat } from '../../context/ChatContext';

export const TypingIndicator: React.FC = () => {
  const { typingUsers } = useChat();

  if (typingUsers.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 20px',
        fontSize: '12px',
        color: 'var(--accent-secondary)',
        fontWeight: 500,
        fontStyle: 'italic',
      }}
      className="animate-fade-in"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-secondary)',
            animation: 'bounceDot 1.2s infinite 0s',
          }}
        />
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-secondary)',
            animation: 'bounceDot 1.2s infinite 0.2s',
          }}
        />
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-secondary)',
            animation: 'bounceDot 1.2s infinite 0.4s',
          }}
        />
      </div>
      <span>{typingUsers.join(', ')} is typing...</span>
    </div>
  );
};
