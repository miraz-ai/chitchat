import React from 'react';
import { X, Bell } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../Common/Avatar';

export const InfoPanel: React.FC = () => {
  const {
    currentUser,
    activeConversation,
    activeMessages,
    showInfoPanel,
    setShowInfoPanel,
    toggleMuteConversation,
    setLightboxImage,
  } = useChat();
  const { playSound } = useTheme();

  if (!showInfoPanel || !activeConversation) return null;

  const otherUser = activeConversation.participants.find(p => String(p.id) !== String(currentUser.id));
  const pinnedMessages = activeMessages.filter(m => m.isPinned);

  // Extract shared images from message attachments
  const sharedImages = activeMessages
    .flatMap(m => m.attachments || [])
    .filter(a => a.type === 'image');

  return (
    <aside
      className="glass-panel animate-slide-in"
      style={{
        width: '320px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border-color)',
        zIndex: 10,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Details</h3>
        <button
          onClick={() => {
            playSound('click');
            setShowInfoPanel(false);
          }}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Main Info Hero */}
      <div style={{ padding: '24px 20px', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>
        <Avatar
          src={activeConversation.avatar}
          name={activeConversation.name}
          status={activeConversation.type === 'direct' ? otherUser?.status : undefined}
          isAi={activeConversation.type === 'ai'}
          size="xl"
        />
        <h3 style={{ fontSize: '17px', fontWeight: 700, marginTop: '12px', color: 'var(--text-main)' }}>
          {activeConversation.name}
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {activeConversation.type === 'group'
            ? activeConversation.topic
            : otherUser?.statusMessage || 'Pulse Network User'}
        </p>

        {/* Quick Action Toggle Mute */}
        <button
          onClick={() => toggleMuteConversation(activeConversation.id)}
          style={{
            marginTop: '14px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            background: activeConversation.isMuted ? 'rgba(244, 63, 94, 0.2)' : 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: activeConversation.isMuted ? 'var(--accent-rose)' : 'var(--text-main)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Bell size={14} />
          {activeConversation.isMuted ? 'Muted' : 'Mute Notifications'}
        </button>
      </div>

      {/* Group Member List (if group chat) */}
      {activeConversation.type === 'group' && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-muted)' }}>
            Members ({activeConversation.participants.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeConversation.participants.map(member => (
              <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Avatar src={member.avatar} name={member.name} status={member.status} size="sm" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{member.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    {String(member.id) === String(currentUser.id) ? 'You' : member.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shared Media Gallery */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-muted)' }}>
          Shared Media ({sharedImages.length})
        </h4>
        {sharedImages.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>No shared photos yet</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {sharedImages.map(img => (
              <img
                key={img.id}
                src={img.url}
                alt={img.name}
                onClick={() => setLightboxImage(img.url)}
                style={{
                  width: '100%',
                  height: '70px',
                  borderRadius: 'var(--radius-sm)',
                  objectFit: 'cover',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pinned Messages Summary */}
      <div style={{ padding: '16px 20px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-muted)' }}>
          Pinned Messages ({pinnedMessages.length})
        </h4>
        {pinnedMessages.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>No pinned messages</p>
        ) : (
          pinnedMessages.map(msg => (
            <div
              key={msg.id}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)',
                marginBottom: '6px',
                fontSize: '12px',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '2px' }}>
                {msg.timestamp}
              </div>
              <div style={{ color: 'var(--text-main)' }}>{msg.content}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
