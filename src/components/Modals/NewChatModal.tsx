import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus, MessageCircle, Clock } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../Common/Avatar';

export const NewChatModal: React.FC = () => {
  const { showNewChatModal, setShowNewChatModal, createConversation } = useChat();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!showNewChatModal) {
      setQuery('');
      setResults([]);
    } else {
      handleSearch('');
    }
  }, [showNewChatModal]);

  const handleSearch = async (searchTerm: string) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchTerm)}`, {
         headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (showNewChatModal) handleSearch(query);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleConnect = async (userId: string) => {
    const token = localStorage.getItem('token');
    try {
       const res = await fetch('/api/connections/request', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiverId: userId })
       });
       if (res.ok) {
         handleSearch(query); // refresh
       }
    } catch (e) {
       console.error(e);
    }
  };

  const handleMessage = (userId: string, name: string) => {
    createConversation(name, 'direct', [userId]);
  };

  if (!showNewChatModal) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
      className="animate-fade-in"
    >
      <div
        className="glass-panel animate-slide-in"
        style={{
          width: '460px', borderRadius: 'var(--radius-lg)', padding: '24px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Find Friends</h3>
          <button onClick={() => setShowNewChatModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: '16px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '10px', left: '10px', color: 'var(--text-muted)' }}>
               <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="Search friends by @username or name..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px 10px 36px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                color: 'var(--text-main)', fontSize: '13px', outline: 'none',
              }}
            />
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
          {loading ? (
             <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Searching...</div>
          ) : results.length === 0 ? (
             <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No users found.</div>
          ) : (
            results.map(u => (
              <div
                key={u.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar src={u.avatar} name={u.name} status={u.status} isAi={false} size="sm" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>
                      {u.name} <span style={{ color: 'var(--accent-secondary)', fontWeight: 400, marginLeft: '4px' }}>@{u.username}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{u.email}</div>
                  </div>
                </div>
                
                <div>
                   {u.connection_status === 'accepted' ? (
                      <button 
                        onClick={() => handleMessage(u.id.toString(), u.name)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                        <MessageCircle size={14} /> Message
                      </button>
                   ) : u.connection_status === 'pending' ? (
                      <button disabled style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'not-allowed', fontWeight: 600 }}>
                        <Clock size={14} /> Pending
                      </button>
                   ) : (
                      <button 
                        onClick={() => handleConnect(u.id.toString())}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-card-active)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                        <UserPlus size={14} /> Connect
                      </button>
                   )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
