import React from 'react';
import { Pin } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export const PinnedBar: React.FC = () => {
  const { activeMessages } = useChat();
  const pinnedMessages = activeMessages.filter(m => m.isPinned);

  if (pinnedMessages.length === 0) return null;

  const latestPinned = pinnedMessages[pinnedMessages.length - 1];

  return (
    <div
      style={{
        padding: '8px 20px',
        background: 'rgba(124, 58, 237, 0.1)',
        borderBottom: '1px solid var(--border-highlight)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '13px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Pin size={15} color="var(--accent-primary)" fill="var(--accent-primary)" />
        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Pinned:</span>
        <span
          style={{
            color: 'var(--text-main)',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '450px',
          }}
        >
          {latestPinned.content}
        </span>
      </div>
      <span style={{ fontSize: '11px', color: 'var(--accent-secondary)', fontWeight: 600 }}>
        {pinnedMessages.length} Pinned
      </span>
    </div>
  );
};
