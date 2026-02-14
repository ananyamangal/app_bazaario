import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import ScreenHeader from '../components/ScreenHeader';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { apiGetAuth, apiPostAuth } from '../api/client';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
const PAD = 16;

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
};

type Order = {
  _id: string;
  shopId: { _id: string; name: string } | null;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  deliveryAddress: { line1: string; city: string };
  createdAt: string;
  paymentMethod?: string;
};

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'Orders placed', color: '#92400E', bg: '#FEF3C7', icon: 'time-outline' },
  confirmed: { label: 'Orders placed', color: '#92400E', bg: '#FEF3C7', icon: 'checkmark-circle-outline' },
  preparing: { label: 'Ready for dispatch', color: '#6B21A8', bg: '#F3E8FF', icon: 'restaurant-outline' },
  ready: { label: 'Dispatched', color: '#065F46', bg: '#D1FAE5', icon: 'bag-check-outline' },
  delivered: { label: 'Delivered', color: '#166534', bg: '#BBF7D0', icon: 'checkmark-done-outline' },
  cancelled: { label: 'Cancelled', color: '#991B1B', bg: '#FEE2E2', icon: 'close-circle-outline' },
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'delivered', label: 'Delivered' },
];

type Props = {
  onBack: () => void;
};

export default function MyOrdersScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [uploadingReviewImage, setUploadingReviewImage] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [selectedShopName, setSelectedShopName] = useState<string | null>(null);
  const [reviewedShopIds, setReviewedShopIds] = useState<string[]>([]);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await apiGetAuth<{ orders: Order[] }>('/orders/my');
      setOrders(response.orders || []);
    } catch (error) {
      console.error('[MyOrders] Failed to fetch:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  function openReviewModalForOrder(order: Order) {
    if (order.status !== 'delivered') return;
    if (!order.shopId?._id) {
      Alert.alert('Shop not found', 'Unable to write a review for this order.');
      return;
    }
    setSelectedShopId(order.shopId._id);
    setSelectedShopName(order.shopId.name);
    setReviewRating(0);
    setReviewText('');
    setReviewImages([]);
    setReviewModalVisible(true);
  }

  async function handlePickReviewImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'We need access to your photos to attach them to your review.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (!asset.uri) return;

      setUploadingReviewImage(true);

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const dataUri = `data:image/jpeg;base64,${base64}`;
      setReviewImages((prev) => [...prev, dataUri]);
    } catch (error) {
      console.error('[MyOrders] Review image pick error', error);
      Alert.alert('Error', 'Failed to pick image for review.');
    } finally {
      setUploadingReviewImage(false);
    }
  }

  function handleRemoveReviewImage(index: number) {
    setReviewImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmitReview() {
    if (!selectedShopId) {
      Alert.alert('Error', 'Shop not found for this order.');
      return;
    }
    if (!reviewRating) {
      Alert.alert('Rating required', 'Please select a star rating.');
      return;
    }

    try {
      setSubmittingReview(true);

      const base64Images = reviewImages
        .filter((img) => img.startsWith('data:'))
        .map((img) => img.replace(/^data:image\/\w+;base64,/, ''));

      await apiPostAuth(`/shops/${selectedShopId}/reviews`, {
        rating: Number(reviewRating),
        comment: reviewText.trim(),
        imagesBase64: base64Images,
      });

      Alert.alert('Thank you!', 'Your review has been submitted.');
      // Mark this shop as reviewed in the current session so the UI reflects it
      setReviewedShopIds((prev) =>
        selectedShopId && !prev.includes(selectedShopId) ? [...prev, selectedShopId] : prev
      );
      setReviewModalVisible(false);
    } catch (error: any) {
      console.error('[MyOrders] Submit review failed', error);
      const msg = error?.body?.error || error?.body?.message || error?.message || 'Could not submit review. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmittingReview(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return ['pending', 'confirmed', 'preparing', 'ready'].includes(order.status);
    if (activeTab === 'delivered') return order.status === 'delivered';
    return true;
  });

  return (
    <View style={styles.container}>
      <ScreenHeader onBack={onBack} title="My Orders" right={<View style={{ width: 24 }} />} />

      {/* Simple, compact tab row */}
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={({ pressed }) => [
                styles.tabButton,
                isActive && styles.tabButtonActive,
                pressed && styles.tabButtonPressed,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabButtonLabel, isActive && styles.tabButtonLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="receipt-outline" size={64} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>Your orders will appear here</Text>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const statusConfig = STATUS_CONFIG[order.status];

            return (
              <View key={order._id} style={[styles.orderCard, SHADOW]}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.shopName}>{order.shopId?.name || 'Shop'}</Text>
                    <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                    <Ionicons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemsList}>
                  {order.items.slice(0, 2).map((item, idx) => {
                    const imageUri = item.image || (item as any).imageUrl || '';
                    return (
                      <View key={idx} style={styles.itemRow}>
                        <View style={styles.itemImageWrap}>
                          {imageUri ? (
                            <Image source={{ uri: imageUri }} style={styles.itemImage} />
                          ) : (
                            <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                              <Ionicons name="image-outline" size={18} color={colors.mutedForeground} />
                            </View>
                          )}
                        </View>
                        <Text style={styles.itemText} numberOfLines={1}>
                          {item.name} × {item.quantity}
                        </Text>
                        <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
                      </View>
                    );
                  })}
                  {order.items.length > 2 && (
                    <Text style={styles.moreItems}>+{order.items.length - 2} more items</Text>
                  )}
                </View>

                <View style={styles.orderFooter}>
                  <View>
                    <Text style={styles.totalLabel}>Total Amount</Text>
                    <Text style={styles.totalValue}>₹{order.totalAmount.toLocaleString('en-IN')}</Text>
                  </View>
                  {!['cancelled', 'delivered'].includes(order.status) && (
                    <Pressable
                      style={({ pressed }) => [styles.trackOrderBtn, pressed && styles.pressed]}
                      onPress={() => {
                        // TODO: Link to Shiprocket tracking when trackingUrl/orderId is available
                        // e.g. Linking.openURL(order.trackingUrl) or open in-app tracking
                      }}
                    >
                      <Ionicons name="navigate-outline" size={14} color={colors.primary} />
                      <Text style={styles.trackOrderBtnText}>Track order</Text>
                    </Pressable>
                  )}
                  {order.status === 'delivered' && (
                    (() => {
                      const shopId = order.shopId?._id;
                      const hasReviewed = shopId ? reviewedShopIds.includes(shopId) : false;
                      return hasReviewed ? (
                        <View style={styles.reviewInfoWrap}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                          <Text style={styles.reviewInfoText}>Thanks for reviewing</Text>
                          <Pressable
                            style={({ pressed }) => [styles.reviewBtnInline, pressed && styles.pressed]}
                            onPress={() => openReviewModalForOrder(order)}
                          >
                            <Text style={styles.reviewBtnInlineText}>Review again</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          style={({ pressed }) => [styles.reviewBtn, pressed && styles.pressed]}
                          onPress={() => openReviewModalForOrder(order)}
                        >
                          <Ionicons name="create-outline" size={14} color={colors.primary} />
                          <Text style={styles.reviewBtnText}>Write a review</Text>
                        </Pressable>
                      );
                    })()
                  )}
                </View>

                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
                  <Text style={styles.addressText}>
                    {order.deliveryAddress?.line1}, {order.deliveryAddress?.city}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Write Review Modal (from orders) */}
      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <KeyboardAvoidingView style={styles.reviewModalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <View style={styles.reviewModalContent}>
            <View style={styles.reviewModalHeader}>
              <Text style={styles.reviewModalTitle}>
                {selectedShopName ? `Review ${selectedShopName}` : 'Write a Review'}
              </Text>
              <Pressable onPress={() => setReviewModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            <Text style={styles.reviewLabel}>Your rating</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setReviewRating(star)}
                  style={styles.starBtn}
                >
                  <Ionicons
                    name={reviewRating >= star ? 'star' : 'star-outline'}
                    size={28}
                    color="#FACC15"
                  />
                </Pressable>
              ))}
            </View>

            <Text style={styles.reviewLabel}>Your review</Text>
            <TextInput
              style={styles.reviewInput}
              value={reviewText}
              onChangeText={setReviewText}
              placeholder="Share your experience with this shop..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.reviewLabel}>Photos (optional)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.reviewImagesRow}
            >
              {reviewImages.map((img, index) => (
                <View key={index} style={styles.reviewThumbWrap}>
                  <Image source={{ uri: img }} style={styles.reviewThumb} />
                  <Pressable
                    style={styles.removeReviewImageBtn}
                    onPress={() => handleRemoveReviewImage(index)}
                  >
                    <Ionicons name="close" size={14} color={colors.card} />
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={handlePickReviewImage}
                style={[styles.addReviewImageBtn, uploadingReviewImage && styles.submitReviewBtnDisabled]}
              >
                {uploadingReviewImage ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="add" size={22} color={colors.primary} />
                )}
              </Pressable>
            </ScrollView>

            <Pressable
              onPress={handleSubmitReview}
              disabled={submittingReview}
              style={({ pressed }) => [
                styles.submitReviewBtn,
                pressed && styles.pressed,
                submittingReview && styles.submitReviewBtnDisabled,
              ]}
            >
              <Text style={styles.submitReviewText}>
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: PAD,
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 2,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.xl,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabButtonPressed: {
    opacity: 0.9,
  },
  tabButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  tabButtonLabelActive: {
    color: colors.card,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: PAD, paddingTop: 12 },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap: { paddingVertical: 80, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.foreground },
  emptyText: { fontSize: 15, color: colors.mutedForeground },
  orderCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 8, marginBottom: 8 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  shopName: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  orderDate: { fontSize: 11, color: colors.mutedForeground, marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.xxl },
  statusText: { fontSize: 11, fontWeight: '600' },
  itemsList: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, marginBottom: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  itemImageWrap: { marginRight: 8 },
  itemImage: { width: 40, height: 40, borderRadius: radius.sm },
  itemImagePlaceholder: {
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1, fontSize: 12, color: colors.foreground },
  itemPrice: { fontSize: 12, fontWeight: '600', color: colors.foreground },
  moreItems: { fontSize: 11, color: colors.mutedForeground, fontStyle: 'italic', marginTop: 2 },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  totalLabel: { fontSize: 11, color: colors.mutedForeground },
  totalValue: { fontSize: 16, fontWeight: '700', color: colors.primary },
  trackOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  trackOrderBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  pressed: { opacity: 0.8 },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  reviewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  reviewInfoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewInfoText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  reviewBtnInline: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  reviewBtnInlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  addressText: { fontSize: 12, color: colors.mutedForeground, flex: 1 },
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  reviewModalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 16,
  },
  reviewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reviewModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 8,
    marginBottom: 6,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starBtn: {
    padding: 4,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 10,
    fontSize: 14,
    color: colors.foreground,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  reviewImagesRow: {
    marginTop: 8,
  },
  addReviewImageBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewThumbWrap: {
    position: 'relative',
    marginRight: 6,
  },
  reviewThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
  },
  removeReviewImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitReviewBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitReviewBtnDisabled: {
    opacity: 0.7,
  },
  submitReviewText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.card,
  },
});
