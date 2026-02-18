import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
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

import BackButton from '../components/BackButton';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { apiGet } from '../api/client';
import { useTabNavigator } from '../navigation/TabContext';

type Props = {
  onBack: () => void;
  initialQuery?: string;
};

type SearchResult = {
  shops: ShopResult[];
  markets: MarketResult[];
  products: ProductResult[];
};

type ShopResult = {
  _id: string;
  name: string;
  description?: string;
  images?: string[];
  banner?: string;
  categories?: string[];
  ratingAverage?: number;
  reviewCount?: number;
  promotion?: {
    active?: boolean;
    discountPercent?: number;
    title?: string;
  };
};

type MarketResult = {
  _id: string;
  name: string;
  city: string;
  state: string;
  description?: string;
  images?: Array<{ url: string }>;
  ratingAverage?: number;
};

type ProductResult = {
  _id: string;
  name: string;
  description?: string;
  images?: string[];
  price: number;
  discountPrice?: number;
  shop: {
    _id: string;
    name: string;
    images?: string[];
    banner?: string;
  } | null;
  category: {
    _id: string;
    name: string;
  } | null;
};

export default function SearchResultsScreen({ onBack, initialQuery = '' }: Props) {
  const insets = useSafeAreaInsets();
  const { openShopDetail, openMarketDetail } = useTabNavigator();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult>({ shops: [], markets: [], products: [] });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setResults({ shops: [], markets: [], products: [] });
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const data = await apiGet<SearchResult>(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setResults(data);
    } catch (error) {
      console.error('[SearchResults] Search failed:', error);
      setResults({ shops: [], markets: [], products: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery, performSearch]);

  const handleSearch = () => {
    performSearch(query);
  };

  const renderShop = ({ item }: { item: ShopResult }) => (
    <Pressable
      onPress={() => openShopDetail({ shopId: item._id })}
      style={({ pressed }) => [styles.resultCard, pressed && styles.pressed]}
    >
      <Image
        source={{ uri: item.banner || item.images?.[0] || '' }}
        style={styles.shopImage}
        defaultSource={require('../../assets/icon.png')}
      />
      <View style={styles.shopInfo}>
        <View style={styles.shopHeader}>
          <Text style={styles.shopName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.promotion?.active && (
            <View style={styles.promoBadge}>
              <Text style={styles.promoText}>
                {item.promotion.discountPercent ? `${item.promotion.discountPercent}% OFF` : 'Offer'}
              </Text>
            </View>
          )}
        </View>
        {item.description && (
          <Text style={styles.shopDesc} numberOfLines={1}>
            {item.description}
          </Text>
        )}
        <View style={styles.shopMeta}>
          {item.ratingAverage !== undefined && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#FACC15" />
              <Text style={styles.ratingText}>
                {item.ratingAverage.toFixed(1)} ({item.reviewCount || 0})
              </Text>
            </View>
          )}
          {item.categories && item.categories.length > 0 && (
            <Text style={styles.categoryText} numberOfLines={1}>
              {item.categories[0]}
            </Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
    </Pressable>
  );

  const renderMarket = ({ item }: { item: MarketResult }) => (
    <Pressable
      onPress={() =>
        openMarketDetail({
          marketId: item._id,
          name: item.name,
          location: `${item.city}, ${item.state}`,
          rating: item.ratingAverage || 4.5,
          description: item.description || '',
          imageUrl: item.images?.[0]?.url,
        })
      }
      style={({ pressed }) => [styles.resultCard, pressed && styles.pressed]}
    >
      <Image
        source={{ uri: item.images?.[0]?.url || '' }}
        style={styles.marketImage}
        defaultSource={require('../../assets/icon.png')}
      />
      <View style={styles.marketInfo}>
        <Text style={styles.marketName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
          <Text style={styles.locationText}>
            {item.city}, {item.state}
          </Text>
        </View>
        {item.ratingAverage !== undefined && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color="#FACC15" />
            <Text style={styles.ratingText}>{item.ratingAverage.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
    </Pressable>
  );

  const renderProduct = ({ item }: { item: ProductResult }) => (
    <Pressable
      onPress={() => item.shop && openShopDetail({ shopId: item.shop._id })}
      style={({ pressed }) => [styles.resultCard, pressed && styles.pressed]}
    >
      <Image
        source={{ uri: item.images?.[0] || '' }}
        style={styles.productImage}
        defaultSource={require('../../assets/icon.png')}
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.shop && (
          <Text style={styles.productShop} numberOfLines={1}>
            {item.shop.name}
          </Text>
        )}
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            ₹{item.discountPrice || item.price}
          </Text>
          {item.discountPrice && item.discountPrice < item.price && (
            <Text style={styles.originalPrice}>₹{item.price}</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
    </Pressable>
  );

  const totalResults = results.shops.length + results.markets.length + results.products.length;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.inner, { paddingTop: insets.top + spacing.md }]}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={onBack} />
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search shops, markets, products..."
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <Pressable onPress={handleSearch} style={styles.searchBtn} hitSlop={8}>
            <Ionicons name="search" size={18} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.centerText}>Searching...</Text>
        </View>
      ) : !hasSearched ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Start searching</Text>
          <Text style={styles.emptySubtitle}>
            Search for shops, markets, products, or locations
          </Text>
        </View>
      ) : totalResults === 0 ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>
            Try searching with different keywords
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {results.shops.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Shops ({results.shops.length})</Text>
              <FlatList
                data={results.shops}
                renderItem={renderShop}
                keyExtractor={(item) => item._id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </View>
          )}

          {results.markets.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Markets ({results.markets.length})</Text>
              <FlatList
                data={results.markets}
                renderItem={renderMarket}
                keyExtractor={(item) => item._id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </View>
          )}

          {results.products.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Products ({results.products.length})</Text>
              <FlatList
                data={results.products}
                renderItem={renderProduct}
                keyExtractor={(item) => item._id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </View>
          )}
        </ScrollView>
      )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  searchBtn: {
    padding: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  centerText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptySubtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  separator: {
    height: spacing.sm,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.9,
  },
  shopImage: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  shopInfo: {
    flex: 1,
    minWidth: 0,
  },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  shopName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  promoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xxl,
    backgroundColor: colors.secondary,
  },
  promoText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  shopDesc: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  shopMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  categoryText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  marketImage: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  marketInfo: {
    flex: 1,
    minWidth: 0,
  },
  marketName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  productShop: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  originalPrice: {
    fontSize: 13,
    color: colors.mutedForeground,
    textDecorationLine: 'line-through',
  },
});
