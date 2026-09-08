import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, MessageCircle, Clock, Users } from 'lucide-react';
import { Avatar } from '../Common/Avatar';
import { useChat } from '../../context/ChatContext';

interface ConnectionUser {
  id: number;
  connection_id: number;
  username: string;
  name: string;
  avatar: string;
  bio?: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  last_seen: string | null;
  connected_at: string;
}

interface RequestItem {
  id: number;
  requester_id: number;
  receiver_id: number;
  status: string;
  created_at: string;
  user_id: number;
  username: string;
  name: string;
  avatar: string;
  bio?: string;
  user_status: 'online' | 'offline' | 'away' | 'busy';
  last_seen: string | null;
}

export const ConnectionsModal: React.FC<{
  show: boolean;
  onClose: () => void;
}> = ({ show, onClose }) => {
  const { createConversation } = useChat();
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing' | 'connected'>('incoming');
  const [connections, setConnections] = useState<ConnectionUser[]>([]);
  const [requests, setRequests] = useState<{ incoming: RequestItem[]; outgoing: RequestItem[] }>({
    incoming: [],
    outgoing: []
  });
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const [connRes, reqRes] = await Promise.all([
        fetch('/api/connections', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/connections/requests', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (connRes.ok) {
        const connData = await connRes.json();
        setConnections(connData);
      }
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setRequests(reqData);
      }
    } catch (e) {
      console.error('Failed to load connections data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchData();
    }
  }, [show]);

  const handleAccept = async (id: number | string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/connections/${id}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (id: number | string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/connections/${id}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancel = async (id: number | string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/connections/${id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemove = async (connectionId: number | string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/connections/${connectionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMessage = async (userId: number | string, name: string) => {
    await createConversation(name, 'direct', [userId.toString()]);
    onClose();
  };

  if (!show) return null;

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
          width: '500px', borderRadius: 'var(--radius-lg)', padding: '24px',
          boxShadow: 'var(--shadow-lg)', maxHeight: '82vh', display: 'flex', flexDirection: 'column'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="var(--accent-primary)" /> Connections & Requests
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
          <button
            onClick={() => setActiveTab('incoming')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: 'none',
              background: activeTab === 'incoming' ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: activeTab === 'incoming' ? '#fff' : 'var(--text-main)',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            Incoming ({requests.incoming.length})
          </button>
          <button
            onClick={() => setActiveTab('outgoing')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: 'none',
              background: activeTab === 'outgoing' ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: activeTab === 'outgoing' ? '#fff' : 'var(--text-main)',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            Outgoing ({requests.outgoing.length})
          </button>
          <button
            onClick={() => setActiveTab('connected')}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: 'none',
              background: activeTab === 'connected' ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: activeTab === 'connected' ? '#fff' : 'var(--text-main)',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            Connected ({connections.length})
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>
          ) : activeTab === 'incoming' ? (
            requests.incoming.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>No incoming connection requests.</div>
            ) : (
              requests.incoming.map(req => (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar src={req.avatar} name={req.name} status={req.user_status} size="sm" isAi={false} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>
                        {req.name} <span style={{ color: 'var(--accent-secondary)', fontWeight: 400, marginLeft: '4px' }}>@{req.username}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.bio || 'Wants to connect with you'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button 
                      onClick={() => handleAccept(req.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                      <Check size={14} /> Accept
                    </button>
                    <button 
                      onClick={() => handleReject(req.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )
          ) : activeTab === 'outgoing' ? (
            requests.outgoing.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>No outgoing connection requests.</div>
            ) : (
              requests.outgoing.map(req => (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar src={req.avatar} name={req.name} status={req.user_status} size="sm" isAi={false} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>
                        {req.name} <span style={{ color: 'var(--accent-secondary)', fontWeight: 400, marginLeft: '4px' }}>@{req.username}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Pending acceptance</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleCancel(req.id)}
                    title="Cancel pending request"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
                    <Clock size={13} /> Cancel
                  </button>
                </div>
              ))
            )
          ) : (
            connections.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>No active connections yet. Find friends to connect!</div>
            ) : (
              connections.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar src={c.avatar} name={c.name} status={c.status} size="sm" isAi={false} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>
                        {c.name} <span style={{ color: 'var(--accent-secondary)', fontWeight: 400, marginLeft: '4px' }}>@{c.username}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.bio || (c.status === 'online' ? 'Active now' : 'Offline')}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button 
                      onClick={() => handleMessage(c.id, c.name)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                      <MessageCircle size={14} /> Message
                    </button>
                    <button 
                      onClick={() => handleRemove(c.connection_id)}
                      title="Remove connection"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 8px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
};
