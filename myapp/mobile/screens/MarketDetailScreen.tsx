import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabNavigator, type MarketDetailParams } from '../navigation/TabContext';
import BackButton from '../components/BackButton';
import NotificationBell from '../components/NotificationBell';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { apiGet } from '../api/client';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const HERO_HEIGHT = 180;
const HORIZONTAL_PADDING = 16;
const SHOP_IMAGE_SIZE = 80;

const RATING_YELLOW = '#FEF3C7';
const SHADOW_OPACITY = 0.08;
const SHADOW_RADIUS = 8;
const SHADOW_OFFSET = { width: 0, height: 2 };

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Shop = {
  _id: string;
  shopName?: string;
  name?: string;
  description?: string;
  ratingAverage?: number;
  isOpen?: boolean;
  categories?: string[];
};

type Props = MarketDetailParams & { onBack: () => void };

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function MarketDetailScreen({
  marketId,
  name,
  location,
  rating,
  description,
  imageUrl,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const { openShopDetail } = useTabNavigator();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const searchLayoutY = useRef(0);

  useEffect(() => {
    async function loadShops() {
      try {
        setLoading(true);
        const data = await apiGet<Shop[]>(`/markets/${marketId}/shops`);
        setShops(data);
      } catch (e) {
        console.warn('Failed to load shops', e);
      } finally {
        setLoading(false);
      }
    }
    loadShops();
  }, [marketId]);

  const filteredShops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter((shop) => {
      const name = (shop.shopName ?? shop.name ?? '').toLowerCase();
      const desc = (shop.description ?? '').toLowerCase();
      const categories = (shop.categories ?? []).join(' ').toLowerCase();
      return name.includes(q) || desc.includes(q) || categories.includes(q);
    });
  }, [shops, searchQuery]);

  function handleVisitShop(shopId: string) {
    openShopDetail({ shopId });
  }

  function handleCallShop(_shopId: string) {
    // TODO: implement video call
  }

  const heroImageUri =
    imageUrl ||
    (shops.length > 0
      ? ((shops[0] as any).banner || (shops[0] as any).images?.[0] || null)
      : null);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Top bar: back button (no logo), notification */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10, paddingBottom: 10 }]}>
        <BackButton onPress={onBack} withPadding={false} />
        <View style={styles.topBarSpacer} />
        <NotificationBell dropdownTop={insets.top + 56} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Market Hero */}
        <View style={styles.heroWrap}>
          <View style={styles.heroImage}>
            {heroImageUri ? (
              <Image source={{ uri: heroImageUri }} style={styles.heroImageBackground} />
            ) : (
              <View style={styles.heroImagePlaceholder} />
            )}
          </View>
          <Text style={styles.heroTitle}>{name}</Text>
          <View style={styles.badges}>
            <View style={styles.locationBadge}>
              <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
              <Text style={styles.badgeText}>{location}</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>⭐ {rating}</Text>
            </View>
          </View>
          <Text style={styles.heroDesc}>{description}</Text>
        </View>

        {/* Search bar - search stores, categories within this market */}
        <View
          style={styles.searchWrap}
          onLayout={(evt) => {
            searchLayoutY.current = evt.nativeEvent.layout.y;
          }}
        >
          <Ionicons name="search" size={20} color={colors.mutedForeground} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search stores, categories..."
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            onFocus={() => {
              setTimeout(() => {
                scrollRef.current?.scrollTo({
                  y: Math.max(0, searchLayoutY.current - 80),
                  animated: true,
                });
              }, 300);
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8} style={styles.searchClear}>
              <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {/* Shops */}
        <Text style={styles.sectionTitle}>
          {loading ? 'Loading shops...' : `Shops in ${name}${searchQuery.trim() ? ` (${filteredShops.length})` : ''}`}
        </Text>
        {!loading && searchQuery.trim() && filteredShops.length === 0 && (
          <Text style={styles.emptySearch}>No stores or categories match "{searchQuery.trim()}"</Text>
        )}
        {filteredShops.map((shop) => (
          <Pressable key={shop._id} onPress={() => handleVisitShop(shop._id)} style={({ pressed }) => [styles.shopCard, pressed && styles.cardPressed]}>
            {((shop as any).banner || (shop as any).images?.[0]) ? (
              <Image
                source={{ uri: (shop as any).banner || (shop as any).images[0] }}
                style={styles.shopImage}
              />
            ) : (
              <View style={[styles.shopImage, styles.shopImagePlaceholder]}>
                <Ionicons name="storefront-outline" size={28} color={colors.mutedForeground} />
              </View>
            )}
            <View style={styles.availablePill}>
              <Text style={styles.availableText}>{shop.isOpen !== false ? 'Available' : 'Closed'}</Text>
            </View>
            <View style={styles.shopBody}>
              <Text style={styles.shopName}>{shop.shopName ?? shop.name ?? 'Shop'}</Text>
              <Text style={styles.shopSubtitle}>{shop.description ?? ''}</Text>
              <View style={styles.shopActions}>
                <Pressable
                  onPress={() => handleVisitShop(shop._id)}
                  style={({ pressed }) => [styles.visitBtn, pressed && styles.btnPressed]}
                >
                  <Text style={styles.visitBtnLabel}>Visit Shop</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleCallShop(shop._id)}
                  style={({ pressed }) => [styles.callBtn, pressed && styles.btnPressed]}
                >
                  <Ionicons name="call" size={16} color={colors.card} />
                  <Text style={styles.callBtnLabel}>Call</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: HORIZONTAL_PADDING, paddingBottom: 100 },
  pressed: { opacity: 0.85 },
  btnPressed: { opacity: 0.9 },
  cardPressed: { opacity: 0.98 },

  heroWrap: { marginBottom: 20 },
  heroImage: {
    height: HERO_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
  },
  heroImagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.border,
  },
   heroImageBackground: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarSpacer: { flex: 1 },
  heroTitle: { fontSize: 24, fontWeight: '700', color: colors.foreground, marginBottom: 10 },
  badges: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.xxl,
  },
  badgeText: { fontSize: 13, color: colors.mutedForeground },
  ratingBadge: {
    backgroundColor: RATING_YELLOW,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.xxl,
  },
  ratingText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  heroDesc: { fontSize: 15, color: colors.mutedForeground, lineHeight: 22, marginBottom: 16 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.foreground,
    paddingVertical: 12,
  },
  searchClear: { padding: 4 },
  emptySearch: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 14 },

  shopCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: SHADOW_OFFSET,
    shadowOpacity: SHADOW_OPACITY,
    shadowRadius: SHADOW_RADIUS,
    elevation: 2,
    position: 'relative',
  },
  shopImage: {
    width: SHOP_IMAGE_SIZE,
    height: SHOP_IMAGE_SIZE,
    borderRadius: radius.md,
    margin: 12,
  },
  shopImagePlaceholder: {
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availablePill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.xxl,
  },
  availableText: { fontSize: 11, fontWeight: '700', color: colors.card },
  shopBody: { flex: 1, padding: 12, paddingLeft: 0, paddingRight: 72, justifyContent: 'center' },
  shopName: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 4 },
  shopSubtitle: { fontSize: 13, color: colors.mutedForeground, marginBottom: 12 },
  shopActions: { flexDirection: 'row', gap: 10 },
  visitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  visitBtnLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  callBtnLabel: { fontSize: 14, fontWeight: '600', color: colors.card },
});
