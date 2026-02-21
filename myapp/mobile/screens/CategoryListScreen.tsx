import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../components/ScreenHeader';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { apiGet } from '../api/client';

// Same display order and icons as HomeScreen (priority 7 first, then rest)
const CATEGORY_DISPLAY: { name: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: "Women's Western", icon: 'woman-outline' },
  { name: 'Bags', icon: 'bag-outline' },
  { name: 'Traditional wear', icon: 'flower-outline' },
  { name: 'Kids and toys', icon: 'happy-outline' },
  { name: 'Footwear', icon: 'walk-outline' },
  { name: 'Home decor', icon: 'home-outline' },
  { name: 'Jewellery and accessories', icon: 'diamond-outline' },
  { name: 'Home appliances', icon: 'desktop-outline' },
  { name: 'Electronics', icon: 'phone-portrait-outline' },
  { name: 'Beauty and health', icon: 'sparkles-outline' },
  { name: 'Menswear', icon: 'shirt-outline' },
];

type ApiCategory = { _id: string; name: string };
type MergedCategory = { _id: string | null; name: string; icon: keyof typeof Ionicons.glyphMap };

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
  images?: string[];
  // Basic location fields from backend
  addressLine?: string;
  city?: string;
  state?: string;
};

type Props = {
  onBack: () => void;
  // Open a specific shop detail from the right pane
  onOpenShop: (shopId: string) => void;
};

export default function CategoryListScreen({ onBack, onOpenShop }: Props) {
  // Show all 11 immediately; fill _id from API when name matches
  const [merged, setMerged] = useState<MergedCategory[]>(() =>
    CATEGORY_DISPLAY.map((d) => ({ name: d.name, icon: d.icon, _id: null }))
  );
  const [selectedLeft, setSelectedLeft] = useState<string>('All');
  const [shops, setShops] = useState<Shop[]>([]);
  const [loadingShops, setLoadingShops] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiGet<ApiCategory[]>('/categories');
        if (cancelled) return;
        const normalized = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
        const result = CATEGORY_DISPLAY.map((d) => {
          const match = list.find((c) => normalized(c.name) === normalized(d.name));
          return { name: d.name, icon: d.icon, _id: match ? match._id : null };
        });
        setMerged(result);
      } catch {
        if (!cancelled) setMerged(CATEGORY_DISPLAY.map((d) => ({ name: d.name, icon: d.icon, _id: null })));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const leftItems = useMemo(
    () => ['All', ...CATEGORY_DISPLAY.map((c) => c.name)],
    []
  );

  const visibleCategories = useMemo(() => {
    if (selectedLeft === 'All') return merged;
    return merged.filter((c) => c.name === selectedLeft);
  }, [merged, selectedLeft]);

  // Load shops for the selected category (Meesho-style: left category → right shops)
  useEffect(() => {
    let cancelled = false;
    async function loadShops() {
      try {
        setLoadingShops(true);
        // Popular: show all shops
        if (selectedLeft === 'All') {
          const all = await apiGet<Shop[]>('/shops');
          if (!cancelled) setShops(all);
          return;
        }
        const match = merged.find((c) => c.name === selectedLeft);
        if (!match || !match._id) {
          if (!cancelled) setShops([]);
          return;
        }
        const result = await apiGet<Shop[]>(`/categories/${match._id}/shops`);
        if (!cancelled) setShops(result);
      } catch (e) {
        console.warn('[CategoryList] Failed to load shops for', selectedLeft, e);
        if (!cancelled) setShops([]);
      } finally {
        if (!cancelled) setLoadingShops(false);
      }
    }
    loadShops();
    return () => {
      cancelled = true;
    };
  }, [selectedLeft, merged]);

  return (
    <View style={styles.container}>
      <ScreenHeader onBack={onBack} title="Categories" />
      <View style={styles.body}>
        {/* Left nav - main categories (Meesho-style list) */}
        <View style={styles.leftNav}>
          <ScrollView
            contentContainerStyle={styles.leftNavContent}
            showsVerticalScrollIndicator={false}
          >
            {leftItems.map((label) => {
              const isActive = label === selectedLeft;
              const matching = CATEGORY_DISPLAY.find((c) => c.name === label);
              return (
                <Pressable
                  key={label}
                  onPress={() => setSelectedLeft(label)}
                  style={({ pressed }) => [
                    styles.leftItem,
                    isActive && styles.leftItemActive,
                    pressed && styles.leftItemPressed,
                  ]}
                >
                  {matching && (
                    <View style={styles.leftIconWrap}>
                      <Ionicons
                        name={matching.icon}
                        size={18}
                        color={isActive ? colors.primary : colors.mutedForeground}
                      />
                    </View>
                  )}
                  <Text style={[styles.leftItemLabel, isActive && styles.leftItemLabelActive]}>
                    {label === 'All' ? 'Popular' : label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Right pane - shops for selected category */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionHeading}>
            {selectedLeft === 'All' ? 'All popular shops' : `Shops in ${selectedLeft}`}
          </Text>

          {loadingShops ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading shops...</Text>
            </View>
          ) : shops.length === 0 ? (
            <Text style={styles.emptyText}>No shops found for this category yet.</Text>
          ) : (
            shops.map((shop) => {
              const parts: string[] = [];
              if (shop.addressLine) parts.push(shop.addressLine);
              if (shop.city) parts.push(shop.city);
              if (shop.state) parts.push(shop.state);
              const location = parts.length > 0 ? parts.join(', ') : null;
              return (
                <Pressable
                  key={shop._id}
                  onPress={() => onOpenShop(shop._id)}
                  style={({ pressed }) => [styles.shopCard, pressed && styles.cardPressed]}
                >
                  <View style={styles.shopImageWrap}>
                    {shop.images && shop.images[0] ? (
                      <Image source={{ uri: shop.images[0] }} style={styles.shopImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.shopImage, styles.shopImagePlaceholder]}>
                        <Ionicons name="storefront-outline" size={22} color={colors.mutedForeground} />
                      </View>
                    )}
                  </View>
                  <View style={styles.shopBody}>
                    <Text style={styles.shopName} numberOfLines={1}>
                      {shop.shopName ?? shop.name ?? 'Shop'}
                    </Text>
                    {location && (
                      <View style={styles.shopLocationRow}>
                        <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
                        <Text style={styles.shopLocationText} numberOfLines={1}>
                          {location}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.shopSubtitle} numberOfLines={2}>
                      {shop.description ?? ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  leftNav: {
    width: 182,
    minWidth: 182,
    backgroundColor: colors.muted,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  leftNavContent: {
    paddingVertical: spacing.sm,
  },
  leftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 8,
  },
  leftItemActive: {
    backgroundColor: colors.card,
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  leftItemPressed: { opacity: 0.85 },
  leftIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftItemLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  leftItemLabelActive: {
    fontWeight: '600',
    color: colors.foreground,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 32 },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  loadingWrap: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: { fontSize: 13, color: colors.mutedForeground },
  emptyText: { fontSize: 13, color: colors.mutedForeground, paddingVertical: spacing.md },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { opacity: 0.9 },
  shopImageWrap: { marginRight: spacing.sm },
  shopImage: { width: 52, height: 52, borderRadius: radius.md },
  shopImagePlaceholder: {
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopBody: { flex: 1 },
  shopName: { fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 2 },
  shopSubtitle: { fontSize: 12, color: colors.mutedForeground },
});
