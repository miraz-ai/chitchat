import React from 'react';
import type { UserStatus } from '../../types/chat';

interface AvatarProps {
  src: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: UserStatus;
  isAi?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  status,
  isAi = false,
  className = '',
}) => {
  const sizeMap = {
    sm: { width: '32px', height: '32px', fontSize: '13px', badgeSize: '10px' },
    md: { width: '42px', height: '42px', fontSize: '15px', badgeSize: '12px' },
    lg: { width: '54px', height: '54px', fontSize: '18px', badgeSize: '14px' },
    xl: { width: '72px', height: '72px', fontSize: '24px', badgeSize: '16px' },
  };

  const statusColors = {
    online: '#10b981',
    away: '#f59e0b',
    busy: '#f43f5e',
    offline: '#64748b',
  };

  const currentSize = sizeMap[size];

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: currentSize.width,
        height: currentSize.height,
        flexShrink: 0,
      }}
      className={className}
    >
      <img
        src={src}
        alt={name}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          objectFit: 'cover',
          border: isAi ? '2px solid #7c3aed' : '2px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isAi ? '0 0 12px rgba(124, 58, 237, 0.4)' : 'none',
        }}
      />
      {status && (
        <span
          style={{
            position: 'absolute',
            bottom: '0',
            right: '0',
            width: currentSize.badgeSize,
            height: currentSize.badgeSize,
            borderRadius: '50%',
            backgroundColor: statusColors[status],
            border: '2px solid var(--bg-dark)',
            boxShadow: status === 'online' ? '0 0 8px #10b981' : 'none',
          }}
          title={`Status: ${status}`}
        />
      )}
      {isAi && (
        <span
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            backgroundColor: '#7c3aed',
            color: '#fff',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 'bold',
            boxShadow: '0 0 8px #7c3aed',
          }}
          title="AI Assistant"
        >
          ✨
        </span>
      )}
    </div>
  );
};
