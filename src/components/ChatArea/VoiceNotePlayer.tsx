import React, { useState, useEffect } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface VoiceNotePlayerProps {
  duration?: number; // seconds
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ duration = 15 }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const { playSound } = useTheme();

  const togglePlay = () => {
    playSound('pop');
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 100 / duration;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  // Mock waveform bars heights
  const bars = [12, 24, 16, 30, 20, 36, 14, 28, 22, 18, 32, 24, 16, 28, 20, 12, 26, 34, 18, 10];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(0, 0, 0, 0.2)',
        width: '260px',
        margin: '4px 0',
      }}
    >
      <button
        onClick={togglePlay}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: 'none',
          background: 'var(--accent-gradient)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
      </button>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '36px' }}>
          {bars.map((h, i) => {
            const barProgress = (i / bars.length) * 100;
            const active = barProgress <= progress;
            return (
              <div
                key={i}
                style={{
                  width: '3px',
                  height: isPlaying ? `${Math.max(6, Math.sin(i + progress) * h + 10)}px` : `${h}px`,
                  backgroundColor: active ? 'var(--accent-secondary)' : 'rgba(255, 255, 255, 0.25)',
                  borderRadius: '2px',
                  transition: 'all 0.15s ease',
                }}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            {isPlaying
              ? `0:${Math.floor((progress / 100) * duration).toString().padStart(2, '0')}`
              : `0:${duration.toString().padStart(2, '0')}`}
          </span>
          <Mic size={12} color="var(--text-dim)" />
        </div>
      </div>
    </div>
  );
};
