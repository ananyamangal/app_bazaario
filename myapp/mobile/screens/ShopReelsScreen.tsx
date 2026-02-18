import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { useChat, type Conversation } from '../context/ChatContext';
import { apiGet, apiGetAuth, apiPost, apiPostAuth } from '../api/client';
import { useAuth } from '../context/AuthContext';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ShopReel = {
  id: string;
  shopId: string;
  shopName: string;
  shopDescription: string;
  shopImage: string;
  videoUrl: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  promotionBadge?: string | null;
  marketId?: string | null;
  marketName?: string | null;
};

type MarketOption = { _id: string; name: string };

type Comment = {
  id: string;
  userName: string;
  userImage?: string;
  text: string;
  timestamp: string;
};

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 60; // Approximate tab bar height
const VIDEO_HEIGHT = SCREEN_HEIGHT;

// Sample shop reels data (in production, fetch from API)
const SAMPLE_REELS: ShopReel[] = [
  {
    id: '1',
    shopId: 'shop1',
    shopName: 'Fashion Hub',
    shopDescription: 'Latest trends in ethnic wear & designer sarees ✨',
    shopImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=100',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    likes: 1234,
    comments: 89,
    isLiked: false,
  },
  {
    id: '2',
    shopId: 'shop2',
    shopName: 'Jewel Palace',
    shopDescription: 'Handcrafted gold & diamond jewelry 💎',
    shopImage: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=100',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    likes: 2567,
    comments: 156,
    isLiked: true,
  },
  {
    id: '3',
    shopId: 'shop3',
    shopName: 'Spice Garden',
    shopDescription: 'Authentic spices & dry fruits from Kashmir 🌿',
    shopImage: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=100',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    likes: 892,
    comments: 45,
    isLiked: false,
  },
  {
    id: '4',
    shopId: 'shop4',
    shopName: 'Tech Zone',
    shopDescription: 'Gadgets, accessories & mobile repairs 📱',
    shopImage: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=100',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    likes: 3421,
    comments: 234,
    isLiked: false,
  },
  {
    id: '5',
    shopId: 'shop5',
    shopName: 'Artisan Crafts',
    shopDescription: 'Handmade pottery & home decor items 🏺',
    shopImage: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=100',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    likes: 1876,
    comments: 98,
    isLiked: true,
  },
];

// Sample comments
const SAMPLE_COMMENTS: Comment[] = [
  { id: '1', userName: 'Priya S.', text: 'Love this collection! 😍', timestamp: '2h ago' },
  { id: '2', userName: 'Rahul K.', text: 'Great quality products!', timestamp: '3h ago' },
  { id: '3', userName: 'Anita M.', text: 'Where is this shop located?', timestamp: '5h ago' },
  { id: '4', userName: 'Vikram P.', text: 'Just ordered, excited! 🎉', timestamp: '1d ago' },
];

// -----------------------------------------------------------------------------
// Video Item Component
// -----------------------------------------------------------------------------

type VideoItemProps = {
  item: ShopReel;
  isActive: boolean;
  onLike: (id: string) => void;
  onShopPress: (shopId: string) => void;
  onChat: (shopId: string) => void;
  onComment: (id: string) => void;
  onShare: (reel: ShopReel) => void;
};

function VideoItem({
  item,
  isActive,
  onLike,
  onShopPress,
  onChat,
  onComment,
  onShare,
}: VideoItemProps) {
  const videoRef = useRef<Video>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasTrackedView = useRef(false);
  const insets = useSafeAreaInsets();
  const visitShopScale = useRef(new Animated.Value(1)).current;
  const hasPoppedVisit = useRef(false);

  // Pop-out "Visit shop!" animation when reel becomes active
  useEffect(() => {
    if (!isActive) {
      hasPoppedVisit.current = false;
      return;
    }
    if (hasPoppedVisit.current) return;
    hasPoppedVisit.current = true;
    Animated.sequence([
      Animated.timing(visitShopScale, {
        toValue: 1.2,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(visitShopScale, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isActive, visitShopScale]);

  useEffect(() => {
    if (isActive && !isPaused) {
      // Small delay so the active item is mounted before we play (avoids static first frame)
      const t = setTimeout(() => {
        videoRef.current?.playAsync().catch(() => {});
      }, 100);
      // Track view once when video becomes active
      if (item.reelId && !hasTrackedView.current) {
        hasTrackedView.current = true;
        apiPost(`/reels/${item.reelId}/view`, {}).catch(() => {});
      }
      return () => clearTimeout(t);
    } else {
      videoRef.current?.pauseAsync().catch(() => {});
    }
  }, [isActive, isPaused, item.reelId]);

  // Reset view tracking when item changes
  useEffect(() => {
    hasTrackedView.current = false;
  }, [item.id]);

  const handleTap = () => {
    setIsPaused((p) => !p);
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoading(false);
      if (status.didJustFinish) {
        videoRef.current?.replayAsync();
      }
    }
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <Pressable onPress={handleTap} style={styles.videoContainer}>
      <Video
        key={item.id}
        ref={videoRef}
        source={{ uri: item.videoUrl }}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay={isActive && !isPaused}
        isMuted={false}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      />

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.card} />
        </View>
      )}

      {/* Pause indicator */}
      {isPaused && !isLoading && (
        <View style={styles.pauseOverlay}>
          <Ionicons name="play" size={80} color="rgba(255,255,255,0.8)" />
        </View>
      )}

      {/* Bottom overlay - Shop info */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 80 }]}
      >
        <Pressable style={styles.shopInfo} onPress={() => onShopPress(item.shopId)}>
          <Image source={{ uri: item.shopImage }} style={styles.shopAvatar} />
          <View style={styles.shopTextContainer}>
            {item.promotionBadge ? (
              <View style={styles.promotionBadge}>
                <Text style={styles.promotionBadgeText}>{item.promotionBadge}</Text>
              </View>
            ) : null}
            <View style={styles.shopNameRow}>
              <Text style={styles.shopName}>{item.shopName}</Text>
              {item.marketName ? (
                <View style={styles.marketBadge}>
                  <Text style={styles.marketBadgeText}>{item.marketName}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.shopDescription} numberOfLines={2}>
              {item.shopDescription}
            </Text>
          </View>
        </Pressable>
      </LinearGradient>

      {/* Right side action bar */}
      <View style={[styles.actionBar, { bottom: insets.bottom + 100 }]}>
        {/* Like button */}
        <Pressable style={styles.actionButton} onPress={() => onLike(item.id)}>
          <View style={[styles.actionButtonBg, item.isLiked && styles.actionButtonActive]}>
            <Ionicons
              name={item.isLiked ? 'heart' : 'heart-outline'}
              size={28}
              color={item.isLiked ? '#FF4757' : colors.card}
            />
          </View>
          <Text style={styles.actionCount}>{formatCount(item.likes)}</Text>
        </Pressable>

        {/* Shop Profile button - pops out at start with "Visit shop!" */}
        <Animated.View style={[styles.actionButton, { transform: [{ scale: visitShopScale }] }]}>
          <Pressable style={styles.actionButtonInner} onPress={() => onShopPress(item.shopId)}>
            <View style={styles.actionButtonBg}>
              <Ionicons name="storefront" size={24} color={colors.card} />
            </View>
            <Text style={styles.actionLabel}>Visit shop!</Text>
          </Pressable>
        </Animated.View>

        {/* Chat button */}
        <Pressable style={styles.actionButton} onPress={() => onChat(item.shopId)}>
          <View style={styles.actionButtonBg}>
            <Ionicons name="chatbubble-ellipses" size={24} color={colors.card} />
          </View>
          <Text style={styles.actionLabel}>Chat</Text>
        </Pressable>

        {/* Comments button */}
        <Pressable style={styles.actionButton} onPress={() => onComment(item.id)}>
          <View style={styles.actionButtonBg}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.card} />
          </View>
          <Text style={styles.actionCount}>{formatCount(item.comments)}</Text>
        </Pressable>

        {/* Share button */}
        <Pressable style={styles.actionButton} onPress={() => onShare(item)}>
          <View style={styles.actionButtonBg}>
            <Ionicons name="share-social" size={24} color={colors.card} />
          </View>
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

type Props = {
  onShopPress?: (shopId: string) => void;
  onOpenChat?: (conversation: Conversation) => void;
};

export default function ShopReelsScreen({ onShopPress, onOpenChat }: Props) {
  const [reels, setReels] = useState<ShopReel[]>([]);
  const [markets, setMarkets] = useState<MarketOption[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [filterDropdownVisible, setFilterDropdownVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [reelComments, setReelComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const { startConversation } = useChat();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const filteredReels = selectedMarketId
    ? reels.filter((r) => r.marketId === selectedMarketId)
    : reels;

  // Fetch reels and markets from API (use auth when logged in so isLiked is correct and persists)
  useEffect(() => {
    async function loadReels() {
      try {
        setLoading(true);
        const fetchReels = user
          ? apiGetAuth<{ reels: ShopReel[]; markets: MarketOption[] }>('/reels')
          : apiGet<{ reels: ShopReel[]; markets: MarketOption[] }>('/reels');
        const response = await fetchReels;
        if (response.reels && response.reels.length > 0) {
          setReels(response.reels);
          setMarkets(response.markets || []);
        } else {
          setReels(SAMPLE_REELS);
          setMarkets([]);
        }
      } catch (error) {
        console.warn('[ShopReelsScreen] Failed to load reels', error);
        setReels(SAMPLE_REELS);
        setMarkets([]);
      } finally {
        setLoading(false);
      }
    }
    loadReels();
  }, [user]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    []
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [selectedMarketId]);

  const handleLike = useCallback(async (id: string) => {
    const reel = reels.find((r) => r.id === id);
    if (!reel || !reel.reelId || !user) return;

    try {
      const response = await apiPostAuth<{ likes: number; isLiked: boolean }>(`/reels/${reel.reelId}/like`, {});
      setReels((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                isLiked: response.isLiked,
                likes: response.likes,
              }
            : r
        )
      );
    } catch (error) {
      console.error('[ShopReels] Failed to like reel', error);
    }
  }, [reels, user]);

  const handleShare = useCallback(async (reel: ShopReel) => {
    try {
      // Generate shareable link for the reel
      const reelUrl = `https://bazaario.app/reel/${reel.reelId || reel.id}`;
      const shareMessage = `Check out this reel from ${reel.shopName} on Bazaario! ${reelUrl}`;
      
      await Share.share({
        message: shareMessage,
        title: `Reel from ${reel.shopName}`,
        url: reelUrl, // iOS will use this
      });
    } catch (error) {
      console.warn('[ShopReels] Share failed', error);
    }
  }, []);

  const handleChat = useCallback(async (shopId: string) => {
    try {
      const conversation = await startConversation(shopId);
      if (conversation && onOpenChat) {
        onOpenChat(conversation);
      }
    } catch (error) {
      console.error('Failed to start chat:', error);
    }
  }, [startConversation, onOpenChat]);

  const handleComment = useCallback(async (id: string) => {
    setSelectedReelId(id);
    setCommentModalVisible(true);
    setLoadingComments(true);
    
    const reel = reels.find(r => r.id === id);
    if (reel && reel.reelId) {
      try {
        const response = await apiGet<{ comments: Comment[] }>(`/reels/${reel.reelId}/comments`);
        setReelComments(response.comments || []);
      } catch (error) {
        console.error('[ShopReels] Failed to load comments', error);
        setReelComments([]);
      } finally {
        setLoadingComments(false);
      }
    } else {
      setReelComments([]);
      setLoadingComments(false);
    }
  }, [reels]);

  const handleShopPress = useCallback(
    (shopId: string) => {
      if (onShopPress) {
        onShopPress(shopId);
      }
    },
    [onShopPress]
  );

  const handleSendComment = async () => {
    if (!newComment.trim() || !selectedReelId) return;
    
    const reel = reels.find(r => r.id === selectedReelId);
    if (!reel || !reel.reelId || !user) return;

    try {
      const response = await apiPostAuth<{ comments: number; comment: any }>(`/reels/${reel.reelId}/comments`, {
        text: newComment.trim(),
      });
      
      // Update comments count
      setReels((prev) =>
        prev.map((r) =>
          r.id === selectedReelId
            ? { ...r, comments: response.comments }
            : r
        )
      );
      
      // Refresh comments list
      const commentsResponse = await apiGet<{ comments: Comment[] }>(`/reels/${reel.reelId}/comments`);
      setReelComments(commentsResponse.comments || []);
      
      setNewComment('');
    } catch (error) {
      console.error('[ShopReels] Failed to add comment', error);
    }
  };

  const renderItem = useCallback(
    ({ item, index }: { item: ShopReel; index: number }) => (
      <VideoItem
        item={item}
        isActive={index === activeIndex}
        onLike={handleLike}
        onShopPress={handleShopPress}
        onChat={handleChat}
        onComment={handleComment}
        onShare={handleShare}
      />
    ),
    [activeIndex, handleLike, handleShopPress, handleChat, handleComment, handleShare]
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.card} />
        <Text style={styles.loadingText}>Loading reels...</Text>
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Ionicons name="videocam-outline" size={64} color={colors.mutedForeground} />
        <Text style={styles.emptyText}>No reels available yet</Text>
        <Text style={styles.emptySubtext}>Sellers will upload reels soon!</Text>
      </View>
    );
  }

  if (filteredReels.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.headerTitle}>Shop</Text>
          <Pressable style={styles.filterButton} onPress={() => setFilterDropdownVisible((v) => !v)}>
            <Ionicons name="filter" size={22} color={colors.card} />
          </Pressable>
        </View>
        <Ionicons name="business-outline" size={64} color={colors.mutedForeground} />
        <Text style={styles.emptyText}>No reels in this market</Text>
        <Text style={styles.emptySubtext}>Try another market or show all</Text>
        <Pressable
          style={styles.showAllButton}
          onPress={() => setSelectedMarketId(null)}
        >
          <Text style={styles.showAllButtonText}>Show all reels</Text>
        </Pressable>
        {filterDropdownVisible && (
          <Pressable style={styles.filterDropdownBackdrop} onPress={() => setFilterDropdownVisible(false)}>
            <View style={[styles.filterDropdown, { top: insets.top + 48 }]}>
              <Text style={styles.filterDropdownTitle}>Filter by market</Text>
              <Pressable
                style={[styles.filterOption, selectedMarketId === null && styles.filterOptionActive]}
                onPress={() => { setSelectedMarketId(null); setFilterDropdownVisible(false); }}
              >
                <Text style={[styles.filterOptionText, selectedMarketId === null && styles.filterOptionTextActive]}>All</Text>
                {selectedMarketId === null && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
              {markets.map((m) => (
                <Pressable
                  key={m._id}
                  style={[styles.filterOption, selectedMarketId === m._id && styles.filterOptionActive]}
                  onPress={() => { setSelectedMarketId(m._id); setFilterDropdownVisible(false); }}
                >
                  <Text style={[styles.filterOptionText, selectedMarketId === m._id && styles.filterOptionTextActive]}>{m.name}</Text>
                  {selectedMarketId === m._id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </Pressable>
              ))}
            </View>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredReels}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={VIDEO_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: VIDEO_HEIGHT,
          offset: VIDEO_HEIGHT * index,
          index,
        })}
      />

      {/* Header overlay with filter */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Shop</Text>
        <Pressable
          style={styles.filterButton}
          onPress={() => setFilterDropdownVisible((v) => !v)}
        >
          <Ionicons name="filter" size={22} color={colors.card} />
        </Pressable>
      </View>

      {/* Filter by market dropdown */}
      {filterDropdownVisible && (
        <Pressable
          style={styles.filterDropdownBackdrop}
          onPress={() => setFilterDropdownVisible(false)}
        >
          <View style={[styles.filterDropdown, { top: insets.top + 48 }]}>
            <Text style={styles.filterDropdownTitle}>Filter by market</Text>
            <Pressable
              style={[styles.filterOption, selectedMarketId === null && styles.filterOptionActive]}
              onPress={() => {
                setSelectedMarketId(null);
                setFilterDropdownVisible(false);
              }}
            >
              <Text style={[styles.filterOptionText, selectedMarketId === null && styles.filterOptionTextActive]}>
                All
              </Text>
              {selectedMarketId === null && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </Pressable>
            {markets.map((m) => (
              <Pressable
                key={m._id}
                style={[styles.filterOption, selectedMarketId === m._id && styles.filterOptionActive]}
                onPress={() => {
                  setSelectedMarketId(m._id);
                  setFilterDropdownVisible(false);
                }}
              >
                <Text style={[styles.filterOptionText, selectedMarketId === m._id && styles.filterOptionTextActive]}>
                  {m.name}
                </Text>
                {selectedMarketId === m._id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            ))}
            {markets.length === 0 && (
              <Text style={styles.filterDropdownEmpty}>No markets with reels yet</Text>
            )}
          </View>
        </Pressable>
      )}

      {/* Comments Modal */}
      <Modal
        visible={commentModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCommentModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.commentsContainer}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.commentsHeader}>
                <View style={styles.modalHandle} />
                <Text style={styles.commentsTitle}>Comments</Text>
                <Pressable
                  onPress={() => setCommentModalVisible(false)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={24} color={colors.foreground} />
                </Pressable>
              </View>

              {loadingComments ? (
                <View style={styles.commentsLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.commentsLoadingText}>Loading comments...</Text>
                </View>
              ) : reelComments.length === 0 ? (
                <View style={styles.commentsEmpty}>
                  <Ionicons name="chatbubble-outline" size={32} color={colors.mutedForeground} />
                  <Text style={styles.commentsEmptyText}>No comments yet</Text>
                  <Text style={styles.commentsEmptySubtext}>Be the first to comment!</Text>
                </View>
              ) : (
                <FlatList
                  data={reelComments}
                  keyExtractor={(item) => item.id}
                  style={styles.commentsList}
                  renderItem={({ item }) => (
                    <View style={styles.commentItem}>
                      <View style={styles.commentAvatar}>
                        {item.userImage ? (
                          <Image source={{ uri: item.userImage }} style={styles.commentAvatarImage} />
                        ) : (
                          <Ionicons name="person" size={16} color={colors.mutedForeground} />
                        )}
                      </View>
                      <View style={styles.commentContent}>
                        <View style={styles.commentHeader}>
                          <Text style={styles.commentUser}>{item.userName}</Text>
                          <Text style={styles.commentTime}>
                            {new Date(item.timestamp).toLocaleDateString()}
                          </Text>
                        </View>
                        <Text style={styles.commentText}>{item.text}</Text>
                      </View>
                    </View>
                  )}
                />
              )}

              <View style={[styles.commentInputContainer, { paddingBottom: insets.bottom + 8 }]}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor={colors.mutedForeground}
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                />
                <Pressable
                  style={[
                    styles.sendButton,
                    !newComment.trim() && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSendComment}
                  disabled={!newComment.trim()}
                >
                  <Ionicons
                    name="send"
                    size={20}
                    color={newComment.trim() ? colors.card : colors.mutedForeground}
                  />
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: VIDEO_HEIGHT,
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.card,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingTop: 0,
  },
  filterDropdown: {
    position: 'absolute',
    right: 16,
    minWidth: 200,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  filterDropdownTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  filterOptionActive: {
    backgroundColor: colors.secondary,
  },
  filterOptionText: {
    fontSize: 15,
    color: colors.foreground,
  },
  filterOptionTextActive: {
    fontWeight: '600',
    color: colors.primary,
  },
  filterDropdownEmpty: {
    fontSize: 13,
    color: colors.mutedForeground,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  // Bottom overlay
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 80, // Leave space for action bar
    paddingHorizontal: 16,
    paddingTop: 60,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.card,
  },
  shopTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  promotionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginBottom: 6,
  },
  promotionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.card,
  },
  shopNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  shopName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.card,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  marketBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  marketBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.card,
  },
  shopDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Action bar
  actionBar: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 18,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionButtonInner: {
    alignItems: 'center',
  },
  actionButtonBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonActive: {
    backgroundColor: 'rgba(255,71,87,0.2)',
  },
  actionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.card,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.card,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Comments modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  commentsContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '70%',
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalHandle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  commentsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.foreground,
    flex: 1,
    textAlign: 'center',
  },
  commentsList: {
    maxHeight: 300,
  },
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  commentAvatarImage: {
    width: 36,
    height: 36,
  },
  commentsLoading: {
    padding: 40,
    alignItems: 'center',
  },
  commentsLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  commentsEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  commentsEmptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  commentsEmptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  commentContent: {
    marginLeft: 12,
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  commentTime: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  commentText: {
    fontSize: 14,
    color: colors.foreground,
    marginTop: 4,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.card,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: colors.card,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  showAllButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
  },
  showAllButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.card,
  },
});
