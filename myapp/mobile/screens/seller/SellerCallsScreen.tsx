import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { apiGetAuth } from '../../api/client';

const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 2,
};
const PAD = 16;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type CallRecord = {
  _id: string;
  customerId: { _id: string; name?: string; phone?: string };
  shopId: { _id: string; name?: string };
  status: 'requested' | 'accepted' | 'completed' | 'cancelled';
  callType: 'instant' | 'scheduled';
  duration?: number;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
};

type ScheduledCallbackRecord = {
  _id: string;
  shopId: { _id: string; name?: string };
  customerId: { _id: string; name?: string; phone?: string };
  customerName?: string;
  scheduledAt: string;
  status: 'pending' | 'completed' | 'cancelled';
};

type Props = {
  onOpenConversations?: () => void;
};

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function formatScheduledAt(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return colors.success;
    case 'cancelled':
      return colors.destructive;
    case 'accepted':
      return colors.primary;
    default:
      return colors.mutedForeground;
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed':
      return 'checkmark-circle';
    case 'cancelled':
      return 'close-circle';
    case 'accepted':
      return 'call';
    default:
      return 'call-outline';
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SellerCallsScreen({ onOpenConversations }: Props) {
  const insets = useSafeAreaInsets();
  const { shop } = useAuth();
  const { totalUnread } = useChat();

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [scheduledCallbacks, setScheduledCallbacks] = useState<ScheduledCallbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const videoEnabled = (shop as any)?.videoEnabled ?? true;

  const loadCalls = useCallback(async () => {
    try {
      const [callsRes, scheduledRes] = await Promise.all([
        apiGetAuth<{ calls: CallRecord[] }>('/calls/seller'),
        apiGetAuth<{ callbacks: ScheduledCallbackRecord[] }>('/calls/scheduled').catch((err) => {
          console.error('[SellerCalls] Failed to load scheduled callbacks:', err);
          return { callbacks: [] };
        }),
      ]);
      setCalls(callsRes.calls || []);
      console.log('[SellerCalls] Scheduled callbacks received:', scheduledRes.callbacks?.length || 0);
      setScheduledCallbacks(scheduledRes.callbacks || []);
    } catch (error) {
      console.error('Failed to load calls:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCalls();
    setRefreshing(false);
  }, [loadCalls]);

  const renderCallItem = ({ item }: { item: CallRecord }) => (
    <View style={[styles.callItem, SHADOW]}>
      <View style={[styles.callIcon, { backgroundColor: getStatusColor(item.status) + '20' }]}>
        <Ionicons
          name={getStatusIcon(item.status) as any}
          size={24}
          color={getStatusColor(item.status)}
        />
      </View>
      <View style={styles.callInfo}>
        <Text style={styles.callerName}>
          {item.customerId?.name || item.customerId?.phone || 'Customer'}
        </Text>
        <View style={styles.callMeta}>
          <Text style={styles.callStatus}>{item.status}</Text>
          {item.duration && (
            <Text style={styles.callDuration}> • {formatDuration(item.duration)}</Text>
          )}
        </View>
      </View>
      <Text style={styles.callTime}>{formatTime(item.createdAt)}</Text>
    </View>
  );

  const completedCalls = calls.filter((c) => c.status === 'completed').length;
  const missedCalls = calls.filter((c) => c.status === 'cancelled' || c.status === 'requested').length;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Calls</Text>
        {onOpenConversations && (
          <Pressable onPress={onOpenConversations} style={styles.chatIconBtn} hitSlop={8}>
            <Ionicons name="chatbubbles-outline" size={22} color={colors.foreground} />
            {totalUnread > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>

      {/* Stats Cards - Calls only */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, SHADOW]}>
          <Ionicons name="call" size={28} color={colors.success} />
          <Text style={styles.statValue}>{completedCalls}</Text>
          <Text style={styles.statLabel}>Completed Calls</Text>
        </View>
        <View style={[styles.statCard, SHADOW]}>
          <Ionicons name="call-outline" size={28} color={colors.destructive} />
          <Text style={styles.statValue}>{missedCalls}</Text>
          <Text style={styles.statLabel}>Missed</Text>
        </View>
      </View>

      {/* Availability Status */}
      <View style={[styles.card, SHADOW]}>
        <Text style={styles.cardTitle}>Your Availability</Text>
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Ionicons name="chatbubble" size={24} color={colors.success} />
            <Text style={styles.statusLabel}>Chat</Text>
            <Text style={[styles.statusValue, { color: colors.success }]}>ON</Text>
          </View>
          <View style={styles.statusItem}>
            <Ionicons
              name="videocam"
              size={24}
              color={videoEnabled ? colors.success : colors.mutedForeground}
            />
            <Text style={styles.statusLabel}>Video</Text>
            <Text
              style={[
                styles.statusValue,
                { color: videoEnabled ? colors.success : colors.destructive },
              ]}
            >
              {videoEnabled ? 'ON' : 'OFF'}
            </Text>
          </View>
        </View>
        <Text style={styles.hintText}>Manage availability in Dashboard settings</Text>
      </View>

      {/* Scheduled Callbacks */}
      <Text style={styles.sectionTitle}>Scheduled Calls</Text>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
      ) : scheduledCallbacks.length === 0 ? (
        <View style={[styles.emptyCard, SHADOW]}>
          <Ionicons name="calendar-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>No scheduled callbacks</Text>
          <Text style={styles.emptyText}>
            When customers schedule callbacks, they will appear here.
          </Text>
        </View>
      ) : (
        scheduledCallbacks.map((cb) => (
          <View key={cb._id} style={[styles.callItem, SHADOW]}>
            <View style={[styles.callIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="calendar-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.callInfo}>
              <Text style={styles.callerName}>
                {cb.customerName || (cb.customerId as any)?.name || (cb.customerId as any)?.phone || 'Customer'}
              </Text>
              <Text style={styles.callTime}>{formatScheduledAt(cb.scheduledAt)}</Text>
            </View>
          </View>
        ))
      )}

      {/* Call History */}
      <Text style={styles.sectionTitle}>Recent Calls</Text>

      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
      ) : calls.length === 0 ? (
        <View style={[styles.emptyCard, SHADOW]}>
          <Ionicons name="call-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>No calls yet</Text>
          <Text style={styles.emptyText}>
            Your call history will appear here when customers call your shop.
          </Text>
        </View>
      ) : (
        calls.slice(0, 10).map((call) => (
          <View key={call._id}>{renderCallItem({ item: call })}</View>
        ))
      )}
    </ScrollView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: PAD },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: colors.foreground },
  chatIconBtn: { position: 'relative', padding: 4 },
  chatBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.card,
  },
  chatBadgeText: { fontSize: 10, fontWeight: '700', color: colors.card },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
    marginTop: 8,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
    textAlign: 'center',
  },

  quickActions: {
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: PAD,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.card,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: PAD,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground, marginBottom: 12 },

  statusRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  statusItem: { alignItems: 'center' },
  statusLabel: { fontSize: 13, color: colors.mutedForeground, marginTop: 4 },
  statusValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  hintText: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: PAD,
    marginBottom: 10,
  },
  callIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  callInfo: {
    flex: 1,
  },
  callerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  callMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  callStatus: {
    fontSize: 13,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  callDuration: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  callTime: {
    fontSize: 12,
    color: colors.mutedForeground,
  },

  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
