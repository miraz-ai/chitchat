import React from 'react';
import { UserProfileHeader } from './UserProfileHeader';
import { ChatFilterTabs } from './ChatFilterTabs';
import { SearchBar } from './SearchBar';
import { ConversationList } from './ConversationList';

export const Sidebar: React.FC = () => {
  return (
    <aside
      className="glass-panel"
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
