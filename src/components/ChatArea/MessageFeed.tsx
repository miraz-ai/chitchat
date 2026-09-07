import React, { useRef, useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { MessageBubble } from './MessageBubble';

export const MessageFeed: React.FC = () => {
  const { activeMessages } = useChat();
  const feedRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = (smooth = true) => {
    if (feedRef.current) {
      feedRef.current.scrollTo({
        top: feedRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [activeMessages.length]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollBtn(isFarFromBottom);
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
