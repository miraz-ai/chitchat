import React from 'react';
import { useChat } from '../../context/ChatContext';
import { ChatHeader } from './ChatHeader';
import { PinnedBar } from './PinnedBar';
import { MessageFeed } from './MessageFeed';
import { TypingIndicator } from './TypingIndicator';
import { MessageInput } from './MessageInput';
import { MessageSquare } from 'lucide-react';

export const ChatArea: React.FC = () => {
  const { activeConversation } = useChat();

  if (!activeConversation) {
    return (
      <div
        className="app-chat-area hidden-mobile"
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          gap: '12px',
        }}
      >
        <MessageSquare size={48} color="var(--accent-primary)" />
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>
          Select a conversation to start chatting
        </h3>
        <p style={{ fontSize: '14px', maxWidth: '300px', textAlign: 'center' }}>
          Choose from direct messages, team channels, or ask the Pulse AI assistant.
        </p>
      </div>
    );
  }

  return (
    <main
      className="app-chat-area"
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg-chat)',
      }}
    >
      <ChatHeader />
      <PinnedBar />
      <MessageFeed />
      <TypingIndicator />
      <MessageInput />
    </main>
  );
};
