import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor } from 'lucide-react';
import { useCall } from '../../context/CallContext';
import { Avatar } from '../Common/Avatar';

export const CallModal: React.FC = () => {
  const { callState, endCall, toggleMute, toggleVideo, toggleScreenShare } = useCall();

  if (!callState.active || !callState.user) return null;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(9, 13, 22, 0.85)',
        backdropFilter: 'blur(16px)',
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
          width: '560px',
          height: '460px',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '32px',
          boxShadow: 'var(--shadow-glow)',
          border: '1px solid var(--border-highlight)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Call Type Indicator */}
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--accent-secondary)',
              background: 'rgba(6, 182, 212, 0.15)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            {callState.type === 'video' ? '🎥 HD Video Call' : '📞 Crystal Audio Call'}
          </span>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginTop: '12px', color: 'var(--text-main)' }}>
            {callState.user.name}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {callState.status === 'calling'
              ? 'Ringing...'
              : `Connected • ${formatDuration(callState.duration)}`}
          </p>
        </div>

        {/* Video / Avatar Viewport */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '220px',
            borderRadius: 'var(--radius-md)',
            background: callState.type === 'video' && !callState.isVideoOff
              ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
              : 'rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
          }}
        >
          {callState.type === 'video' && !callState.isVideoOff ? (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={callState.user.avatar}
                alt={callState.user.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
              />
              <div style={{ position: 'absolute', bottom: '12px', left: '12px', fontSize: '12px', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '4px' }}>
                {callState.user.name} (Camera Active)
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Pulse waves animation */}
              <div
                style={{
                  position: 'absolute',
                  inset: '-20px',
                  borderRadius: '50%',
                  border: '2px solid var(--accent-primary)',
                  animation: 'pulseGlow 2s infinite',
                }}
              />
              <Avatar src={callState.user.avatar} name={callState.user.name} size="xl" />
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={toggleMute}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: callState.isMuted ? 'var(--accent-rose)' : 'var(--bg-card)',
              color: '#ffffff',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {callState.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {callState.type === 'video' && (
            <button
              onClick={toggleVideo}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: callState.isVideoOff ? 'var(--accent-amber)' : 'var(--bg-card)',
                color: '#ffffff',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {callState.isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
            </button>
          )}

          <button
            onClick={toggleScreenShare}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: callState.isScreenSharing ? 'var(--accent-secondary)' : 'var(--bg-card)',
              color: '#ffffff',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Monitor size={20} />
          </button>

          <button
            onClick={endCall}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#f43f5e',
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 16px rgba(244, 63, 94, 0.4)',
            }}
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};
