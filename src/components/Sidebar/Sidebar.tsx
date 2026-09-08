import React from 'react';
import { useChat } from '../../context/ChatContext';
import { UserProfileHeader } from './UserProfileHeader';
import { ChatFilterTabs } from './ChatFilterTabs';
import { SearchBar } from './SearchBar';
import { ConversationList } from './ConversationList';

export const Sidebar: React.FC = () => {
  const { activeConversation } = useChat();

  return (
    <aside
      className={`glass-panel app-sidebar ${activeConversation ? 'hidden-mobile' : ''}`}
      style={{
        width: '340px',
        minWidth: '300px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color)',
        zIndex: 10,
      }}
    >
      <UserProfileHeader />
      <SearchBar />
      <ChatFilterTabs />
      <ConversationList />
    </aside>
  );
};
