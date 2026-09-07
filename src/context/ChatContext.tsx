import React, { createContext, useContext, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import type { Conversation, Message, User, UserStatus, Attachment, MessageType } from '../types/chat';
import { INITIAL_CONVERSATIONS, INITIAL_MESSAGES, CURRENT_USER, MOCK_USERS } from '../data/mockData';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';

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
  typingUsers: string[]; // names of users typing in active chat
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
  allUsers: User[];
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { playSound } = useTheme();

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem('pulse_chat_conversations');
    return saved ? JSON.parse(saved) : INITIAL_CONVERSATIONS;
  });

  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    const saved = localStorage.getItem('pulse_chat_messages');
    return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
  });

  const [activeConversationId, setActiveConversationIdState] = useState<string>('conv_sarah');
  const { user: authUser } = useAuth();
  
  // Use auth user if available, fallback to mock CURRENT_USER
  const currentUser = authUser ? {
    id: authUser.id.toString(),
    name: authUser.name,
    avatar: authUser.avatar,
    status: authUser.status as UserStatus || 'online',
    isAi: false
  } : CURRENT_USER;

  const [userStatus, setUserStatusState] = useState<UserStatus>(currentUser.status);

  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [typingUsersMap, setTypingUsersMap] = useState<Record<string, string[]>>({});
  const [filterTab, setFilterTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [showInfoPanel, setShowInfoPanel] = useState<boolean>(false);
  const [showNewChatModal, setShowNewChatModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Save state updates to localStorage
  useEffect(() => {
    localStorage.setItem('pulse_chat_conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('pulse_chat_messages', JSON.stringify(messages));
  }, [messages]);

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeMessages = messages[activeConversationId] || [];
  const typingUsers = typingUsersMap[activeConversationId] || [];

  const setUserStatus = (status: UserStatus) => {
    setUserStatusState(status);
  };

  const setActiveConversationId = (id: string) => {
    setActiveConversationIdState(id);
    setReplyingToMessage(null);
    // Clear unread count for this conversation
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  };

  const togglePinConversation = (convId: string) => {
    setConversations(prev =>
      prev.map(c => (c.id === convId ? { ...c, isPinned: !c.isPinned } : c))
    );
    playSound('pop');
  };

  const toggleMuteConversation = (convId: string) => {
    setConversations(prev =>
      prev.map(c => (c.id === convId ? { ...c, isMuted: !c.isMuted } : c))
    );
    playSound('pop');
  };

  const sendMessage = (
    content: string,
    type: MessageType = 'text',
    attachments?: Attachment[],
    codeLanguage?: string,
    audioDuration?: number
  ) => {
    if (!activeConversationId) return;

    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      conversationId: activeConversationId,
      senderId: currentUser.id,
      type,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      attachments,
      codeLanguage,
      audioDuration,
      replyToId: replyingToMessage?.id,
      replyToSnippet: replyingToMessage
        ? {
            senderName:
              replyingToMessage.senderId === currentUser.id
                ? 'You'
                : MOCK_USERS.find(u => u.id === replyingToMessage.senderId)?.name || 'User',
            text: replyingToMessage.content,
          }
        : undefined,
    };

    // Append to messages
    setMessages(prev => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] || []), newMsg],
    }));

    // Update conversation last message preview
    const previewText = type === 'voice' ? '🎙️ Voice note' : type === 'image' ? '📷 Image attachment' : type === 'file' ? '📁 Attachment file' : content;
    setConversations(prev =>
      prev.map(c =>
        c.id === activeConversationId
          ? {
              ...c,
              lastMessage: `You: ${previewText}`,
              lastMessageTimestamp: newMsg.timestamp,
            }
          : c
      )
    );

    setReplyingToMessage(null);
    playSound('send');

    // Simulate Read receipt & Auto-responder
    setTimeout(() => {
      setMessages(prev => ({
        ...prev,
        [activeConversationId]: (prev[activeConversationId] || []).map(m =>
          m.id === newMsg.id ? { ...m, status: 'delivered' } : m
        ),
      }));
    }, 1000);

    setTimeout(() => {
      setMessages(prev => ({
        ...prev,
        [activeConversationId]: (prev[activeConversationId] || []).map(m =>
          m.id === newMsg.id ? { ...m, status: 'read' } : m
        ),
      }));
    }, 2000);

    // Trigger simulated response if messaging Sarah or AI
    triggerSimulatedReply(activeConversationId, content);
  };

  const triggerSimulatedReply = (convId: string, userText: string) => {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;

    if (conv.type === 'ai') {
      // AI Response Logic
      const aiUser = MOCK_USERS.find(u => u.isAi)!;

      // Show typing indicator
      setTimeout(() => {
        setTypingUsersMap(prev => ({ ...prev, [convId]: [aiUser.name] }));
      }, 800);

      setTimeout(() => {
        setTypingUsersMap(prev => ({ ...prev, [convId]: [] }));

        let replyText = `✨ That's a great thought regarding "${userText}". Here is a helpful breakdown:\n\n1. **Core Concept**: Modern modular design enables rapid UI composition.\n2. **Performance**: Leveraging React 18 concurrent features yields 60fps animations.\n3. **Recommendation**: Keep state localized and use clean design tokens!`;

        if (userText.toLowerCase().includes('code') || userText.toLowerCase().includes('react')) {
          replyText = `Here is a custom React hook for handling asynchronous state seamlessly:\n\n\`\`\`typescript\nfunction useAsync<T>(asyncFunction: () => Promise<T>) {\n  const [data, setData] = useState<T | null>(null);\n  const [loading, setLoading] = useState(false);\n  useEffect(() => {\n    setLoading(true);\n    asyncFunction().then(setData).finally(() => setLoading(false));\n  }, []);\n  return { data, loading };\n}\n\`\`\``;
        } else if (userText.toLowerCase().includes('summary') || userText.toLowerCase().includes('summarize')) {
          replyText = `📋 **Summary of Active Engineering Threads**:\n- **Build v2.4.0**: Successfully deployed to Staging by Alex Rivera.\n- **Design System**: High-res mockups reviewed with Sarah Chen.\n- **WebSocket Specs**: Shared by Miraz for client real-time sync.`;
        }

        const aiMsg: Message = {
          id: `msg_ai_${Date.now()}`,
          conversationId: convId,
          senderId: aiUser.id,
          type: replyText.includes('```') ? 'code' : 'text',
          content: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'read',
          codeLanguage: replyText.includes('```') ? 'typescript' : undefined,
        };

        setMessages(prev => ({
          ...prev,
          [convId]: [...(prev[convId] || []), aiMsg],
        }));

        setConversations(prev =>
          prev.map(c =>
            c.id === convId
              ? {
                  ...c,
                  lastMessage: `${aiUser.name}: ${aiMsg.content.slice(0, 45)}...`,
                  lastMessageTimestamp: aiMsg.timestamp,
                }
              : c
          )
        );

        playSound('receive');
      }, 2500);
    } else if (conv.id === 'conv_sarah') {
      const sarah = MOCK_USERS[1];
      setTimeout(() => {
        setTypingUsersMap(prev => ({ ...prev, [convId]: [sarah.name] }));
      }, 1500);

      setTimeout(() => {
        setTypingUsersMap(prev => ({ ...prev, [convId]: [] }));
        const replyMsg: Message = {
          id: `msg_sarah_${Date.now()}`,
          conversationId: convId,
          senderId: sarah.id,
          type: 'text',
          content: 'Awesome! I am wrapping up the micro-animations spec sheet and will share it shortly! ✨',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'read',
        };

        setMessages(prev => ({
          ...prev,
          [convId]: [...(prev[convId] || []), replyMsg],
        }));

        setConversations(prev =>
          prev.map(c =>
            c.id === convId
              ? {
                  ...c,
                  lastMessage: `${sarah.name}: ${replyMsg.content}`,
                  lastMessageTimestamp: replyMsg.timestamp,
                }
              : c
          )
        );

        playSound('receive');
      }, 3500);
    }
  };

  const addReaction = (messageId: string, emoji: string) => {
    if (!activeConversationId) return;

    setMessages(prev => ({
      ...prev,
      [activeConversationId]: (prev[activeConversationId] || []).map(m => {
        if (m.id !== messageId) return m;

        const existingReactions = m.reactions || [];
        const found = existingReactions.find(r => r.emoji === emoji);

        let updatedReactions;
        if (found) {
          if (found.users.includes(currentUser.id)) {
            // Remove user reaction
            updatedReactions = existingReactions
              .map(r =>
                r.emoji === emoji
                  ? { ...r, count: r.count - 1, users: r.users.filter(u => u !== currentUser.id) }
                  : r
              )
              .filter(r => r.count > 0);
          } else {
            // Add user reaction to existing emoji
            updatedReactions = existingReactions.map(r =>
              r.emoji === emoji ? { ...r, count: r.count + 1, users: [...r.users, currentUser.id] } : r
            );
          }
        } else {
          // New emoji reaction
          updatedReactions = [...existingReactions, { emoji, count: 1, users: [currentUser.id] }];
        }

        return { ...m, reactions: updatedReactions };
      }),
    }));

    playSound('pop');

    // Trigger celebratory confetti burst for 🎉 or 🔥 or ❤️
    if (['🎉', '🔥', '🚀', '❤️'].includes(emoji)) {
      confetti({
        particleCount: 25,
        spread: 60,
        origin: { y: 0.7 },
      });
    }
  };

  const togglePinMessage = (messageId: string) => {
    if (!activeConversationId) return;
    setMessages(prev => ({
      ...prev,
      [activeConversationId]: (prev[activeConversationId] || []).map(m =>
        m.id === messageId ? { ...m, isPinned: !m.isPinned } : m
      ),
    }));
    playSound('pop');
  };

  const deleteMessage = (messageId: string) => {
    if (!activeConversationId) return;
    setMessages(prev => ({
      ...prev,
      [activeConversationId]: (prev[activeConversationId] || []).filter(m => m.id !== messageId),
    }));
    playSound('pop');
  };

  const createConversation = (name: string, type: 'direct' | 'group', selectedUserIds: string[]) => {
    const selectedUsers = MOCK_USERS.filter(u => selectedUserIds.includes(u.id));
    const newConv: Conversation = {
      id: `conv_${Date.now()}`,
      type,
      name,
      avatar:
        type === 'group'
          ? 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=250&q=80'
          : selectedUsers[0]?.avatar || CURRENT_USER.avatar,
      participants: [CURRENT_USER, ...selectedUsers],
      lastMessage: 'Conversation created',
      lastMessageTimestamp: 'Just now',
      unreadCount: 0,
      isPinned: false,
    };

    setConversations(prev => [newConv, ...prev]);
    setMessages(prev => ({ ...prev, [newConv.id]: [] }));
    setActiveConversationId(newConv.id);
    setShowNewChatModal(false);
    playSound('pop');
  };

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
        allUsers: MOCK_USERS,
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
