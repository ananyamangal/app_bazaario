import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';

import BackButton from '../../components/BackButton';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { apiGet, apiGetAuth } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Reel = {
  _id?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  createdAt: string;
  likes?: number;
  comments?: number;
  views?: number;
  commentsList?: Comment[];
};

type Comment = {
  id: string;
  userName: string;
  userImage?: string;
  text: string;
  timestamp: string;
};

type Props = {
  onBack: () => void;
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ReelInsightsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { shop } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [reelComments, setReelComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    async function loadReels() {
      if (!shop?._id) return;
      try {
        setLoading(true);
        const response = await apiGet<{ reels: Reel[] }>(`/shops/${shop._id}/reels`);
        setReels(response.reels || []);
      } catch (error) {
        console.error('[ReelInsights] Failed to load reels', error);
      } finally {
        setLoading(false);
      }
    }
    loadReels();
  }, [shop?._id]);

  const openComments = async (reel: Reel) => {
    setSelectedReel(reel);
    setCommentsModalVisible(true);
    setLoadingComments(true);
    
    try {
      // Get reel ID - use _id if available, otherwise try to find it from shop
      let reelId = reel._id;
      if (!reelId && shop?._id) {
        // Try to get the actual reel ID from the shop
        const shopResponse = await apiGet<{ reels: Reel[] }>(`/shops/${shop._id}/reels`);
        const matchingReel = shopResponse.reels.find((r, idx) => 
          r.videoUrl === reel.videoUrl && r.createdAt === reel.createdAt
        );
        reelId = matchingReel?._id;
      }
      
      if (!reelId) {
        console.warn('[ReelInsights] Could not find reel ID');
        setReelComments([]);
        return;
      }
      
      const response = await apiGet<{ comments: Comment[] }>(`/reels/${reelId}/comments`);
      setReelComments(response.comments || []);
    } catch (error) {
      console.error('[ReelInsights] Failed to load comments', error);
      setReelComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, paddingBottom: spacing.sm }]}>
        <BackButton onPress={onBack} />
        <Text style={styles.headerTitle}>Reel Insights</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading insights...</Text>
        </View>
      ) : reels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-outline" size={64} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No reels uploaded yet</Text>
          <Text style={styles.emptySubtext}>Upload your first reel to see insights</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {reels.map((reel, index) => (
            <View key={index} style={styles.reelCard}>
              {/* Video Preview */}
              <View style={styles.videoContainer}>
                <Video
                  source={{ uri: reel.videoUrl }}
                  style={styles.video}
                  resizeMode={ResizeMode.COVER}
                  isLooping
                  shouldPlay={false}
                  isMuted
                  useNativeControls
                  posterSource={reel.thumbnailUrl ? { uri: reel.thumbnailUrl } : undefined}
                />
              </View>

              {/* Analytics */}
              <View style={styles.analyticsContainer}>
                <View style={styles.analyticsHeader}>
                  <Text style={styles.reelDate}>Uploaded {formatDate(reel.createdAt)}</Text>
                </View>
                
                <View style={styles.analyticsGrid}>
                  <View style={styles.analyticsItem}>
                    <View style={styles.analyticsIconContainer}>
                      <Ionicons name="heart" size={20} color="#FF4757" />
                    </View>
                    <Text style={styles.analyticsValue}>{reel.likes || 0}</Text>
                    <Text style={styles.analyticsLabel}>Likes</Text>
                  </View>

                  <Pressable 
                    style={styles.analyticsItem}
                    onPress={() => openComments(reel)}
                  >
                    <View style={styles.analyticsIconContainer}>
                      <Ionicons name="chatbubble" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.analyticsValue}>{reel.comments || 0}</Text>
                    <Text style={styles.analyticsLabel}>Comments</Text>
                  </Pressable>

                  <View style={styles.analyticsItem}>
                    <View style={styles.analyticsIconContainer}>
                      <Ionicons name="eye" size={20} color={colors.mutedForeground} />
                    </View>
                    <Text style={styles.analyticsValue}>{reel.views || 0}</Text>
                    <Text style={styles.analyticsLabel}>Views</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Comments Modal */}
      <Modal
        visible={commentsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.commentsModal}>
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>Comments</Text>
              <Pressable onPress={() => setCommentsModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            {loadingComments ? (
              <View style={styles.commentsLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : reelComments.length === 0 ? (
              <View style={styles.commentsEmpty}>
                <Ionicons name="chatbubble-outline" size={48} color={colors.mutedForeground} />
                <Text style={styles.commentsEmptyText}>No comments yet</Text>
              </View>
            ) : (
              <FlatList
                data={reelComments}
                keyExtractor={(item) => item.id}
                style={styles.commentsList}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <View style={styles.commentAvatar}>
                      {item.userImage ? (
                        <Image source={{ uri: item.userImage }} style={styles.commentAvatarImage} />
                      ) : (
                        <Ionicons name="person" size={20} color={colors.mutedForeground} />
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
          </View>
        </KeyboardAvoidingView>
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
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  reelCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  videoContainer: {
    width: '100%',
    height: 300,
    backgroundColor: colors.muted,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  analyticsContainer: {
    padding: 16,
  },
  analyticsHeader: {
    marginBottom: 16,
  },
  reelDate: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  analyticsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  analyticsItem: {
    alignItems: 'center',
    gap: 8,
  },
  analyticsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyticsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
  analyticsLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  commentsModal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '80%',
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  commentsLoading: {
    padding: 40,
    alignItems: 'center',
  },
  commentsEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  commentsEmptyText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.mutedForeground,
  },
  commentsList: {
    maxHeight: 400,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  commentAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
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
    lineHeight: 20,
  },
});
