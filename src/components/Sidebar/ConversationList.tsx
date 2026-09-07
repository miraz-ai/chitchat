import React from 'react';
import { Plus } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { ConversationItem } from './ConversationItem';

export const ConversationList: React.FC = () => {
  const { conversations, filterTab, searchQuery, setShowNewChatModal } = useChat();

  const filteredConversations = conversations.filter(conv => {
    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = conv.name.toLowerCase().includes(q);
      const matchTopic = conv.topic?.toLowerCase().includes(q);
      if (!matchName && !matchTopic) return false;
    }

    // Filter by tab
    if (filterTab === 'unread') return conv.unreadCount > 0;
    if (filterTab === 'direct') return conv.type === 'direct';
    if (filterTab === 'group') return conv.type === 'group';
    if (filterTab === 'ai') return conv.type === 'ai';
    return true; // 'all'
  });

  // Sort pinned first
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px', marginBottom: '4px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
          Conversations ({sortedConversations.length})
        </span>
        <button
          onClick={() => setShowNewChatModal(true)}
          style={{
            background: 'var(--accent-primary)',
            border: 'none',
            color: '#fff',
            borderRadius: 'var(--radius-full)',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Plus size={12} /> New Chat
        </button>
      </div>

      {sortedConversations.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          No conversations found
        </div>
      ) : (
        sortedConversations.map(conv => (
          <ConversationItem key={conv.id} conversation={conv} />
        ))
      )}
    </div>
  );
};
