import React from 'react';
import { useChat } from '../../context/ChatContext';

export const TypingIndicator: React.FC = () => {
  const { typingUsers, activeConversation } = useChat();

  if (typingUsers.length === 0) return null;

  // Resolve user IDs to participant names
  const names = typingUsers.map(userId => {
    const participant = activeConversation?.participants?.find(
      p => p.id.toString() === userId.toString()
    );
    return participant?.name || participant?.username || 'Someone';
  });

  let typingText = '';
  if (names.length === 1) {
    typingText = `${names[0]} is typing...`;
  } else if (names.length === 2) {
    typingText = `${names[0]} and ${names[1]} are typing...`;
  } else {
    typingText = `${names[0]} and ${names.length - 1} others are typing...`;
  }

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
      <span>{typingText}</span>
    </div>
  );
};
