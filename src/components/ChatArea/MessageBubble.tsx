import React from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  Pin,
  Reply,
  Trash2,
  Download,
  FileText,
} from 'lucide-react';
import type { Message } from '../../types/chat';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../Common/Avatar';
import { CodeBlock } from './CodeBlock';
import { VoiceNotePlayer } from './VoiceNotePlayer';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const {
    currentUser,
    allUsers,
    addReaction,
    togglePinMessage,
    deleteMessage,
    setReplyingToMessage,
    setLightboxImage,
  } = useChat();
  const { playSound } = useTheme();

  const isMe = message.senderId === currentUser.id;
  const sender = isMe ? currentUser : allUsers.find(u => u.id === message.senderId);

  const EMOJIS = ['❤️', '👍', '😂', '🔥', '🎉', '🚀'];

  const renderStatus = () => {
    if (!isMe) return null;
    if (message.status === 'sending') return <Clock size={13} color="var(--text-dim)" />;
    if (message.status === 'sent') return <Check size={13} color="var(--text-dim)" />;
    if (message.status === 'delivered') return <CheckCheck size={13} color="var(--text-dim)" />;
    if (message.status === 'read') return <CheckCheck size={13} color="var(--accent-secondary)" />;
    return <CheckCheck size={13} color="var(--text-dim)" />;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMe ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: '10px',
        margin: '12px 0',
        position: 'relative',
      }}
      className="message-bubble-row group"
    >
      {!isMe && (
        <Avatar
          src={sender?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde'}
          name={sender?.name || 'User'}
          size="sm"
        />
      )}

      <div
        style={{
          maxWidth: '70%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isMe ? 'flex-end' : 'flex-start',
        }}
      >
        {/* Sender Name for group chats */}
        {!isMe && (
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
            {sender?.name}
          </span>
        )}

        <div style={{ position: 'relative' }}>
          {/* Hover Quick Action Menu */}
          <div
            className="glass-panel"
            style={{
              position: 'absolute',
              top: '-36px',
              right: isMe ? '0' : 'auto',
              left: isMe ? 'auto' : '0',
              display: 'none',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: 'var(--radius-full)',
              zIndex: 20,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => addReaction(message.id, e)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '14px',
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                {e}
              </button>
            ))}
            <span style={{ width: '1px', height: '14px', background: 'var(--border-color)', margin: '0 2px' }} />
            <button
              onClick={() => {
                playSound('click');
                setReplyingToMessage(message);
              }}
              title="Reply"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <Reply size={14} />
            </button>
            <button
              onClick={() => togglePinMessage(message.id)}
              title={message.isPinned ? 'Unpin' : 'Pin'}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <Pin size={14} color={message.isPinned ? 'var(--accent-primary)' : 'currentColor'} />
            </button>
            {isMe && (
              <button
                onClick={() => deleteMessage(message.id)}
                title="Delete"
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer' }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {/* Actual Bubble Container */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: isMe ? 'var(--bubble-sent)' : 'var(--bubble-received)',
              color: isMe ? 'var(--bubble-sent-text)' : 'var(--bubble-received-text)',
              border: isMe ? 'none' : '1px solid var(--bubble-received-border)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              position: 'relative',
            }}
          >
            {/* Pinned indicator badge */}
            {message.isPinned && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', opacity: 0.8, marginBottom: '6px' }}>
                <Pin size={12} /> Pinned
              </div>
            )}

            {/* Reply-to Snippet */}
            {message.replyToSnippet && (
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(0, 0, 0, 0.15)',
                  borderLeft: '3px solid var(--accent-secondary)',
                  marginBottom: '8px',
                  fontSize: '12px',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--accent-secondary)', display: 'block' }}>
                  {message.replyToSnippet.senderName}
                </span>
                <span style={{ opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {message.replyToSnippet.text}
                </span>
              </div>
            )}

            {/* Content rendering depending on type */}
            {message.type === 'code' ? (
              <CodeBlock code={message.content} language={message.codeLanguage} />
            ) : message.type === 'voice' ? (
              <VoiceNotePlayer duration={message.audioDuration || 15} />
            ) : (
              <p style={{ fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {message.content}
              </p>
            )}

            {/* Attachments preview */}
            {message.attachments && message.attachments.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {message.attachments.map(att =>
                  att.type === 'image' ? (
                    <img
                      key={att.id}
                      src={att.url}
                      alt={att.name}
                      onClick={() => setLightboxImage(att.url)}
                      style={{
                        width: '100%',
                        maxHeight: '200px',
                        borderRadius: 'var(--radius-md)',
                        objectFit: 'cover',
                        cursor: 'pointer',
                        marginTop: '4px',
                      }}
                    />
                  ) : (
                    <div
                      key={att.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(0, 0, 0, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={18} color="var(--accent-secondary)" />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600 }}>{att.name}</div>
                          <div style={{ fontSize: '10px', opacity: 0.7 }}>{att.size}</div>
                        </div>
                      </div>
                      <Download size={16} style={{ cursor: 'pointer' }} />
                    </div>
                  )
                )}
              </div>
            )}

            {/* Footer with timestamp & read receipts */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '4px',
                marginTop: '4px',
                fontSize: '11px',
                opacity: 0.75,
              }}
            >
              <span>{message.timestamp}</span>
              {renderStatus()}
            </div>
          </div>

          {/* Emoji Reactions List */}
          {message.reactions && message.reactions.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '4px',
                justifyContent: isMe ? 'flex-end' : 'flex-start',
              }}
            >
              {message.reactions.map(r => {
                const userReacted = r.users.includes(currentUser.id);
                return (
                  <button
                    key={r.emoji}
                    onClick={() => addReaction(message.id, r.emoji)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-full)',
                      background: userReacted ? 'rgba(124, 58, 237, 0.25)' : 'var(--bg-card)',
                      border: userReacted ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{r.emoji}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>{r.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
