import React from 'react';
import { Pin, VolumeX } from 'lucide-react';
import type { Conversation } from '../../types/chat';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../Common/Avatar';

interface ConversationItemProps {
  conversation: Conversation;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({ conversation }) => {
  const {
    activeConversation,
    setActiveConversationId,
    typingUsers,
  } = useChat();
  const { playSound } = useTheme();

  const isActive = activeConversation?.id === conversation.id;
  const otherUser = conversation.participants.find(p => p.id !== 'user_me');
  const isTyping = isActive && typingUsers.length > 0;

  return (
    <div
      onClick={() => {
        playSound('click');
        setActiveConversationId(conversation.id);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        margin: '2px 8px',
        cursor: 'pointer',
        background: isActive
          ? 'var(--bg-card-active)'
          : 'transparent',
        borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
      className="conversation-item-card"
    >
      <Avatar
        src={conversation.avatar}
        name={conversation.name}
        status={conversation.type === 'direct' ? otherUser?.status : undefined}
        isAi={conversation.type === 'ai'}
        size="md"
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h4
            style={{
              fontSize: '14px',
              fontWeight: conversation.unreadCount > 0 ? 700 : 600,
              color: 'var(--text-main)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {conversation.name}
          </h4>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 }}>
            {conversation.lastMessageTimestamp}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p
            style={{
              fontSize: '12px',
              color: isTyping ? 'var(--accent-secondary)' : conversation.unreadCount > 0 ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: conversation.unreadCount > 0 ? 600 : 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              paddingRight: '6px',
              fontStyle: isTyping ? 'italic' : 'normal',
            }}
          >
            {isTyping ? '✍️ typing...' : conversation.lastMessage || 'No messages yet'}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {conversation.isMuted && <VolumeX size={13} color="var(--text-dim)" />}
            {conversation.isPinned && <Pin size={13} color="var(--accent-primary)" fill="var(--accent-primary)" />}

            {conversation.unreadCount > 0 && (
              <span
                style={{
                  background: 'var(--accent-gradient)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-full)',
                  minWidth: '18px',
                  textAlign: 'center',
                }}
              >
                {conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
