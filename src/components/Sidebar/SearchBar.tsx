import React from 'react';
import { Search, X } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export const SearchBar: React.FC = () => {
  const { searchQuery, setSearchQuery } = useChat();

  return (
    <div style={{ padding: '12px 16px 4px 16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
        }}
      >
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search chats, members, or topics..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--text-main)',
            fontSize: '13px',
            width: '100%',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
