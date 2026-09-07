import React, { useState, useRef } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  Code,
  Sparkles,
  X,
  Image as ImageIcon,
  FileText,
  StopCircle,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import { SMART_AI_CHIPS } from '../../data/mockData';
import type { Attachment } from '../../types/chat';

export const MessageInput: React.FC = () => {
  const {
    sendMessage,
    replyingToMessage,
    setReplyingToMessage,
    activeConversation,
  } = useChat();
  const { playSound } = useTheme();

  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const EMOJI_LIST = ['😀', '😂', '😍', '🔥', '🎉', '🚀', '👍', '❤️', '✨', '💻', '🎨', '🙌', '💯', '⚡'];

  const handleSend = () => {
    if (!text.trim() && attachments.length === 0) return;

    sendMessage(
      text.trim(),
      isCodeMode ? 'code' : attachments.length > 0 ? (attachments[0].type === 'image' ? 'image' : 'file') : 'text',
      attachments.length > 0 ? attachments : undefined,
      isCodeMode ? 'typescript' : undefined
    );

    setText('');
    setAttachments([]);
    setIsCodeMode(false);
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSimulateAttachment = (type: 'image' | 'file') => {
    playSound('pop');
    if (type === 'image') {
      const mockImg: Attachment = {
        id: `att_${Date.now()}`,
        type: 'image',
        url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
        name: 'code_snippet_screenshot.png',
        size: '1.2 MB',
      };
      setAttachments(prev => [...prev, mockImg]);
    } else {
      const mockDoc: Attachment = {
        id: `att_${Date.now()}`,
        type: 'file',
        url: '#',
        name: 'Sprint_Planning_Notes.pdf',
        size: '850 KB',
      };
      setAttachments(prev => [...prev, mockDoc]);
    }
  };

  const startVoiceRecording = () => {
    playSound('click');
    setIsRecordingVoice(true);
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => {
      setRecordingSeconds(prev => prev + 1);
    }, 1000);
  };

  const stopAndSendVoiceRecording = () => {
    playSound('send');
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecordingVoice(false);
    sendMessage('Voice Note', 'voice', undefined, undefined, Math.max(3, recordingSeconds));
    setRecordingSeconds(0);
  };

  return (
    <div
      style={{
        padding: '12px 20px',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Smart AI Quick Chips for AI conversation */}
      {activeConversation?.type === 'ai' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          <Sparkles size={14} color="var(--accent-primary)" />
          {SMART_AI_CHIPS.map(chip => (
            <button
              key={chip}
              onClick={() => {
                playSound('click');
                setText(chip);
              }}
              style={{
                background: 'rgba(124, 58, 237, 0.12)',
                border: '1px solid var(--border-highlight)',
                color: 'var(--text-main)',
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Replying-to Banner */}
      {replyingToMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            borderLeft: '3px solid var(--accent-secondary)',
            fontSize: '12px',
          }}
        >
          <div>
            <span style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>Replying to message</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
              {replyingToMessage.content.slice(0, 45)}...
            </span>
          </div>
          <button
            onClick={() => setReplyingToMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Attachment Previews list */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {attachments.map(att => (
            <div
              key={att.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
              }}
            >
              {att.type === 'image' ? <ImageIcon size={14} color="var(--accent-secondary)" /> : <FileText size={14} />}
              <span>{att.name}</span>
              <button
                onClick={() => setAttachments(attachments.filter(a => a.id !== att.id))}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div
          className="glass-panel animate-slide-in"
          style={{
            position: 'absolute',
            bottom: '80px',
            right: '70px',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '6px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 30,
          }}
        >
          {EMOJI_LIST.map(e => (
            <button
              key={e}
              onClick={() => {
                setText(prev => prev + e);
                setShowEmojiPicker(false);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Voice Recording Active Bar */}
      {isRecordingVoice ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-rose)',
                animation: 'bounceDot 1s infinite',
              }}
            />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-rose)' }}>
              Recording Voice Note: 0:{recordingSeconds.toString().padStart(2, '0')}
            </span>
          </div>

          <button
            onClick={stopAndSendVoiceRecording}
            style={{
              background: 'var(--accent-rose)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <StopCircle size={16} /> Send Note
          </button>
        </div>
      ) : (
        /* Standard Composer Field */
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '10px',
            background: 'var(--bg-input)',
            border: isCodeMode ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '8px 14px',
          }}
        >
          <button
            onClick={() => setIsCodeMode(!isCodeMode)}
            title="Toggle Code Snippet Mode"
            style={{
              background: 'transparent',
              border: 'none',
              color: isCodeMode ? 'var(--accent-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <Code size={18} />
          </button>

          <button
            onClick={() => handleSimulateAttachment('image')}
            title="Attach Image"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <Paperclip size={18} />
          </button>

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isCodeMode ? 'Paste your code snippet here...' : 'Type a message... (Enter to send)'}
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-main)',
              fontSize: '14px',
              fontFamily: isCodeMode ? 'var(--font-mono)' : 'var(--font-sans)',
              resize: 'none',
              maxHeight: '120px',
              lineHeight: 1.4,
            }}
          />

          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Emoji Picker"
            style={{
              background: 'transparent',
              border: 'none',
              color: showEmojiPicker ? 'var(--accent-amber)' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <Smile size={18} />
          </button>

          <button
            onClick={startVoiceRecording}
            title="Record Voice Note"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <Mic size={18} />
          </button>

          <button
            onClick={handleSend}
            disabled={!text.trim() && attachments.length === 0}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: text.trim() || attachments.length > 0 ? 'var(--accent-gradient)' : 'rgba(255, 255, 255, 0.08)',
              color: text.trim() || attachments.length > 0 ? '#ffffff' : 'var(--text-dim)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: text.trim() || attachments.length > 0 ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
