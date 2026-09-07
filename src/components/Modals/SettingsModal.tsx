import React from 'react';
import { X, Volume2, VolumeX, Palette } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeMode } from '../../types/chat';

export const SettingsModal: React.FC = () => {
  const { showSettingsModal, setShowSettingsModal } = useChat();
  const { theme, setTheme, soundEnabled, setSoundEnabled, playSound } = useTheme();

  if (!showSettingsModal) return null;

  const themeOptions: { id: ThemeMode; label: string; desc: string; previewColor: string }[] = [
    {
      id: 'cyber-dark',
      label: 'Cyber Dark',
      desc: 'Deep slate backdrop with electric violet & cyan accents',
      previewColor: '#7c3aed',
    },
    {
      id: 'midnight-indigo',
      label: 'Midnight Indigo',
      desc: 'Rich indigo night mode with magenta highlights',
      previewColor: '#4f46e5',
    },
    {
      id: 'neon-synth',
      label: 'Neon Synth',
      desc: 'Vibrant cyberpunk neon glow theme',
      previewColor: '#d946ef',
    },
    {
      id: 'clean-light',
      label: 'Clean Light',
      desc: 'Crisp, high-contrast light mode layout',
      previewColor: '#2563eb',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
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
          width: '500px',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Palette size={20} color="var(--accent-primary)" /> App Settings & Themes
          </h3>
          <button
            onClick={() => setShowSettingsModal(false)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Theme Picker */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '10px' }}>
            SELECT THEME PRESET
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {themeOptions.map(t => (
              <div
                key={t.id}
                onClick={() => {
                  playSound('pop');
                  setTheme(t.id);
                }}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: theme === t.id ? 'var(--bg-card-active)' : 'var(--bg-card)',
                  border: theme === t.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: t.previewColor,
                    }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>{t.label}</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Audio Sound FX Toggle */}
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {soundEnabled ? <Volume2 size={18} color="var(--accent-emerald)" /> : <VolumeX size={18} />}
              Web Audio FX Synthesizer
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Play subtle audio clicks and message chime sounds
            </div>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              background: soundEnabled ? 'var(--accent-gradient)' : 'var(--bg-card)',
              color: '#fff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {soundEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div style={{ textAlign: 'right' }}>
          <button
            onClick={() => setShowSettingsModal(false)}
            style={{
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
