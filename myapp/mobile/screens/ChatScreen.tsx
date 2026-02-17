import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '../components/BackButton';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { useChat, Conversation, Message } from '../context/ChatContext';
import { useCall } from '../context/CallContext';
import { useAuth } from '../context/AuthContext';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = {
  conversation: Conversation;
  onBack: () => void;
};

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateHeader(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  
  return date.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function shouldShowDateHeader(current: Message, previous?: Message): boolean {
  if (!previous) return true;
  const currentDate = new Date(current.createdAt).toDateString();
  const previousDate = new Date(previous.createdAt).toDateString();
  return currentDate !== previousDate;
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function MessageBubble({
  message,
  isOwn,
  showDate,
}: {
  message: Message;
  isOwn: boolean;
  showDate: boolean;
}) {
  const isSystemMessage = message.messageType === 'system' ||
    message.messageType === 'call_started' ||
    message.messageType === 'call_ended';

  if (isSystemMessage) {
    return (
      <View style={styles.systemMessageContainer}>
        {showDate && (
          <Text style={styles.dateHeader}>{formatDateHeader(message.createdAt)}</Text>
        )}
        <View style={styles.systemMessage}>
          <Ionicons
            name={message.messageType === 'call_ended' ? 'call' : 'information-circle'}
            size={14}
            color={colors.mutedForeground}
          />
          <Text style={styles.systemMessageText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      {showDate && (
        <Text style={styles.dateHeader}>{formatDateHeader(message.createdAt)}</Text>
      )}
      <View style={[styles.messageBubbleContainer, isOwn && styles.messageBubbleContainerOwn]}>
        <View style={[styles.messageBubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          {message.imageUrl && (
            <Image source={{ uri: message.imageUrl }} style={styles.messageImage} />
          )}
          <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
            {message.content}
          </Text>
          <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
            {formatMessageTime(message.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={styles.typingContainer}>
      <View style={styles.typingBubble}>
        <View style={styles.typingDots}>
          <View style={[styles.typingDot, styles.typingDot1]} />
          <View style={[styles.typingDot, styles.typingDot2]} />
          <View style={[styles.typingDot, styles.typingDot3]} />
        </View>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function ChatScreen({ conversation, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { user } = useAuth();
  const {
    messages,
    typingUsers,
    openConversation,
    closeConversation,
    loadMessages,
    sendMessage,
    markAsRead,
    setTyping,
    isConnected,
  } = useChat();
  const { requestCall, isAgoraConfigured } = useCall();

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const isSeller = user?.role === 'seller';
  const displayName = isSeller ? conversation.customerName : conversation.shopName;

  const isOtherTyping = typingUsers.some(
    (t) => t.conversationId === conversation._id && t.userId !== user?._id
  );

  // Open conversation and load messages
  useEffect(() => {
    openConversation(conversation);
    
    const load = async () => {
      setLoading(true);
      await loadMessages(conversation._id);
      markAsRead(conversation._id);
      setLoading(false);
    };
    load();

    return () => {
      closeConversation();
    };
  }, [conversation._id]);

  // Handle typing indicator
  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);

      // Set typing to true
      if (text.length > 0) {
        setTyping(true);

        // Clear previous timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Set typing to false after 2 seconds of no typing
        typingTimeoutRef.current = setTimeout(() => {
          setTyping(false);
        }, 2000);
      } else {
        setTyping(false);
      }
    },
    [setTyping]
  );

  // Guard against double-send (double-tap or duplicate events)
  const sendingRef = useRef(false);

  // Send message
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    if (sendingRef.current) return;

    sendingRef.current = true;
    sendMessage(text);
    setInputText('');
    setTyping(false);

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Allow next send after a short delay to avoid duplicate socket emits
    setTimeout(() => {
      sendingRef.current = false;
    }, 500);
  }, [inputText, sendMessage, setTyping]);

  // Load more messages
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || messages.length === 0) return;

    const firstMessage = messages[0];
    setLoadingMore(true);
    await loadMessages(conversation._id, firstMessage.createdAt);
    setLoadingMore(false);
  }, [loadingMore, messages, loadMessages, conversation._id]);

  // Video call
  const handleVideoCall = useCallback(() => {
    if (isSeller) return; // Sellers can't initiate calls
    if (!isAgoraConfigured) {
      Alert.alert('Not Available', 'Video calling is not configured on this server.');
      return;
    }

    const shopName = conversation.shopName ?? 'Shop';

    // Step 1: Confirm user wants to call
    Alert.alert(
      'Are you sure you want to call?',
      '',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          style: 'default',
          onPress: () => {
            // Step 2: Privacy notice before starting the call
            Alert.alert(
              'Before you call',
              'Your camera will be off and your phone number will not be shared. You may switch the camera on if you want to.',
              [
                { text: 'Back', style: 'cancel' },
                {
                  text: 'Proceed',
                  style: 'default',
                  onPress: () => {
                    requestCall(conversation.shopId, shopName, 'video');
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [isSeller, isAgoraConfigured, requestCall, conversation]);

  // Render message
  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isOwn = item.senderId === user?._id;
      const previousMessage = index > 0 ? messages[index - 1] : undefined;
      const showDate = shouldShowDateHeader(item, previousMessage);

      return <MessageBubble message={item} isOwn={isOwn} showDate={showDate} />;
    },
    [user?._id, messages]
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={onBack} />

        <View style={styles.headerInfo}>
          {conversation.shopImage ? (
            <Image source={{ uri: conversation.shopImage }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
              <Ionicons
                name={isSeller ? 'person' : 'storefront'}
                size={18}
                color={colors.mutedForeground}
              />
            </View>
          )}
          <View>
            <Text style={styles.headerName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.headerStatus}>
              {isConnected ? (isOtherTyping ? 'typing...' : 'Online') : 'Offline'}
            </Text>
          </View>
        </View>

        {!isSeller && isAgoraConfigured && (
          <Pressable onPress={handleVideoCall} hitSlop={8} style={styles.callButton}>
            <Ionicons name="videocam" size={24} color={colors.primary} />
          </Pressable>
        )}
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onRefresh={handleLoadMore}
          refreshing={loadingMore}
          ListFooterComponent={isOtherTyping ? <TypingIndicator /> : null}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor={colors.mutedForeground}
          value={inputText}
          onChangeText={handleTextChange}
          multiline
          maxLength={1000}
        />
        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim()}
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
        >
          <Ionicons
            name="send"
            size={20}
            color={inputText.trim() ? colors.card : colors.mutedForeground}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted,
    marginRight: spacing.sm,
  },
  headerAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  headerStatus: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  callButton: {
    padding: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: spacing.md,
    flexGrow: 1,
  },
  dateHeader: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.mutedForeground,
    marginVertical: spacing.md,
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  messageBubbleContainerOwn: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.muted,
    borderBottomLeftRadius: 4,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  messageText: {
    fontSize: 15,
    color: colors.foreground,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: colors.card,
  },
  messageTime: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  systemMessageContainer: {
    alignItems: 'center',
  },
  systemMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    gap: 4,
  },
  systemMessageText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  typingContainer: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  typingBubble: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 4,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.mutedForeground,
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.foreground,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.muted,
  },
});
