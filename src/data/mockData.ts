import type { User, Conversation, Message } from '../types/chat';

export const CURRENT_USER: User = {
  id: 'user_me',
  name: 'Miraz Rahman',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
  status: 'online',
  statusMessage: '🚀 Building awesome React web apps',
  bio: 'Senior Full Stack Engineer & UI Enthusiast. Crafting clean code and delightful UX.',
  email: 'miraz.dev@example.com',
  phone: '+1 (555) 382-9901',
};

export const MOCK_USERS: User[] = [
  CURRENT_USER,
  {
    id: 'user_sarah',
    name: 'Sarah Chen',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
    status: 'online',
    statusMessage: 'Designing the new design system 🎨',
    bio: 'Lead Product Designer @ Stripe. Passionate about micro-interactions and accessibility.',
    email: 'sarah.c@design.io',
    phone: '+1 (555) 234-8890',
  },
  {
    id: 'user_alex',
    name: 'Alex Rivera',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
    status: 'away',
    statusMessage: 'In a deep focus coding sprint ⚡',
    bio: 'Backend Specialist & Cloud Architect. Go, Rust, Distributed Systems.',
    email: 'alex.r@cloudops.dev',
    phone: '+1 (555) 876-1122',
  },
  {
    id: 'user_elena',
    name: 'Elena Rostova',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
    status: 'busy',
    statusMessage: 'Do not disturb — Launching V2 🚀',
    bio: 'VP of Product Engineering. Building high impact user experiences.',
    email: 'elena@techflow.app',
    phone: '+1 (555) 998-3344',
  },
  {
    id: 'user_ai',
    name: 'Pulse AI Assistant',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=250&q=80',
    status: 'online',
    statusMessage: 'Always here to assist with code, design & ideas ✨',
    bio: 'Next-gen Intelligent AI Companion built into Pulse Chat.',
    isAi: true,
  },
];

export const INITIAL_MESSAGES: Record<string, Message[]> = {
  'conv_sarah': [
    {
      id: 'm1',
      conversationId: 'conv_sarah',
      senderId: 'user_sarah',
      type: 'text',
      content: 'Hey Miraz! 👋 Did you check out the new design prototypes for the chat dashboard?',
      timestamp: '10:14 AM',
      status: 'read',
      reactions: [{ emoji: '👍', count: 1, users: ['user_me'] }],
    },
    {
      id: 'm2',
      conversationId: 'conv_sarah',
      senderId: 'user_me',
      type: 'text',
      content: 'Yes! The glassmorphic panels and smooth transitions look stunning! Super sleek colors.',
      timestamp: '10:16 AM',
      status: 'read',
    },
    {
      id: 'm3',
      conversationId: 'conv_sarah',
      senderId: 'user_sarah',
      type: 'image',
      content: 'Here is the high-res render of the desktop layout mockup.',
      timestamp: '10:18 AM',
      status: 'read',
      attachments: [
        {
          id: 'att_1',
          type: 'image',
          url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
          name: 'Dashboard_Mockup_v2.png',
          size: '2.4 MB',
        },
      ],
      reactions: [{ emoji: '🔥', count: 2, users: ['user_me', 'user_sarah'] }],
    },
    {
      id: 'm4',
      conversationId: 'conv_sarah',
      senderId: 'user_sarah',
      type: 'code',
      content: `// React Theme Switcher Hook
export const useTheme = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  return { theme, toggleTheme };
};`,
      codeLanguage: 'typescript',
      timestamp: '10:20 AM',
      status: 'read',
    },
    {
      id: 'm5',
      conversationId: 'conv_sarah',
      senderId: 'user_sarah',
      type: 'voice',
      content: 'Audio message from Sarah',
      timestamp: '10:22 AM',
      status: 'read',
      audioDuration: 18,
    },
  ],

  'conv_eng_team': [
    {
      id: 'm_eng_1',
      conversationId: 'conv_eng_team',
      senderId: 'user_alex',
      type: 'text',
      content: 'Morning team! We just deployed build v2.4.0 to Staging environment. All automated tests passed ✅',
      timestamp: '09:00 AM',
      status: 'read',
      isPinned: true,
      reactions: [{ emoji: '🚀', count: 3, users: ['user_me', 'user_sarah', 'user_elena'] }],
    },
    {
      id: 'm_eng_2',
      conversationId: 'conv_eng_team',
      senderId: 'user_elena',
      type: 'text',
      content: 'Awesome work Alex! Let us run a quick regression test before our 2 PM sprint demo.',
      timestamp: '09:12 AM',
      status: 'read',
    },
    {
      id: 'm_eng_3',
      conversationId: 'conv_eng_team',
      senderId: 'user_me',
      type: 'file',
      content: 'Here are the API Specs documentation for the new WebSockets events payload.',
      timestamp: '09:30 AM',
      status: 'read',
      attachments: [
        {
          id: 'att_doc1',
          type: 'file',
          url: '#',
          name: 'WebSocket_API_Specs_v2.pdf',
          size: '1.8 MB',
        },
      ],
    },
  ],

  'conv_ai': [
    {
      id: 'm_ai_1',
      conversationId: 'conv_ai',
      senderId: 'user_ai',
      type: 'text',
      content: 'Hello Miraz! I am Pulse AI, your intelligent assistant. How can I help you today? Ask me to write code, review designs, generate ideas, or summarize discussions!',
      timestamp: '08:00 AM',
      status: 'read',
      reactions: [{ emoji: '✨', count: 1, users: ['user_me'] }],
    },
  ],

  'conv_alex': [
    {
      id: 'm_alex_1',
      conversationId: 'conv_alex',
      senderId: 'user_alex',
      type: 'text',
      content: 'Hey Miraz, do you have a few minutes for a quick voice call to sync on the database schema indexing?',
      timestamp: 'Yesterday',
      status: 'read',
    },
  ],
};

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv_sarah',
    type: 'direct',
    name: 'Sarah Chen',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
    participants: [CURRENT_USER, MOCK_USERS[1]],
    lastMessage: 'Audio message from Sarah',
    lastMessageTimestamp: '10:22 AM',
    unreadCount: 2,
    isPinned: true,
    topic: 'UI/UX Design & Prototypes',
    sharedMedia: [
      {
        id: 'att_1',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
        name: 'Dashboard_Mockup_v2.png',
        size: '2.4 MB',
      },
    ],
  },
  {
    id: 'conv_eng_team',
    type: 'group',
    name: '#engineering-core',
    avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=250&q=80',
    participants: [CURRENT_USER, MOCK_USERS[1], MOCK_USERS[2], MOCK_USERS[3]],
    lastMessage: 'Miraz: Here are the API Specs documentation...',
    lastMessageTimestamp: '09:30 AM',
    unreadCount: 0,
    isPinned: true,
    topic: 'Core Frontend & Backend Infrastructure Channel',
    description: 'Engineering discussions, release updates, pull requests and architecture.',
  },
  {
    id: 'conv_ai',
    type: 'ai',
    name: 'Pulse AI Assistant',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=250&q=80',
    participants: [CURRENT_USER, MOCK_USERS[4]],
    lastMessage: 'Hello Miraz! I am Pulse AI, your intelligent assistant...',
    lastMessageTimestamp: '08:00 AM',
    unreadCount: 0,
    isPinned: false,
    topic: 'Gemini AI Intelligent Assistant',
  },
  {
    id: 'conv_alex',
    type: 'direct',
    name: 'Alex Rivera',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
    participants: [CURRENT_USER, MOCK_USERS[2]],
    lastMessage: 'Hey Miraz, do you have a few minutes for a quick voice call...',
    lastMessageTimestamp: 'Yesterday',
    unreadCount: 0,
    isPinned: false,
    topic: 'Backend & Cloud Infrastructure',
  },
];

export const SMART_AI_CHIPS = [
  '⚡ Summarize recent team messages',
  '💻 Generate React custom hook snippet',
  '🎨 Suggest color palette contrast ratios',
  '📅 Schedule team sync for tomorrow 3 PM',
];
