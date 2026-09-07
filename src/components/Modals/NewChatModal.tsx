import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../Common/Avatar';

export const NewChatModal: React.FC = () => {
  const { showNewChatModal, setShowNewChatModal, allUsers, createConversation } = useChat();

  const [type, setType] = useState<'direct' | 'group'>('direct');
  const [name, setName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  if (!showNewChatModal) return null;

  const otherUsers = allUsers.filter(u => u.id !== 'user_me');

  const toggleUserSelect = (id: string) => {
    if (type === 'direct') {
      setSelectedUserIds([id]);
    } else {
      setSelectedUserIds(prev =>
        prev.includes(id) ? prev.filter(uId => uId !== id) : [...prev, id]
      );
    }
  };

  const handleCreate = () => {
    if (selectedUserIds.length === 0) return;

    let chatName = name;
    if (type === 'direct') {
      const u = otherUsers.find(user => user.id === selectedUserIds[0]);
      chatName = u?.name || 'Direct Message';
    } else if (!chatName) {
      chatName = `#group-${Date.now().toString().slice(-4)}`;
    }

    createConversation(chatName, type, selectedUserIds);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      className="animate-fade-in"
    >
      <div
        className="glass-panel animate-slide-in"
        style={{
          width: '460px',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Start New Conversation</h3>
          <button
            onClick={() => setShowNewChatModal(false)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Type Toggle Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            onClick={() => setType('direct')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              background: type === 'direct' ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: '#fff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Direct Message
          </button>
          <button
            onClick={() => setType('group')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              background: type === 'group' ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: '#fff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Group Channel
          </button>
        </div>

        {/* Group Name input if group */}
        {type === 'group' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              CHANNEL NAME
            </label>
            <input
              type="text"
              placeholder="e.g. #design-system or #frontend-squad"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Users list selector */}
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
          SELECT RECIPIENT(S)
        </label>
        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
          {otherUsers.map(u => {
            const isSelected = selectedUserIds.includes(u.id);
            return (
              <div
                key={u.id}
                onClick={() => toggleUserSelect(u.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'var(--bg-card-active)' : 'var(--bg-card)',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar src={u.avatar} name={u.name} status={u.status} isAi={u.isAi} size="sm" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{u.statusMessage || u.email}</div>
                  </div>
                </div>
                {isSelected && <Check size={16} color="var(--accent-primary)" />}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={() => setShowNewChatModal(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={selectedUserIds.length === 0}
            style={{
              background: selectedUserIds.length > 0 ? 'var(--accent-gradient)' : 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: selectedUserIds.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            Start Conversation
          </button>
        </div>
      </div>
    </div>
  );
};
