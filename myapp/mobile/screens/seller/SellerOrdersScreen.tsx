import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';
import { apiGetAuth, apiPutAuth } from '../../api/client';
import { useChat } from '../../context/ChatContext';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
const PAD = 16;

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

type Order = {
  _id: string;
  customerId: { name?: string; phone?: string } | null;
  shopId: { name?: string } | null;
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  status: OrderStatus;
  deliveryAddress: { line1: string; city: string };
  createdAt: string;
};

// Display labels for seller: Orders placed → Ready for dispatch → Dispatched → Delivered
const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Orders placed', color: '#92400E', bg: '#FEF3C7' },
  confirmed: { label: 'Orders placed', color: '#92400E', bg: '#FEF3C7' },
  preparing: { label: 'Ready for dispatch', color: '#6B21A8', bg: '#F3E8FF' },
  ready: { label: 'Dispatched', color: '#065F46', bg: '#D1FAE5' },
  delivered: { label: 'Delivered', color: '#166534', bg: '#BBF7D0' },
  cancelled: { label: 'Cancelled', color: '#991B1B', bg: '#FEE2E2' },
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'orders_placed', label: 'Orders placed' },
  { key: 'preparing', label: 'Ready for dispatch' },
  { key: 'ready', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' },
];

type Props = { onOpenConversations?: () => void };

export default function SellerOrdersScreen({ onOpenConversations }: Props = {}) {
  const insets = useSafeAreaInsets();
  const { totalUnread } = useChat();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const statusParam = (activeTab === 'all' || activeTab === 'orders_placed') ? '' : `?status=${activeTab}`;
      const response = await apiGetAuth<{ orders: Order[] }>(`/orders/seller${statusParam}`);
      setOrders(response.orders || []);
    } catch (error) {
      console.error('[SellerOrders] Failed to fetch:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  async function handleUpdateStatus(orderId: string, newStatus: OrderStatus) {
    setUpdatingOrder(orderId);
    try {
      await apiPutAuth(`/orders/${orderId}/status`, { status: newStatus });
      // Update local state
      setOrders(prev => 
        prev.map(order => 
          order._id === orderId ? { ...order, status: newStatus } : order
        )
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update order status');
    } finally {
      setUpdatingOrder(null);
    }
  }

  function getNextStatus(current: OrderStatus): OrderStatus | null {
    const flow: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
    const idx = flow.indexOf(current);
    return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  const filteredOrders = activeTab === 'all'
    ? orders
    : activeTab === 'orders_placed'
      ? orders.filter(o => o.status === 'pending' || o.status === 'confirmed')
      : orders.filter(o => o.status === activeTab);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      <Text style={styles.title}>Orders</Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {TABS.map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="receipt-outline" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No orders yet</Text>
        </View>
      ) : (
        filteredOrders.map((order) => {
          const statusConfig = STATUS_CONFIG[order.status];
          const nextStatus = getNextStatus(order.status);
          const isUpdating = updatingOrder === order._id;
          
          return (
            <View key={order._id} style={[styles.orderCard, SHADOW]}>
              <View style={styles.cardRow}>
                <View>
                  <Text style={styles.customer}>
                    {order.customerId?.name || order.customerId?.phone || 'Customer'}
                  </Text>
                  <Text style={styles.date}>{formatDate(order.createdAt)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: statusConfig.bg }]}>
                  <Text style={[styles.badgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                </View>
              </View>
              
              <View style={styles.itemsList}>
                {order.items.slice(0, 2).map((item, idx) => (
                  <Text key={idx} style={styles.itemText}>• {item.name} × {item.quantity}</Text>
                ))}
                {order.items.length > 2 && (
                  <Text style={styles.itemText}>+ {order.items.length - 2} more items</Text>
                )}
              </View>
              
              <View style={styles.cardFooter}>
                <Text style={styles.amount}>₹{order.totalAmount.toLocaleString('en-IN')}</Text>
                {nextStatus && order.status !== 'cancelled' && (
                  <Pressable
                    style={[styles.actionBtn, isUpdating && styles.actionBtnDisabled]}
                    onPress={() => handleUpdateStatus(order._id, nextStatus)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <ActivityIndicator size="small" color={colors.card} />
                    ) : (
                      <Text style={styles.actionBtnText}>
                        Mark as {STATUS_CONFIG[nextStatus].label}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

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
  tabsScroll: { marginBottom: 16, marginHorizontal: -PAD },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: PAD },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.xxl, backgroundColor: colors.muted },
  tabActive: { backgroundColor: colors.primary },
  tabLabel: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
  tabLabelActive: { color: colors.card },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 16, color: colors.mutedForeground },
  orderCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: PAD, marginBottom: 12 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  customer: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  date: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.xxl },
  badgeText: { fontSize: 12, fontWeight: '600' },
  itemsList: { marginTop: 12, marginBottom: 12 },
  itemText: { fontSize: 13, color: colors.mutedForeground, marginBottom: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  amount: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  actionBtn: { backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.lg },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: colors.card },
});
