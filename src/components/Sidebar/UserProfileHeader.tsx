import React, { useState } from 'react';
import { Settings, Moon, Sun, ChevronDown, Circle } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../Common/Avatar';
import type { UserStatus } from '../../types/chat';

export const UserProfileHeader: React.FC = () => {
  const { currentUser, userStatus, setUserStatus, setShowSettingsModal } = useChat();
  const { theme, setTheme, playSound } = useTheme();
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const statuses: { label: string; value: UserStatus; color: string }[] = [
    { label: 'Online', value: 'online', color: '#10b981' },
    { label: 'Away', value: 'away', color: '#f59e0b' },
    { label: 'Busy', value: 'busy', color: '#f43f5e' },
    { label: 'Offline', value: 'offline', color: '#64748b' },
  ];

  const toggleThemeQuick = () => {
    playSound('pop');
    setTheme(theme === 'clean-light' ? 'cyber-dark' : 'clean-light');
  };

  return (
    <div
      style={{
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(255, 255, 255, 0.02)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
        <Avatar src={currentUser.avatar} name={currentUser.name} status={userStatus} size="md" />

        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
            {currentUser.name}
          </h3>
          <div
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              marginTop: '2px',
            }}
          >
            <Circle
              size={8}
              fill={statuses.find(s => s.value === userStatus)?.color || '#10b981'}
              color="transparent"
            />
            <span style={{ textTransform: 'capitalize' }}>{userStatus}</span>
            <ChevronDown size={12} />
          </div>

          {/* Status Dropdown Menu */}
          {showStatusMenu && (
            <div
              className="glass-panel animate-slide-in"
              style={{
                position: 'absolute',
                top: '48px',
                left: '0',
                zIndex: 50,
                width: '140px',
                borderRadius: 'var(--radius-md)',
                padding: '6px',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {statuses.map(st => (
                <div
                  key={st.value}
                  onClick={() => {
                    setUserStatus(st.value);
                    setShowStatusMenu(false);
                    playSound('click');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    background: userStatus === st.value ? 'var(--bg-card-hover)' : 'transparent',
                  }}
                >
                  <Circle size={8} fill={st.color} color="transparent" />
                  {st.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={toggleThemeQuick}
          title="Toggle Dark / Light Theme"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {theme === 'clean-light' ? <Sun size={18} color="#f59e0b" /> : <Moon size={18} color="#7c3aed" />}
        </button>

        <button
          onClick={() => {
            playSound('click');
            setShowSettingsModal(true);
          }}
          title="App Settings"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
};
