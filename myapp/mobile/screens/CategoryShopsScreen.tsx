import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NotificationBell from '../components/NotificationBell';
import { useTabNavigator, type CategoryShopsParams } from '../navigation/TabContext';
import BackButton from '../components/BackButton';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { apiGet } from '../api/client';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const LOGO_SIZE = 36;
const HERO_HEIGHT = 140;
const HORIZONTAL_PADDING = 16;
const SHOP_IMAGE_SIZE = 80;

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

type Market = {
  _id: string;
  name: string;
};

type Shop = {
  _id: string;
  shopName?: string;
  name?: string;
  description?: string;
  marketId?: string;
  isOpen?: boolean;
  promotion?: {
    title?: string | null;
    discountPercent?: number | null;
    active?: boolean;
  };
};

type Props = CategoryShopsParams & { onBack: () => void };

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function CategoryShopsScreen({
  categoryId,
  categoryLabel,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const { switchToTab, openShopDetail } = useTabNavigator();
  const [marketFilter, setMarketFilter] = useState<string | null>(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [shopsData, marketsData] = await Promise.all([
          apiGet<Shop[]>(`/categories/${categoryId}/shops`),
          apiGet<Market[]>('/markets'),
        ]);
        setShops(shopsData);
        setMarkets(marketsData);
      } catch (e) {
        console.warn('Failed to load category shops', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [categoryId]);

  const filteredShops = useMemo(() => {
    if (!marketFilter) return shops;
    return shops.filter((s) => s.marketId === marketFilter);
  }, [shops, marketFilter]);

  const filterLabel = marketFilter == null
    ? 'All markets'
    : markets.find((m) => m._id === marketFilter)?.name ?? 'All markets';

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

  function handleSelectFilter(id: string | null) {
    setMarketFilter(id);
    setFilterModalOpen(false);
  }

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

        {/* Hero: Shop for {Category} */}
        <View style={styles.heroWrap}>
          <View style={styles.heroImage}>
            <View style={styles.heroImagePlaceholder} />
            <View style={styles.backBtnWrap}>
              <BackButton onPress={onBack} variant="floating" iconColor={colors.card} />
            </View>
          </View>
          <Text style={styles.heroTitle}>Shop for {categoryLabel}</Text>
        </View>

        {/* Stores section: title left, Filter by market right */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Stores</Text>
          <Pressable
            onPress={() => setFilterModalOpen(true)}
            style={({ pressed }) => [styles.filterBtn, pressed && styles.filterBtnPressed]}
          >
            <Ionicons name="filter" size={18} color={colors.primary} />
            <Text style={styles.filterLabel}>{filterLabel}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.primary} />
          </Pressable>
        </View>

        {filteredShops.map((shop) => (
          <Pressable
            key={shop._id}
            onPress={() => handleVisitShop(shop._id)}
            style={({ pressed }) => [styles.shopCard, pressed && styles.cardPressed]}
          >
            <View style={styles.shopImage} />
            <View style={styles.availablePill}>
              <Text style={styles.availableText}>{shop.isOpen !== false ? 'Available' : 'Closed'}</Text>
            </View>
            <View style={styles.shopBody}>
              <Text style={styles.shopName}>{shop.shopName ?? shop.name ?? 'Shop'}</Text>
              {shop.promotion?.active && (
                <View style={styles.promoBadge}>
                  <Text style={styles.promoBadgeText}>
                    {shop.promotion.discountPercent
                      ? `${shop.promotion.discountPercent}% OFF`
                      : shop.promotion.title || 'Offer'}
                  </Text>
                </View>
              )}
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

      {/* Filter by market modal */}
      <Modal visible={filterModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilterModalOpen(false)} />
          <Pressable style={styles.filterModal} onPress={() => { }}>
            <Text style={styles.filterModalTitle}>Filter by market</Text>
            <Pressable
              onPress={() => handleSelectFilter(null)}
              style={[styles.filterOption, marketFilter == null && styles.filterOptionActive]}
            >
              <Text style={[styles.filterOptionText, marketFilter == null && styles.filterOptionTextActive]}>All markets</Text>
              {marketFilter == null && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </Pressable>
            {markets.map((m) => (
              <Pressable
                key={m._id}
                onPress={() => handleSelectFilter(m._id)}
                style={[styles.filterOption, marketFilter === m._id && styles.filterOptionActive]}
              >
                <Text style={[styles.filterOptionText, marketFilter === m._id && styles.filterOptionTextActive]}>{m.name}</Text>
                {marketFilter === m._id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            ))}
          </Pressable>
        </View>
      </Modal>
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

  heroWrap: { marginBottom: 20 },
  heroImage: {
    height: HERO_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    position: 'relative',
    marginBottom: 12,
  },
  heroImagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.border,
  },
  backBtnWrap: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
  },
  heroTitle: { fontSize: 24, fontWeight: '700', color: colors.foreground },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  filterBtnPressed: { opacity: 0.8 },
  filterLabel: { fontSize: 14, fontWeight: '600', color: colors.primary },

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
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    margin: 12,
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
  shopName: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 2 },
  promoBadge: {
    alignSelf: 'flex-start',
    marginBottom: 4,
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  filterModal: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 16,
  },
  filterModalTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
  },
  filterOptionActive: { backgroundColor: colors.secondary },
  filterOptionText: { fontSize: 15, color: colors.foreground },
  filterOptionTextActive: { fontWeight: '600', color: colors.primary },
});
