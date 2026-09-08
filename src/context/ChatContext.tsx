import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Conversation, Message, User, UserStatus, Attachment, MessageType } from '../types/chat';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { socketService } from '../services/socket';

interface ChatContextType {
  connectionState: 'connected' | 'reconnecting' | 'disconnected';
  networkNotification: 'reconnecting' | 'offline' | 'reconnected' | null;
  conversations: Conversation[];
  activeConversation: Conversation | undefined;
  activeMessages: Message[];
  currentUser: User;
  userStatus: UserStatus;
  setUserStatus: (status: UserStatus) => void;
  setActiveConversationId: (id: string) => void;
  sendMessage: (
    content: string,
    type?: MessageType,
    attachments?: Attachment[],
    codeLanguage?: string,
    audioDuration?: number
  ) => void;
  retryMessage: (tempId: string) => void;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  hasMoreMessages: boolean;
  loadingOlderMessages: boolean;
  loadOlderMessages: () => Promise<void>;
  replyingToMessage: Message | null;
  setReplyingToMessage: (msg: Message | null) => void;
  addReaction: (messageId: string, emoji: string) => void;
  togglePinMessage: (messageId: string) => void;
  typingUsers: string[]; 
  filterTab: string;
  setFilterTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showInfoPanel: boolean;
  setShowInfoPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showNewChatModal: boolean;
  setShowNewChatModal: React.Dispatch<React.SetStateAction<boolean>>;
  showSettingsModal: boolean;
  setShowSettingsModal: React.Dispatch<React.SetStateAction<boolean>>;
  showProfileModal: boolean;
  setShowProfileModal: React.Dispatch<React.SetStateAction<boolean>>;
  lightboxImage: string | null;
  setLightboxImage: (url: string | null) => void;
  createConversation: (name: string, type: 'direct' | 'group', selectedUserIds: string[]) => void;
  togglePinConversation: (convId: string) => void;
  toggleMuteConversation: (convId: string) => void;
  allUsers: User[]; // Will be populated with connections or search results
  refreshConversations: () => void;
  startTyping: () => void;
  stopTyping: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { playSound } = useTheme();
  const { user: authUser, isAuthenticated } = useAuth();

  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const [networkNotification, setNetworkNotification] = useState<'reconnecting' | 'offline' | 'reconnected' | null>(null);
  const prevConnectionStateRef = React.useRef(connectionState);

  useEffect(() => {
    const prevState = prevConnectionStateRef.current;
    prevConnectionStateRef.current = connectionState;

    if (prevState === 'reconnecting' && connectionState === 'connected') {
      setNetworkNotification('reconnected');
      const timer = setTimeout(() => setNetworkNotification(null), 3000);
      return () => clearTimeout(timer);
    } else if (connectionState === 'reconnecting') {
      setNetworkNotification('reconnecting');
    } else if (connectionState === 'disconnected') {
      setNetworkNotification('offline');
    } else if (connectionState === 'connected') {
      setNetworkNotification(null);
    }
  }, [connectionState]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [hasMoreMap, setHasMoreMap] = useState<Record<string, boolean>>({});
  const [loadingOlder, setLoadingOlder] = useState<boolean>(false);
  const [activeConversationId, setActiveConversationIdState] = useState<string>('');
  const activeConversationIdRef = React.useRef(activeConversationId);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);
  
  const currentUser: User = authUser ? {
    id: authUser.id.toString(),
    username: authUser.username,
    name: authUser.name,
    email: authUser.email,
    avatar: authUser.avatar,
    bio: authUser.bio,
    status: authUser.status as UserStatus || 'online',
    isAi: false
  } : { id: '0', name: 'Guest', avatar: '', status: 'offline', isAi: false };

  const [userStatus, setUserStatusState] = useState<UserStatus>(currentUser.status);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [typingUsersMap, setTypingUsersMap] = useState<Record<string, string[]>>({});
  const [filterTab, setFilterTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [allUsers] = useState<User[]>([]);

  // UI Modals
  const [showInfoPanel, setShowInfoPanel] = useState<boolean>(false);
  const [showNewChatModal, setShowNewChatModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeMessages = messages[activeConversationId] || [];
  const typingUsers = typingUsersMap[activeConversationId] || [];
  const hasMoreMessages = !!hasMoreMap[activeConversationId];
  const loadingOlderMessages = loadingOlder;

  // API Call Helpers
  const fetchConversations = async () => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const formatted = data.map((c: any) => ({
           id: c.id.toString(),
           type: c.type,
           name: c.name || 'Unknown',
           avatar: c.avatar || 'https://ui-avatars.com/api/?name=U',
           participants: c.participants.map((p: any) => ({
             id: p.id.toString(), name: p.name, avatar: p.avatar, status: p.status
           })),
           lastMessage: c.lastMessage || 'Start a conversation',
           lastMessageTimestamp: c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
           unreadCount: c.unreadCount || 0,
           isPinned: false,
           isMuted: false
        }));
        setConversations(formatted);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async (convId: string, limit = 30) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/conversations/${convId}/messages?limit=${limit}&format=paginated`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const rawMessages = Array.isArray(data) ? data : (data.messages || []);
        const hasMore = Array.isArray(data) ? (res.headers.get('X-Has-More') === 'true') : !!data.pagination?.hasMore;
        setHasMoreMap(prev => ({ ...prev, [convId]: hasMore }));

        const formatted = rawMessages.map((m: any) => ({
          id: m.id.toString(),
          conversationId: m.conversation_id.toString(),
          senderId: m.sender_id.toString(),
          type: m.type as MessageType,
          content: m.content,
          status: m.status,
          isEdited: !!m.is_edited,
          updatedAt: m.updated_at,
          readAt: m.read_at,
          deliveredAt: m.delivered_at,
          timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        setMessages(prev => ({ ...prev, [convId]: formatted }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadOlderMessages = async () => {
    if (!activeConversationId || loadingOlder || !hasMoreMap[activeConversationId]) return;
    const currentList = messages[activeConversationId] || [];
    const oldestMsg = currentList[0];
    if (!oldestMsg) return;

    setLoadingOlder(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/conversations/${activeConversationId}/messages?before=${oldestMsg.id}&limit=30&format=paginated`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const rawMessages = Array.isArray(data) ? data : (data.messages || []);
        const hasMore = Array.isArray(data) ? (res.headers.get('X-Has-More') === 'true') : !!data.pagination?.hasMore;
        setHasMoreMap(prev => ({ ...prev, [activeConversationId]: hasMore }));

        const olderFormatted = rawMessages.map((m: any) => ({
          id: m.id.toString(),
          conversationId: m.conversation_id.toString(),
          senderId: m.sender_id.toString(),
          type: m.type as MessageType,
          content: m.content,
          status: m.status,
          isEdited: !!m.is_edited,
          updatedAt: m.updated_at,
          readAt: m.read_at,
          deliveredAt: m.delivered_at,
          timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));

        setMessages(prev => {
          const existing = prev[activeConversationId] || [];
          const existingIds = new Set(existing.map(m => m.id));
          const uniqueOlder = olderFormatted.filter((m: any) => !existingIds.has(m.id));
          return {
            ...prev,
            [activeConversationId]: [...uniqueOlder, ...existing]
          };
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Socket Connection and Listeners
  useEffect(() => {
    if (!isAuthenticated) {
      socketService.disconnect();
      return;
    }

    let wasDisconnected = false;
    let dismissTimeout: ReturnType<typeof setTimeout> | null = null;
    const unsubState = socketService.onStateChange((state) => {
      setConnectionState(state);
      if (dismissTimeout) clearTimeout(dismissTimeout);
      if (state === 'reconnecting') {
        wasDisconnected = true;
        setNetworkNotification('reconnecting');
      } else if (state === 'disconnected') {
        wasDisconnected = true;
        setNetworkNotification('offline');
      } else if (state === 'connected') {
        if (wasDisconnected) {
          setNetworkNotification('reconnected');
          dismissTimeout = setTimeout(() => {
            setNetworkNotification(null);
          }, 3500);
          wasDisconnected = false;
        } else {
          setNetworkNotification(null);
        }
      }
    });

    const token = localStorage.getItem('token');
    if (token) {
      socketService.connect(token);
      const socket = socketService.getSocket();
      if (socket) {
        const handleSync = () => {
          fetchConversations();
          if (activeConversationIdRef.current) {
            socket.emit('conversation:join', activeConversationIdRef.current);
            fetchMessages(activeConversationIdRef.current);
          }
        };

        socket.on('connect', handleSync);
        socket.io.on('reconnect', handleSync);

        socket.on('message:new', (message: any) => {
          const formatted: Message = {
            id: message.id.toString(),
            conversationId: message.conversation_id.toString(),
            senderId: message.sender_id.toString(),
            type: message.type,
            content: message.content,
            status: message.status,
            timestamp: new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          setMessages(prev => {
            const list = prev[formatted.conversationId] || [];
            if (list.some(m => m.id === formatted.id)) return prev;
            return {
              ...prev,
              [formatted.conversationId]: [...list, formatted]
            };
          });

          const isActive = activeConversationIdRef.current === formatted.conversationId;
          const isFromOther = formatted.senderId !== currentUser.id;

          setConversations(prev => prev.map(c => 
            c.id === formatted.conversationId ? {
              ...c,
              lastMessage: formatted.content,
              lastMessageTimestamp: formatted.timestamp,
              unreadCount: isActive ? 0 : c.unreadCount + 1
            } : c
          ));

          if (isFromOther) {
            playSound('receive');
            socket.emit('message:delivered', { messageId: message.id, conversationId: message.conversation_id });
            if (isActive) {
              socket.emit('message:read', { messageId: message.id, conversationId: message.conversation_id });
            }
          }
        });

        socket.on('message:sent', (message: any) => {
          const actualId = message.id.toString();
          const convId = message.conversation_id.toString();
          setMessages(prev => ({
            ...prev,
            [convId]: (prev[convId] || []).map(m => 
              (m.id.startsWith('temp_') && m.content === message.content) ? { ...m, id: actualId, status: 'sent' } : m
            )
          }));
        });

        socket.on('message:update', ({ messageId, conversationId, status, readAt, deliveredAt }: any) => {
          const convKey = conversationId?.toString();
          setMessages(prev => {
            if (!convKey) return prev;
            return {
              ...prev,
              [convKey]: (prev[convKey] || []).map(m => {
                if (messageId && m.id === messageId.toString()) {
                  return { ...m, status, readAt: readAt || m.readAt, deliveredAt: deliveredAt || m.deliveredAt };
                }
                if (!messageId && status === 'read' && m.senderId === currentUser.id) {
                  return { ...m, status: 'read', readAt: readAt || m.readAt };
                }
                return m;
              })
            };
          });
        });

        socket.on('message:edited', ({ messageId, conversationId, content, isEdited, updatedAt }: any) => {
          const convKey = conversationId?.toString();
          setMessages(prev => ({
            ...prev,
            [convKey]: (prev[convKey] || []).map(m =>
              m.id === messageId.toString()
                ? { ...m, content, isEdited: isEdited !== undefined ? isEdited : true, updatedAt }
                : m
            )
          }));
        });

        socket.on('message:deleted', ({ messageId, conversationId }: any) => {
          const convKey = conversationId?.toString();
          setMessages(prev => ({
            ...prev,
            [convKey]: (prev[convKey] || []).filter(m => m.id !== messageId.toString())
          }));
        });

        // Online presence updates
        const handlePresence = ({ userId, status }: any) => {
          const targetId = userId.toString();
          setConversations(prev =>
            prev.map(c => {
              let updated = false;
              const updatedParts = c.participants.map(p => {
                if (p.id === targetId) {
                  updated = true;
                  return { ...p, status };
                }
                return p;
              });
              if (c.type === 'direct') {
                const other = c.participants.find(p => p.id !== currentUser.id);
                if (other && other.id === targetId) {
                  return { ...c, status, participants: updatedParts };
                }
              }
              return updated ? { ...c, participants: updatedParts } : c;
            })
          );
        };

        socket.on('user:online', handlePresence);
        socket.on('user:offline', handlePresence);
        socket.on('user:status', handlePresence);

        socket.on('typing:start', ({ conversationId, userId }: any) => {
          const convKey = conversationId.toString();
          setTypingUsersMap(prev => {
            const current = prev[convKey] || [];
            if (!current.includes(userId.toString())) {
              return { ...prev, [convKey]: [...current, userId.toString()] };
            }
            return prev;
          });
        });

        socket.on('typing:stop', ({ conversationId, userId }: any) => {
          const convKey = conversationId.toString();
          setTypingUsersMap(prev => {
            const current = prev[convKey] || [];
            return { ...prev, [convKey]: current.filter(id => id !== userId.toString()) };
          });
        });
      }
    }

    fetchConversations();

    return () => {
      unsubState();
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('message:new');
        socket.off('message:sent');
        socket.off('message:update');
        socket.off('message:edited');
        socket.off('message:deleted');
        socket.off('user:online');
        socket.off('user:offline');
        socket.off('user:status');
        socket.off('typing:start');
        socket.off('typing:stop');
      }
    };
  }, [isAuthenticated]);

  const setActiveConversationId = (id: string) => {
    const socket = socketService.getSocket();
    if (activeConversationId && socket) {
      socket.emit('conversation:leave', activeConversationId);
    }
    setActiveConversationIdState(id);
    setReplyingToMessage(null);
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
    if (id) {
      if (socket) {
        socket.emit('conversation:join', id);
        socket.emit('message:read', { conversationId: id });
      }
      const token = localStorage.getItem('token');
      fetch(`/api/conversations/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
      fetchMessages(id);
    }
  };

  const setUserStatus = (status: UserStatus) => {
    setUserStatusState(status);
  };

  const togglePinConversation = (convId: string) => {
    setConversations(prev =>
      prev.map(c => (c.id === convId ? { ...c, isPinned: !c.isPinned } : c))
    );
  };

  const toggleMuteConversation = (convId: string) => {
    setConversations(prev =>
      prev.map(c => (c.id === convId ? { ...c, isMuted: !c.isMuted } : c))
    );
  };

  // Debounced Typing logic using useRef
  const typingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = React.useRef(false);

  const startTyping = () => {
    const socket = socketService.getSocket();
    if (socket && activeConversationId) {
      if (!isTypingRef.current) {
        socket.emit('typing:start', { conversationId: activeConversationId });
        isTypingRef.current = true;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { conversationId: activeConversationId });
        isTypingRef.current = false;
      }, 2500);
    }
  };

  const stopTyping = () => {
    const socket = socketService.getSocket();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (socket && activeConversationId && isTypingRef.current) {
      socket.emit('typing:stop', { conversationId: activeConversationId });
      isTypingRef.current = false;
    }
  };

  const sendMessage = (
    content: string,
    type: MessageType = 'text',
    attachments?: Attachment[],
    codeLanguage?: string,
    audioDuration?: number
  ) => {
    if (!activeConversationId) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newMsg: Message = {
      id: tempId,
      conversationId: activeConversationId,
      senderId: currentUser.id,
      type,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
      attachments,
      codeLanguage,
      audioDuration,
    };

    // Optimistic UI update
    setMessages(prev => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] || []), newMsg],
    }));

    setConversations(prev =>
      prev.map(c =>
        c.id === activeConversationId
          ? { ...c, lastMessage: `You: ${content}`, lastMessageTimestamp: newMsg.timestamp }
          : c
      )
    );

    setReplyingToMessage(null);
    playSound('send');
    stopTyping();

    const socket = socketService.getSocket();
    if (!socket || !socket.connected) {
      // Mark as failed if disconnected
      setTimeout(() => {
        setMessages(prev => ({
          ...prev,
          [activeConversationId]: (prev[activeConversationId] || []).map(m =>
            m.id === tempId ? { ...m, status: 'failed' } : m
          )
        }));
      }, 300);
      return;
    }

    let isHandled = false;
    const timeoutHandle = setTimeout(() => {
      if (!isHandled) {
        isHandled = true;
        setMessages(prev => ({
          ...prev,
          [activeConversationId]: (prev[activeConversationId] || []).map(m =>
            m.id === tempId ? { ...m, status: 'failed' } : m
          )
        }));
      }
    }, 8000);

    socket.emit('message:send', { conversationId: activeConversationId, content, type }, (response: any) => {
      if (isHandled) return;
      isHandled = true;
      clearTimeout(timeoutHandle);

      if (response && response.message) {
        const actualId = response.message.id.toString();
        setMessages(prev => ({
          ...prev,
          [activeConversationId]: (prev[activeConversationId] || []).map(m =>
            m.id === tempId ? { ...m, id: actualId, status: 'sent' } : m
          )
        }));
      } else {
        setMessages(prev => ({
          ...prev,
          [activeConversationId]: (prev[activeConversationId] || []).map(m =>
            m.id === tempId ? { ...m, status: 'failed' } : m
          )
        }));
      }
    });
  };

  const retryMessage = (tempId: string) => {
    if (!activeConversationId) return;
    const msg = (messages[activeConversationId] || []).find(m => m.id === tempId);
    if (!msg) return;

    setMessages(prev => ({
      ...prev,
      [activeConversationId]: (prev[activeConversationId] || []).map(m =>
        m.id === tempId ? { ...m, status: 'sending' } : m
      )
    }));

    const socket = socketService.getSocket();
    if (!socket || !socket.connected) {
      setTimeout(() => {
        setMessages(prev => ({
          ...prev,
          [activeConversationId]: (prev[activeConversationId] || []).map(m =>
            m.id === tempId ? { ...m, status: 'failed' } : m
          )
        }));
      }, 400);
      return;
    }

    socket.emit('message:send', { conversationId: activeConversationId, content: msg.content, type: msg.type }, (response: any) => {
      if (response && response.message) {
        const actualId = response.message.id.toString();
        setMessages(prev => ({
          ...prev,
          [activeConversationId]: (prev[activeConversationId] || []).map(m =>
            m.id === tempId ? { ...m, id: actualId, status: 'sent' } : m
          )
        }));
      } else {
        setMessages(prev => ({
          ...prev,
          [activeConversationId]: (prev[activeConversationId] || []).map(m =>
            m.id === tempId ? { ...m, status: 'failed' } : m
          )
        }));
      }
    });
  };

  const editMessage = async (messageId: string, newContent: string) => {
    if (!activeConversationId) return;
    const trimmed = newContent.trim();
    if (!trimmed) return;

    // Optimistic local update
    setMessages(prev => ({
      ...prev,
      [activeConversationId]: (prev[activeConversationId] || []).map(m =>
        m.id === messageId ? { ...m, content: trimmed, isEdited: true } : m
      )
    }));

    const socket = socketService.getSocket();
    if (socket && socket.connected) {
      socket.emit('message:edit', { messageId, conversationId: activeConversationId, content: trimmed });
    }

    const token = localStorage.getItem('token');
    await fetch(`/api/conversations/${activeConversationId}/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: trimmed })
    }).catch(console.error);
  };

  const deleteMessage = async (messageId: string) => {
    if (!activeConversationId) return;

    // Optimistic local removal
    setMessages(prev => ({
      ...prev,
      [activeConversationId]: (prev[activeConversationId] || []).filter(m => m.id !== messageId)
    }));

    const socket = socketService.getSocket();
    if (socket && socket.connected) {
      socket.emit('message:delete', { messageId, conversationId: activeConversationId });
    }

    const token = localStorage.getItem('token');
    await fetch(`/api/conversations/${activeConversationId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }).catch(console.error);
  };

  const createConversation = async (_name: string, type: 'direct' | 'group', selectedUserIds: string[]) => {
    if (type === 'direct' && selectedUserIds.length > 0) {
       const token = localStorage.getItem('token');
       try {
         const res = await fetch('/api/conversations', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${token}`,
             'Content-Type': 'application/json'
           },
           body: JSON.stringify({ userId: selectedUserIds[0] })
         });
         
         if (res.ok) {
           const data = await res.json();
           await fetchConversations();
           setActiveConversationId(data.id.toString());
           setShowNewChatModal(false);
         }
       } catch (e) {
         console.error(e);
       }
    }
  };

  const addReaction = (_messageId: string, _emoji: string) => {};
  const togglePinMessage = (_messageId: string) => {};

  return (
    <ChatContext.Provider
      value={{
        connectionState,
        networkNotification,
        conversations,
        activeConversation,
        activeMessages,
        currentUser,
        userStatus,
        setUserStatus,
        setActiveConversationId,
        sendMessage,
        retryMessage,
        editMessage,
        deleteMessage,
        hasMoreMessages,
        loadingOlderMessages,
        loadOlderMessages,
        replyingToMessage,
        setReplyingToMessage,
        addReaction,
        togglePinMessage,
        typingUsers,
        filterTab,
        setFilterTab,
        searchQuery,
        setSearchQuery,
        showInfoPanel,
        setShowInfoPanel,
        showNewChatModal,
        setShowNewChatModal,
        showSettingsModal,
        setShowSettingsModal,
        showProfileModal,
        setShowProfileModal,
        lightboxImage,
        setLightboxImage,
        createConversation,
        togglePinConversation,
        toggleMuteConversation,
        allUsers,
        refreshConversations: fetchConversations,
        startTyping,
        stopTyping
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
};
