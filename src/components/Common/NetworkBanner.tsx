import React from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export const NetworkBanner: React.FC = () => {
  const { networkNotification } = useChat();

  if (!networkNotification) return null;

  const isReconnecting = networkNotification === 'reconnecting';
  const isOffline = networkNotification === 'offline';
  const isReconnected = networkNotification === 'reconnected';

  let bgColor = 'rgba(239, 68, 68, 0.9)'; // offline (red)
  let borderColor = 'rgba(239, 68, 68, 0.4)';
  let textColor = '#ffffff';

  if (isReconnecting) {
    bgColor = 'rgba(245, 158, 11, 0.92)'; // amber
    borderColor = 'rgba(245, 158, 11, 0.4)';
  } else if (isReconnected) {
    bgColor = 'rgba(16, 185, 129, 0.92)'; // emerald
    borderColor = 'rgba(16, 185, 129, 0.4)';
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        backgroundColor: bgColor,
        color: textColor,
        padding: '6px 16px',
        borderRadius: 'var(--radius-full, 9999px)',
        fontSize: '12px',
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'none',
        transition: 'all 0.3s ease',
      }}
      className="animate-slide-in"
    >
      {isReconnecting && <RefreshCw size={13} className="spin" />}
      {isOffline && <WifiOff size={13} />}
      {isReconnected && <CheckCircle2 size={13} />}

      <span>
        {isReconnecting && 'Reconnecting to chat server...'}
        {isOffline && 'You are offline. Messages will send once reconnected.'}
        {isReconnected && 'Connected. You are back online!'}
      </span>
    </div>
  );
};
