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
        handleSearch(query);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancel = async (connectionId: string | number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/connections/${connectionId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        handleSearch(query);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAccept = async (connectionId: string | number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/connections/${connectionId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        handleSearch(query);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (connectionId: string | number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/connections/${connectionId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        handleSearch(query);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMessage = async (userId: string, name: string) => {
    await createConversation(name, 'direct', [userId]);
    setShowNewChatModal(false);
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
          width: '460px', maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box', borderRadius: 'var(--radius-lg)', padding: '24px',
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
              placeholder="Search friends by @username, name, or email..."
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
             <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Searching...</div>
          ) : results.length === 0 ? (
             <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
               <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: 'var(--text-main)' }}>
                 {query.trim() ? 'No users found' : 'No connections yet'}
               </p>
               <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)' }}>
                 {query.trim() ? `No users matching "${query}"` : 'Search for users above by username, name, or email to send a connection request.'}
               </p>
             </div>
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
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.bio || (u.status === 'online' ? 'Active now' : 'Offline')}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                   {u.connection_status === 'connected' || u.connection_status === 'accepted' ? (
                      <button 
                        onClick={() => handleMessage(u.id.toString(), u.name)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                        <MessageCircle size={14} /> Message
                      </button>
                   ) : u.connection_status === 'incoming_request' ? (
                      <>
                        <button 
                          onClick={() => handleAccept(u.connection_id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                          Accept
                        </button>
                        <button 
                          onClick={() => handleReject(u.connection_id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                          Reject
                        </button>
                      </>
                   ) : u.connection_status === 'pending' ? (
                      <button 
                        onClick={() => handleCancel(u.connection_id)}
                        title="Click to cancel pending request"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
                        <Clock size={13} /> Cancel
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
