import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Avatar } from '../Common/Avatar';

export const ConnectionsModal: React.FC<{
  show: boolean;
  onClose: () => void;
}> = ({ show, onClose }) => {
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConnections = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/connections', {
         headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchConnections();
    }
  }, [show]);

  const handleAccept = async (id: string) => {
    const token = localStorage.getItem('token');
    try {
       const res = await fetch(`/api/connections/${id}/accept`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
       });
       if (res.ok) {
         fetchConnections();
       }
    } catch (e) {
       console.error(e);
    }
  };

  if (!show) return null;

  // Assuming current user is not available here directly without context, we will fetch their ID or just rely on the API.
  // Actually, we can get currentUser from AuthContext to differentiate incoming vs outgoing requests.
  const authRaw = localStorage.getItem('token') ? JSON.parse(atob(localStorage.getItem('token')!.split('.')[1])) : null;
  const myId = authRaw?.id;

  const pendingIncoming = connections.filter(c => c.status === 'pending' && c.receiver_id === myId);
  const activeConnections = connections.filter(c => c.status === 'accepted');

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
          boxShadow: 'var(--shadow-lg)', maxHeight: '80vh', overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Connections & Requests</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Pending Requests ({pendingIncoming.length})
                </h4>
                {pendingIncoming.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No pending requests.</div>
                ) : (
                    pendingIncoming.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Avatar src={c.avatar} name={c.name} status={c.status} size="sm" isAi={false} />
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600 }}>{c.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>wants to connect</div>
                              </div>
                            </div>
                            <button 
                                onClick={() => handleAccept(c.id.toString())}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                                <Check size={14} /> Accept
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Your Connections ({activeConnections.length})
                </h4>
                {activeConnections.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No active connections.</div>
                ) : (
                    activeConnections.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Avatar src={c.avatar} name={c.name} status={c.status} size="sm" isAi={false} />
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600 }}>{c.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Connected</div>
                              </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
