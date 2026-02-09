import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenHeader from '../components/ScreenHeader';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { apiGetAuth, apiDeleteAuth } from '../api/client';
import { useAuth } from '../context/AuthContext';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
const PAD = 16;

type SavedShop = {
  _id: string;
  name?: string;
  shopName?: string;
  description?: string;
  images?: string[];
  categories?: string[];
  ratingAverage?: number;
  reviewCount?: number;
};

type Props = {
  onBack: () => void;
  onViewShop: (shopId: string) => void;
};

export default function SavedShopsScreen({ onBack, onViewShop }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [shops, setShops] = useState<SavedShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [unsavingId, setUnsavingId] = useState<string | null>(null);

  const loadSavedShops = useCallback(async () => {
    if (!user) {
      setShops([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await apiGetAuth<{ shops: SavedShop[] }>('/me/saved-shops');
      setShops(res.shops ?? []);
    } catch {
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSavedShops();
  }, [loadSavedShops]);

  async function handleUnsave(shopId: string) {
    setUnsavingId(shopId);
    try {
      await apiDeleteAuth(`/me/saved-shops/${shopId}`);
      setShops(prev => prev.filter(s => s._id !== shopId));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not remove shop.');
    } finally {
      setUnsavingId(null);
    }
  }

  function handleUnsavePress(shop: SavedShop) {
    Alert.alert(
      'Remove saved shop',
      `Remove ${shop.shopName ?? shop.name ?? 'this shop'} from your saved shops?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => handleUnsave(shop._id) },
      ]
    );
  }

  const displayName = (s: SavedShop) => s.shopName ?? s.name ?? 'Shop';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>Saved Shops</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading saved shops...</Text>
          </View>
        ) : !user ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="person-outline" size={64} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>Sign in to save shops</Text>
            <Text style={styles.emptyText}>Your saved shops will appear here</Text>
          </View>
        ) : shops.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="bookmark-outline" size={64} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No saved shops yet</Text>
            <Text style={styles.emptyText}>Tap the bookmark icon on a shop profile to save it here</Text>
          </View>
        ) : (
          shops.map((shop) => (
            <View key={shop._id} style={[styles.shopCard, SHADOW]}>
              <Pressable
                onPress={() => onViewShop(shop._id)}
                style={({ pressed }) => [styles.shopRow, pressed && styles.pressed]}
              >
                {((shop as any).banner || shop.images?.[0]) ? (
                  <Image
                    source={{ uri: (shop as any).banner || shop.images![0] }}
                    style={styles.shopImage}
                  />
                ) : (
                  <View style={[styles.shopImage, styles.shopImagePlaceholder]}>
                    <Ionicons name="storefront-outline" size={28} color={colors.mutedForeground} />
                  </View>
                )}
                <View style={styles.shopInfo}>
                  <Text style={styles.shopName} numberOfLines={2}>{displayName(shop)}</Text>
                  {(shop as any).promotion?.active && (
                    <View style={styles.promoBadge}>
                      <Text style={styles.promoBadgeText}>
                        {(shop as any).promotion.discountPercent
                          ? `${(shop as any).promotion.discountPercent}% OFF`
                          : (shop as any).promotion.title || 'Offer'}
                      </Text>
                    </View>
                  )}
                  {shop.description ? (
                    <Text style={styles.shopDesc} numberOfLines={1}>{shop.description}</Text>
                  ) : null}
                  {(shop.ratingAverage != null || shop.reviewCount != null) && (
                    <Text style={styles.shopMeta}>
                      ⭐ {(shop.ratingAverage ?? 0).toFixed(1)}
                      {shop.reviewCount != null ? ` · ${shop.reviewCount} reviews` : ''}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                onPress={() => handleUnsavePress(shop)}
                disabled={unsavingId === shop._id}
                style={({ pressed }) => [styles.unsaveBtn, pressed && styles.pressed]}
              >
                {unsavingId === shop._id ? (
                  <ActivityIndicator size="small" color={colors.destructive} />
                ) : (
                  <>
                    <Ionicons name="bookmark" size={18} color={colors.destructive} />
                    <Text style={styles.unsaveLabel}>Unsave</Text>
                  </>
                )}
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: PAD },
  loadingWrap: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: colors.mutedForeground },
  emptyWrap: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.foreground },
  emptyText: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: 24 },
  shopCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: PAD,
    marginBottom: 12,
    overflow: 'hidden',
  },
  shopRow: { flexDirection: 'row', alignItems: 'center' },
  shopImage: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.background },
  shopImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  shopInfo: { flex: 1, marginLeft: 12 },
  shopName: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  promoBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xxl,
    backgroundColor: colors.secondary,
  },
  promoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  shopDesc: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  shopMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
  unsaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  unsaveLabel: { fontSize: 14, fontWeight: '600', color: colors.destructive },
  pressed: { opacity: 0.8 },
});
