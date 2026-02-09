import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '../../components/BackButton';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { useAvailability, AvailabilityRequest } from '../../context/AvailabilityContext';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
const PAD = 16;

type Props = {
  onBack?: () => void;
};

export default function SellerAvailabilityRequestsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { getSellerRequests, respondToRequest, pendingCount } = useAvailability();
  
  const [requests, setRequests] = useState<AvailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const loadRequests = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const result = await getSellerRequests(filter);
      setRequests(result.requests);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getSellerRequests, filter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRequests(false);
  };

  async function handleRespond(requestId: string, approved: boolean) {
    const action = approved ? 'approve' : 'decline';
    
    Alert.alert(
      approved ? 'Approve Request' : 'Decline Request',
      `Are you sure you want to ${action} this availability request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approved ? 'Approve' : 'Decline',
          style: approved ? 'default' : 'destructive',
          onPress: async () => {
            setRespondingTo(requestId);
            try {
              const success = await respondToRequest(requestId, approved);
              if (success) {
                // Remove from list or update status
                setRequests(prev => 
                  prev.map(r => 
                    r._id === requestId 
                      ? { ...r, status: approved ? 'approved' : 'declined' } 
                      : r
                  )
                );
                Alert.alert(
                  'Success',
                  approved 
                    ? 'Request approved! The customer has been notified.' 
                    : 'Request declined. The customer has been notified.'
                );
              } else {
                Alert.alert('Error', 'Failed to respond. Please try again.');
              }
            } catch (error) {
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setRespondingTo(null);
            }
          },
        },
      ]
    );
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  }

  function getTimeRemaining(expiresAt: string) {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m left`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h left`;
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'approved': return '#10B981';
      case 'declined': return colors.destructive;
      case 'expired': return colors.mutedForeground;
      default: return colors.mutedForeground;
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
<View style={[styles.header, { paddingTop: spacing.md, paddingBottom: spacing.sm }]}>
        {onBack && <BackButton onPress={onBack} />}
        <Text style={styles.headerTitle}>Availability Requests</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, paddingBottom: spacing.sm }]}>
        {onBack && (
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </Pressable>
        )}
        <Text style={styles.headerTitle}>Availability Requests</Text>
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterTabText, filter === 'pending' && styles.filterTabTextActive]}>
            Pending
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
            All
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {requests.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No requests</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'pending' 
                ? 'You have no pending availability requests' 
                : 'No availability requests yet'}
            </Text>
          </View>
        )}

        {requests.map((request) => {
          const isPending = request.status === 'pending';
          const isResponding = respondingTo === request._id;
          
          return (
            <View key={request._id} style={[styles.requestCard, SHADOW]}>
              {/* Product Info */}
              <View style={styles.productRow}>
                {request.productImage ? (
                  <Image source={{ uri: request.productImage }} style={styles.productImage} />
                ) : (
                  <View style={[styles.productImage, styles.productImagePlaceholder]}>
                    <Ionicons name="cube-outline" size={24} color={colors.mutedForeground} />
                  </View>
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{request.productName}</Text>
                  <Text style={styles.quantityText}>Qty: {request.quantity}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </Text>
                </View>
              </View>

              {/* Customer Info */}
              <View style={styles.customerRow}>
                <Ionicons name="person-outline" size={16} color={colors.mutedForeground} />
                <Text style={styles.customerName}>
                  {(request.customerId as any)?.name || 'Customer'}
                </Text>
                <Text style={styles.customerPhone}>
                  {(request.customerId as any)?.phone || ''}
                </Text>
              </View>

              {/* Time Info */}
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTimeAgo(request.createdAt)}</Text>
                {isPending && (
                  <View style={styles.expiryBadge}>
                    <Ionicons name="time-outline" size={14} color="#92400E" />
                    <Text style={styles.expiryText}>{getTimeRemaining(request.expiresAt)}</Text>
                  </View>
                )}
              </View>

              {/* Message if any */}
              {request.customerMessage && (
                <View style={styles.messageBox}>
                  <Text style={styles.messageLabel}>Customer's note:</Text>
                  <Text style={styles.messageText}>{request.customerMessage}</Text>
                </View>
              )}

              {/* Action Buttons - Only for pending */}
              {isPending && (
                <View style={styles.actionRow}>
                  <Pressable
                    style={({ pressed }) => [styles.declineBtn, pressed && styles.btnPressed]}
                    onPress={() => handleRespond(request._id, false)}
                    disabled={isResponding}
                  >
                    {isResponding ? (
                      <ActivityIndicator size="small" color={colors.destructive} />
                    ) : (
                      <>
                        <Ionicons name="close-circle-outline" size={18} color={colors.destructive} />
                        <Text style={styles.declineBtnText}>Not Available</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.approveBtn, pressed && styles.btnPressed]}
                    onPress={() => handleRespond(request._id, true)}
                    disabled={isResponding}
                  >
                    {isResponding ? (
                      <ActivityIndicator size="small" color={colors.card} />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color={colors.card} />
                        <Text style={styles.approveBtnText}>Available</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}

              {/* Response if already responded */}
              {request.sellerResponse && (
                <View style={styles.responseBox}>
                  <Text style={styles.responseLabel}>Your response:</Text>
                  <Text style={styles.responseText}>{request.sellerResponse}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAD,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.foreground, flex: 1 },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: { color: colors.card, fontSize: 13, fontWeight: '700' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: PAD,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.xxl,
    backgroundColor: colors.muted,
  },
  filterTabActive: { backgroundColor: colors.primary },
  filterTabText: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
  filterTabTextActive: { color: colors.card },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: PAD, paddingTop: 8 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.foreground, marginTop: 16 },
  emptySubtext: { fontSize: 15, color: colors.mutedForeground, marginTop: 8, textAlign: 'center' },

  requestCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: PAD,
    marginBottom: 12,
  },
  productRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  productImage: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.muted },
  productImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 15, fontWeight: '600', color: colors.foreground, marginBottom: 4 },
  quantityText: { fontSize: 13, color: colors.mutedForeground },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.xxl,
  },
  statusText: { fontSize: 12, fontWeight: '600' },

  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  customerName: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  customerPhone: { fontSize: 13, color: colors.mutedForeground },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeText: { fontSize: 13, color: colors.mutedForeground },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xxl,
  },
  expiryText: { fontSize: 12, fontWeight: '600', color: '#92400E' },

  messageBox: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 12,
  },
  messageLabel: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground, marginBottom: 4 },
  messageText: { fontSize: 14, color: colors.foreground },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: '#FEE2E2',
  },
  declineBtnText: { fontSize: 14, fontWeight: '600', color: colors.destructive },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: '#10B981',
  },
  approveBtnText: { fontSize: 14, fontWeight: '600', color: colors.card },
  btnPressed: { opacity: 0.9 },

  responseBox: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    padding: 10,
    marginTop: 12,
  },
  responseLabel: { fontSize: 12, fontWeight: '600', color: colors.primary, marginBottom: 4 },
  responseText: { fontSize: 14, color: colors.foreground },
});
