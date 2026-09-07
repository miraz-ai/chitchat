import React from 'react';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import { MessageSquare, Mail, Users, Sparkles, Inbox } from 'lucide-react';

export const ChatFilterTabs: React.FC = () => {
  const { filterTab, setFilterTab } = useChat();
  const { playSound } = useTheme();

  const tabs = [
    { id: 'all', label: 'All', icon: Inbox },
    { id: 'unread', label: 'Unread', icon: MessageSquare },
    { id: 'direct', label: 'Direct', icon: Mail },
    { id: 'group', label: 'Channels', icon: Users },
    { id: 'ai', label: 'AI Bot', icon: Sparkles },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        overflowX: 'auto',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = filterTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => {
              playSound('click');
              setFilterTab(tab.id);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
              background: isActive
                ? 'var(--accent-gradient)'
                : 'rgba(255, 255, 255, 0.04)',
              color: isActive ? '#ffffff' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}
          >
            <Icon size={14} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
