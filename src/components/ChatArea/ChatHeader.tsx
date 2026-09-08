import React from 'react';
import { Phone, Video, Info, ArrowLeft } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useCall } from '../../context/CallContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../Common/Avatar';

export const ChatHeader: React.FC = () => {
  const { currentUser, activeConversation, setActiveConversationId, showInfoPanel, setShowInfoPanel } = useChat();
  const { startCall } = useCall();
  const { playSound } = useTheme();

  if (!activeConversation) return null;

  const otherUser = activeConversation.participants.find(p => String(p.id) !== String(currentUser.id));

  return (
    <div
      style={{
        height: '68px',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          className="mobile-back-btn"
          onClick={() => {
            playSound('pop');
            setActiveConversationId('');
          }}
          title="Back to conversations"
          aria-label="Back to conversations"
        >
          <ArrowLeft size={18} />
        </button>
        <Avatar
          src={activeConversation.avatar}
          name={activeConversation.name}
          status={activeConversation.type === 'direct' ? otherUser?.status : undefined}
          isAi={activeConversation.type === 'ai'}
          size="lg"
        />

        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
            {activeConversation.name}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {activeConversation.type === 'group'
              ? `${activeConversation.participants.length} members • ${activeConversation.topic || 'Group Thread'}`
              : activeConversation.type === 'ai'
              ? '✨ AI Assistant • Powered by Pulse Engine'
              : otherUser?.statusMessage || (otherUser?.status === 'online' ? 'Active now' : 'Offline')}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {otherUser && activeConversation.type !== 'ai' && (
          <>
            <button
              onClick={() => {
                playSound('click');
                startCall(otherUser, 'audio');
              }}
              title="Start Voice Call"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Phone size={18} color="var(--accent-emerald)" />
            </button>

            <button
              onClick={() => {
                playSound('click');
                startCall(otherUser, 'video');
              }}
              title="Start Video Call"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Video size={18} color="var(--accent-secondary)" />
            </button>
          </>
        )}

        <button
          onClick={() => {
            playSound('click');
            setShowInfoPanel(!showInfoPanel);
          }}
          title="Conversation Info"
          style={{
            background: showInfoPanel ? 'var(--accent-primary)' : 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: '#fff',
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Info size={18} />
        </button>
      </div>
    </div>
  );
};
