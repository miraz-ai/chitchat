import React from 'react';
import { X, Download } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export const MediaLightbox: React.FC = () => {
  const { lightboxImage, setLightboxImage } = useChat();

  if (!lightboxImage) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(16px)',
        zIndex: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      className="animate-fade-in"
      onClick={() => setLightboxImage(null)}
    >
      <div
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ position: 'absolute', top: '-40px', right: 0, display: 'flex', gap: '12px' }}>
          <a
            href={lightboxImage}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '13px' }}
          >
            <Download size={18} /> Download
          </a>
          <button
            onClick={() => setLightboxImage(null)}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            <X size={22} />
          </button>
        </div>

        <img
          src={lightboxImage}
          alt="High Res Media Preview"
          style={{
            maxWidth: '100%',
            maxHeight: '85vh',
            borderRadius: 'var(--radius-md)',
            objectFit: 'contain',
            boxShadow: 'var(--shadow-lg)',
          }}
        />
      </div>
    </div>
  );
};
