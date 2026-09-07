import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Conversation, Message, User, UserStatus, Attachment, MessageType } from '../types/chat';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { socketService } from '../services/socket';

interface ChatContextType {
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
  replyingToMessage: Message | null;
  setReplyingToMessage: (msg: Message | null) => void;
  addReaction: (messageId: string, emoji: string) => void;
  togglePinMessage: (messageId: string) => void;
  deleteMessage: (messageId: string) => void;
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

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [activeConversationId, setActiveConversationIdState] = useState<string>('');
  
  const currentUser: User = authUser ? {
    id: authUser.id.toString(),
    name: authUser.name,
    avatar: authUser.avatar,
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
        // Convert DB format to local format
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

  const fetchMessages = async (convId: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const formatted = data.map((m: any) => ({
          id: m.id.toString(),
          conversationId: m.conversation_id.toString(),
          senderId: m.sender_id.toString(),
          type: m.type as MessageType,
          content: m.content,
          status: m.status,
          timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        setMessages(prev => ({ ...prev, [convId]: formatted }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Socket Connection and Listeners
  useEffect(() => {
    if (isAuthenticated) {
      const token = localStorage.getItem('token');
      if (token) {
        socketService.connect(token);
        const socket = socketService.getSocket();
        if (socket) {
          socket.on('connect', () => {
             fetchConversations();
             if (activeConversationId) {
                // Cannot easily read the latest state in this closure unless we use a ref or depend on it
                // Instead, just triggering fetchConversations is a good start.
             }
          });

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
             
             setMessages(prev => ({
               ...prev,
               [formatted.conversationId]: [...(prev[formatted.conversationId] || []), formatted]
             }));

             setConversations(prev => prev.map(c => 
               c.id === formatted.conversationId ? {
                 ...c,
                 lastMessage: formatted.content,
                 lastMessageTimestamp: formatted.timestamp,
                 unreadCount: activeConversationId === formatted.conversationId ? 0 : c.unreadCount + 1
               } : c
             ));

             if (formatted.senderId !== currentUser.id) {
                playSound('receive');
             }

             // Mark as read if active
             if (activeConversationId === formatted.conversationId && formatted.senderId !== currentUser.id) {
                socket.emit('message:read', { messageId: message.id, conversationId: message.conversation_id });
             }
          });

          socket.on('message:update', ({ messageId, conversationId, status }) => {
            setMessages(prev => ({
              ...prev,
              [conversationId]: (prev[conversationId] || []).map(m => 
                m.id === messageId.toString() ? { ...m, status } : m
              )
            }));
          });

          socket.on('typing:start', ({ conversationId }) => {
             setTypingUsersMap(prev => ({
                ...prev,
                [conversationId.toString()]: ['Someone'] // Enhance to get user name
             }));
          });

          socket.on('typing:stop', ({ conversationId }) => {
             setTypingUsersMap(prev => ({
                ...prev,
                [conversationId.toString()]: []
             }));
          });
        }
      }
      fetchConversations();
    } else {
      socketService.disconnect();
    }

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('message:new');
        socket.off('message:update');
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
    if (id && socket) {
      socket.emit('conversation:join', id);
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

  // Typing logic
  let typingTimeout: any = null;
  const startTyping = () => {
    const socket = socketService.getSocket();
    if (socket && activeConversationId) {
       socket.emit('typing:start', { conversationId: activeConversationId });
       clearTimeout(typingTimeout);
       typingTimeout = setTimeout(() => {
          socket.emit('typing:stop', { conversationId: activeConversationId });
       }, 2000);
    }
  };

  const stopTyping = () => {
     const socket = socketService.getSocket();
     if (socket && activeConversationId) {
        socket.emit('typing:stop', { conversationId: activeConversationId });
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

    const tempId = `temp_${Date.now()}`;
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

    // Optimistic UI
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
    if (socket) {
      socket.emit('message:send', { conversationId: activeConversationId, content, type }, (response: any) => {
        if (response && response.message) {
           const actualId = response.message.id.toString();
           // Update temp message with real ID and 'sent' status
           setMessages(prev => ({
             ...prev,
             [activeConversationId]: (prev[activeConversationId] || []).map(m => 
               m.id === tempId ? { ...m, id: actualId, status: 'sent' } : m
             )
           }));
        } else {
           // Handle error
           setMessages(prev => ({
             ...prev,
             [activeConversationId]: (prev[activeConversationId] || []).map(m => 
               m.id === tempId ? { ...m, status: 'error' as any } : m
             )
           }));
        }
      });
    }
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

  const addReaction = (_messageId: string, _emoji: string) => {
    // Left empty or mock for now, API can be added later
  };
  const togglePinMessage = (_messageId: string) => {};
  const deleteMessage = (_messageId: string) => {};

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversation,
        activeMessages,
        currentUser,
        userStatus,
        setUserStatus,
        setActiveConversationId,
        sendMessage,
        replyingToMessage,
        setReplyingToMessage,
        addReaction,
        togglePinMessage,
        deleteMessage,
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
