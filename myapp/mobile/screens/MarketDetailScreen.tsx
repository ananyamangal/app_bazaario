import React, { useEffect, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NotificationBell from '../components/NotificationBell';
import { useTabNavigator, type MarketDetailParams } from '../navigation/TabContext';
import BackButton from '../components/BackButton';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { apiGet } from '../api/client';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const LOGO_SIZE = 36;
const HERO_HEIGHT = 180;
const HORIZONTAL_PADDING = 16;
const SHOP_IMAGE_SIZE = 80;

const RATING_YELLOW = '#FEF3C7';
const SHADOW_OPACITY = 0.08;
const SHADOW_RADIUS = 8;
const SHADOW_OFFSET = { width: 0, height: 2 };

// -----------------------------------------------------------------------------
// Assets
// -----------------------------------------------------------------------------

const splashLogo: ImageSourcePropType = require('../../assets/bazaario-logo.png');

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
  const { switchToTab, openShopDetail } = useTabNavigator();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

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

  function handleLogo() {
    switchToTab('Home');
  }

  function handleSearch() {
    switchToTab('Explore');
  }

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
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={handleLogo} style={({ pressed }) => [styles.logoRow, pressed && styles.pressed]}>
            <Image source={splashLogo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.logoText}>Bazaario</Text>
          </Pressable>
          <Pressable onPress={handleSearch} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} hitSlop={8}>
            <Ionicons name="search" size={22} color={colors.foreground} />
          </Pressable>
          <NotificationBell dropdownTop={insets.top + 56} />
        </View>

        {/* Market Hero */}
        <View style={styles.heroWrap}>
          <View style={styles.heroImage}>
            {heroImageUri ? (
              <Image source={{ uri: heroImageUri }} style={styles.heroImageBackground} />
            ) : (
              <View style={styles.heroImagePlaceholder} />
            )}
            <View style={styles.backBtnWrap}>
              <BackButton onPress={onBack} variant="floating" iconColor={colors.card} />
            </View>
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

        {/* Shops */}
        <Text style={styles.sectionTitle}>
          {loading ? 'Loading shops...' : `Shops in ${name}`}
        </Text>
        {shops.map((shop) => (
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
    </View>
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 4,
    backgroundColor: colors.card,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  logoText: { fontSize: 18, fontWeight: '700', color: colors.foreground, fontFamily: 'Impact' },
  iconBtn: { padding: 4, marginLeft: 8, position: 'relative' as const },

  heroWrap: { marginBottom: 24 },
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
  backBtnWrap: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
  },
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
  heroDesc: { fontSize: 15, color: colors.mutedForeground, lineHeight: 22 },

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
