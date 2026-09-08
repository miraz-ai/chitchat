import React, { useRef, useEffect, useState } from 'react';
import { ArrowDown, MessageSquare, Loader2 } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { MessageBubble } from './MessageBubble';

export const MessageFeed: React.FC = () => {
  const { activeMessages, activeConversation, hasMoreMessages, loadingOlderMessages, loadOlderMessages } = useChat();
  const feedRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const prevScrollHeightRef = useRef<number>(0);
  const wasLoadingOlderRef = useRef<boolean>(false);

  const scrollToBottom = (smooth = true) => {
    if (feedRef.current) {
      feedRef.current.scrollTo({
        top: feedRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  useEffect(() => {
    if (wasLoadingOlderRef.current && feedRef.current && prevScrollHeightRef.current > 0) {
      // Maintain scroll position when older messages are prepended
      const heightDiff = feedRef.current.scrollHeight - prevScrollHeightRef.current;
      feedRef.current.scrollTop = heightDiff;
      prevScrollHeightRef.current = 0;
      wasLoadingOlderRef.current = false;
    } else {
      scrollToBottom(false);
    }
  }, [activeMessages.length]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollBtn(isFarFromBottom);

    // Trigger infinite scroll upward when near top
    if (scrollTop < 50 && hasMoreMessages && !loadingOlderMessages) {
      prevScrollHeightRef.current = scrollHeight;
      wasLoadingOlderRef.current = true;
      loadOlderMessages();
    }
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
      ref={feedRef}
      onScroll={handleScroll}
    >
      {/* Loading older messages indicator */}
      {loadingOlderMessages && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
          <Loader2 size={16} className="animate-spin" />
          <span>Loading older messages...</span>
        </div>
      )}

      {/* Beginning of conversation label */}
      {!hasMoreMessages && activeMessages.length > 0 && (
        <div style={{ textAlign: 'center', margin: '12px 0' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--text-dim)',
              padding: '2px 8px',
            }}
          >
            Beginning of conversation
          </span>
        </div>
      )}

      {/* Empty State: No messages */}
      {activeMessages.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--text-muted)',
          }}
          className="animate-fade-in"
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              border: '1px solid var(--border-color)',
            }}
          >
            <MessageSquare size={30} color="var(--accent-primary)" />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
            No messages yet
          </h3>
          <p style={{ fontSize: '13px', maxWidth: '280px', lineHeight: 1.5, color: 'var(--text-muted)' }}>
            Send a message to start the conversation with{' '}
            <strong style={{ color: 'var(--text-main)' }}>{activeConversation?.name || 'this contact'}</strong>!
          </p>
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', margin: '16px 0' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                background: 'var(--bg-card)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-color)',
              }}
            >
              Today
            </span>
          </div>

          {activeMessages.map(message => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </>
      )}

      {/* Floating Scroll to Bottom Button */}
      {showScrollBtn && (
        <button
          onClick={() => scrollToBottom(true)}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '24px',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--accent-gradient)',
            color: '#fff',
            border: 'none',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 15,
          }}
          className="animate-slide-in"
        >
          <ArrowDown size={18} />
        </button>
      )}
    </div>
  );
};
