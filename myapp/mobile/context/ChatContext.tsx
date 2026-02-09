import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { apiGetAuth, apiPostAuth } from '../api/client';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type Message = {
  _id: string;
  conversationId: string;
  senderId: string;
  senderType: 'customer' | 'seller';
  content: string;
  messageType: 'text' | 'image' | 'system' | 'call_started' | 'call_ended';
  imageUrl?: string;
  readAt?: string;
  createdAt: string;
};

export type Conversation = {
  _id: string;
  shopId: string;
  shopName: string;
  shopImage?: string;
  customerId?: string;
  customerName?: string;
  sellerId?: string;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageSender?: 'customer' | 'seller';
  unreadCount: number;
};

type TypingUser = {
  conversationId: string;
  userId: string;
  isTyping: boolean;
};

type ChatContextValue = {
  socket: Socket | null;
  isConnected: boolean;
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  typingUsers: TypingUser[];
  totalUnread: number;

  // Actions
  loadConversations: () => Promise<void>;
  startConversation: (shopId: string) => Promise<Conversation | null>;
  openConversation: (conversation: Conversation) => void;
  closeConversation: () => void;
  loadMessages: (conversationId: string, before?: string) => Promise<Message[]>;
  sendMessage: (content: string, messageType?: string, imageUrl?: string) => void;
  markAsRead: (conversationId: string) => void;
  setTyping: (isTyping: boolean) => void;
  refreshUnreadCount: () => Promise<void>;
};

// -----------------------------------------------------------------------------
// Socket URL
// -----------------------------------------------------------------------------

const SOCKET_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace('/api', '') ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:5007' : 'http://localhost:5007');

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, getIdToken } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);

  // Keep ref in sync so socket handlers always see current conversation
  useEffect(() => {
    currentConversationIdRef.current = currentConversation?._id ?? null;
  }, [currentConversation]);

  // Connect to socket when user is authenticated (Firebase or session JWT)
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const connectSocket = async () => {
      try {
        const token = await getIdToken();
        if (!token) {
          console.log('[Chat] No auth token, skipping socket connection');
          return;
        }

        console.log('[Chat] Connecting to socket:', SOCKET_URL);

        const socket = io(SOCKET_URL, {
          auth: { token },
          transports: ['polling', 'websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
          console.log('[Chat] Socket connected');
          setIsConnected(true);
        });

        socket.on('disconnect', (reason) => {
          console.log('[Chat] Socket disconnected:', reason);
          setIsConnected(false);
        });

        socket.on('connect_error', (error) => {
          console.error('[Chat] Socket connection error:', error.message);
          setIsConnected(false);
        });

        // Handle new messages (use ref so we always have latest conversation id)
        socket.on('new_message', (data: { message: Message }) => {
          console.log('[Chat] New message received:', data.message._id);

          const isInThisConversation = currentConversationIdRef.current === data.message.conversationId;

          // Add to messages if in same conversation
          if (isInThisConversation) {
            setMessages((prev) => {
              // Avoid duplicates by server id
              if (prev.some((m) => m._id === data.message._id)) return prev;
              // Replace optimistic (temp) message with same content from same sender
              const withoutOptimistic = prev.filter(
                (m) =>
                  !(
                    m._id.startsWith('temp-') &&
                    m.content === data.message.content &&
                    m.senderType === data.message.senderType
                  )
              );
              return [...withoutOptimistic, data.message];
            });
          }

          // Update conversation list
          setConversations((prev) =>
            prev.map((c) =>
              c._id === data.message.conversationId
                ? {
                    ...c,
                    lastMessage: data.message.content,
                    lastMessageAt: data.message.createdAt,
                    lastMessageSender: data.message.senderType,
                    unreadCount: isInThisConversation ? c.unreadCount : c.unreadCount + 1,
                  }
                : c
            )
          );
        });

        // Handle conversation updates
        socket.on('conversation_updated', (data: {
          conversationId: string;
          lastMessage: string;
          lastMessageAt: string;
          unreadIncrement: number;
        }) => {
          setConversations((prev) =>
            prev.map((c) =>
              c._id === data.conversationId
                ? {
                    ...c,
                    lastMessage: data.lastMessage,
                    lastMessageAt: data.lastMessageAt,
                    unreadCount: c.unreadCount + data.unreadIncrement,
                  }
                : c
            )
          );
          setTotalUnread((prev) => prev + data.unreadIncrement);
        });

        // Handle typing indicators
        socket.on('user_typing', (data: TypingUser) => {
          setTypingUsers((prev) => {
            const existing = prev.findIndex(
              (t) => t.conversationId === data.conversationId && t.userId === data.userId
            );
            if (data.isTyping) {
              if (existing >= 0) return prev;
              return [...prev, data];
            } else {
              if (existing < 0) return prev;
              return prev.filter((_, i) => i !== existing);
            }
          });
        });

        // Handle read receipts
        socket.on('messages_marked_read', (data: { conversationId: string }) => {
          setConversations((prev) =>
            prev.map((c) =>
              c._id === data.conversationId ? { ...c, unreadCount: 0 } : c
            )
          );
        });

        socketRef.current = socket;
      } catch (error) {
        console.error('[Chat] Failed to connect socket:', error);
      }
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, getIdToken]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const response = await apiGetAuth<{ conversations: Conversation[] }>('/conversations');
      setConversations(response.conversations);
    } catch (error) {
      console.error('[Chat] Failed to load conversations:', error);
    }
  }, []);

  // Start a new conversation with a shop
  const startConversation = useCallback(async (shopId: string): Promise<Conversation | null> => {
    try {
      const response = await apiPostAuth<{ conversation: Conversation }>(
        '/conversations/start',
        { shopId }
      );
      
      // Add to conversations if not already there
      setConversations((prev) => {
        if (prev.some((c) => c._id === response.conversation._id)) {
          return prev;
        }
        return [response.conversation, ...prev];
      });

      return response.conversation;
    } catch (error) {
      console.error('[Chat] Failed to start conversation:', error);
      return null;
    }
  }, []);

  // Open a conversation
  const openConversation = useCallback((conversation: Conversation) => {
    setCurrentConversation(conversation);
    setMessages([]);

    // Join socket room
    if (socketRef.current) {
      socketRef.current.emit('join_conversation', { conversationId: conversation._id });
    }
  }, []);

  // Close current conversation
  const closeConversation = useCallback(() => {
    if (currentConversation && socketRef.current) {
      socketRef.current.emit('leave_conversation', { conversationId: currentConversation._id });
    }
    setCurrentConversation(null);
    setMessages([]);
  }, [currentConversation]);

  // Load messages for a conversation
  const loadMessages = useCallback(
    async (conversationId: string, before?: string): Promise<Message[]> => {
      try {
        const query = before ? `?before=${before}&limit=50` : '?limit=50';
        const response = await apiGetAuth<{ messages: Message[] }>(
          `/conversations/${conversationId}/messages${query}`
        );

        if (!before) {
          // Initial load
          setMessages(response.messages);
        } else {
          // Load older messages
          setMessages((prev) => [...response.messages, ...prev]);
        }

        return response.messages;
      } catch (error) {
        console.error('[Chat] Failed to load messages:', error);
        return [];
      }
    },
    []
  );

  // Send a message (optimistic update so sender sees their message immediately)
  const sendMessage = useCallback(
    (content: string, messageType = 'text', imageUrl?: string) => {
      if (!currentConversation || !socketRef.current) return;

      const myId = (user?._id ?? (user as any)?.uid ?? '').toString();
      const senderType: 'customer' | 'seller' =
        (currentConversation.customerId?.toString() ?? '') === myId ? 'customer' : 'seller';

      const optimisticMessage: Message = {
        _id: 'temp-' + Date.now(),
        conversationId: currentConversation._id,
        senderId: myId,
        senderType,
        content,
        messageType: messageType as Message['messageType'],
        imageUrl,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => {
        // If server already confirmed (new_message arrived before this state update), don't add duplicate
        if (prev.some((m) => m.content === content && m.senderId === myId && !m._id.startsWith('temp-'))) {
          return prev;
        }
        return [...prev, optimisticMessage];
      });

      socketRef.current.emit('send_message', {
        conversationId: currentConversation._id,
        content,
        messageType,
        imageUrl,
      });
    },
    [currentConversation, user]
  );

  // Mark conversation as read
  const markAsRead = useCallback((conversationId: string) => {
    if (!socketRef.current) return;

    socketRef.current.emit('mark_read', { conversationId });

    // Update local state
    setConversations((prev) =>
      prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c))
    );

    // Update total unread
    setTotalUnread((prev) => {
      const conv = conversations.find((c) => c._id === conversationId);
      return Math.max(0, prev - (conv?.unreadCount || 0));
    });
  }, [conversations]);

  // Set typing indicator
  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!currentConversation || !socketRef.current) return;

      socketRef.current.emit('typing', {
        conversationId: currentConversation._id,
        isTyping,
      });
    },
    [currentConversation]
  );

  // Refresh total unread count
  const refreshUnreadCount = useCallback(async () => {
    try {
      const response = await apiGetAuth<{ unreadCount: number }>('/conversations/unread/count');
      setTotalUnread(response.unreadCount);
    } catch (error) {
      console.error('[Chat] Failed to get unread count:', error);
    }
  }, []);

  // Load conversations and unread count when authenticated
  useEffect(() => {
    if (user) {
      loadConversations();
      refreshUnreadCount();
    }
  }, [user, loadConversations, refreshUnreadCount]);

  const value: ChatContextValue = {
    socket: socketRef.current,
    isConnected,
    conversations,
    currentConversation,
    messages,
    typingUsers,
    totalUnread,
    loadConversations,
    startConversation,
    openConversation,
    closeConversation,
    loadMessages,
    sendMessage,
    markAsRead,
    setTyping,
    refreshUnreadCount,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
