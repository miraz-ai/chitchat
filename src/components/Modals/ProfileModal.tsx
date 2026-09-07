import React, { useState } from 'react';
import { X, User as UserIcon, Mail } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../Common/Avatar';

export const ProfileModal: React.FC = () => {
  const { showProfileModal, setShowProfileModal } = useChat();
  const { playSound } = useTheme();
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!showProfileModal) return null;

  const handleSave = async () => {
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, email, avatar })
      });

      const data = await res.json();
      if (res.ok) {
        updateUser(data.user);
        setSuccessMsg('Profile updated successfully!');
        playSound('pop');
        setTimeout(() => {
          setShowProfileModal(false);
        }, 1500);
      } else {
        setErrorMsg(data.error || 'Failed to update profile');
      }
    } catch (err) {
      setErrorMsg('Failed to connect to the server');
    } finally {
      setIsLoading(false);
    }
  };

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
          width: '400px',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserIcon size={20} color="var(--accent-primary)" /> Edit Profile
          </h3>
          <button
            onClick={() => {
              setShowProfileModal(false);
              setSuccessMsg('');
              setErrorMsg('');
            }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <Avatar src={avatar} name={name} size="xl" />
        </div>

        {errorMsg && (
          <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', textAlign: 'center', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)' }}>
            {errorMsg}
          </div>
        )}
        
        {successMsg && (
          <div style={{ color: '#10b981', fontSize: '13px', marginBottom: '16px', textAlign: 'center', padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)' }}>
            {successMsg}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Full Name</label>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '0 12px', border: '1px solid var(--border-color)' }}>
            <UserIcon size={16} color="var(--text-muted)" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-main)', padding: '10px', outline: 'none', fontSize: '14px' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Email</label>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '0 12px', border: '1px solid var(--border-color)' }}>
            <Mail size={16} color="var(--text-muted)" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-main)', padding: '10px', outline: 'none', fontSize: '14px' }}
            />
          </div>
        </div>
        
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Avatar URL (Optional)</label>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '0 12px', border: '1px solid var(--border-color)' }}>
            <input
              type="text"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://..."
              style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-main)', padding: '10px', outline: 'none', fontSize: '14px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={() => setShowProfileModal(false)}
            style={{
              background: 'transparent',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || !name || !email}
            style={{
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isLoading || !name || !email ? 'not-allowed' : 'pointer',
              opacity: isLoading || !name || !email ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
