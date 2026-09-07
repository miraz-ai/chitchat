export type UserStatus = 'online' | 'away' | 'busy' | 'offline';

export type ThemeMode = 'cyber-dark' | 'midnight-indigo' | 'neon-synth' | 'clean-light';

export interface User {
  id: string;
  username?: string;
  name: string;
  avatar: string;
  status: UserStatus;
  statusMessage?: string;
  bio?: string;
  phone?: string;
  email?: string;
  isAi?: boolean;
}

export type MessageType = 'text' | 'image' | 'voice' | 'file' | 'code' | 'system';

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio';
  url: string;
  name: string;
  size?: string;
  mimeType?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[]; // user IDs
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string;
  timestamp: string; // ISO string or human formatted
  status?: MessageStatus;
  attachments?: Attachment[];
  reactions?: Reaction[];
  replyToId?: string;
  replyToSnippet?: {
    senderName: string;
    text: string;
  };
  isPinned?: boolean;
  codeLanguage?: string;
  audioDuration?: number; // seconds
}

export type ConversationType = 'direct' | 'group' | 'ai';

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string;
  avatar: string;
  participants: User[];
  lastMessage?: string;
  lastMessageTimestamp?: string;
  unreadCount: number;
  isPinned?: boolean;
  isMuted?: boolean;
  topic?: string;
  description?: string;
  sharedMedia?: Attachment[];
}

export interface CallState {
  active: boolean;
  type: 'audio' | 'video';
  user?: User;
  status: 'calling' | 'connected' | 'ended';
  duration: number; // in seconds
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
}
