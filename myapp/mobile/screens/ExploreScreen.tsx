import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  FlatList,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NotificationBell from '../components/NotificationBell';
import { useTabNavigator } from '../navigation/TabContext';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { apiGet } from '../api/client';
import { useChat } from '../context/ChatContext';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const LOGO_SIZE = 28;
const HORIZONTAL_PADDING = 16;
const CARD_GAP = 12;
const IMAGE_ASPECT = 1.1;

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

type MarketImage = { url: string; type?: 'cover' | 'gallery' };

type Market = {
  _id: string;
  name: string;
  city: string;
  state: string;
  description?: string;
  ratingAverage?: number;
  images?: MarketImage[];
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ExploreScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { switchToTab, openMarketDetail, openShopDetail, openConversations } = useTabNavigator();
  const { totalUnread } = useChat();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    shops: any[];
    markets: any[];
    products: any[];
  } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const expandedWidth = screenWidth * 0.9;

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await apiGet<Market[]>('/markets');
        if (isMounted) setMarkets(data);
      } catch (e) {
        console.warn('Failed to load markets', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults(null);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    setShowSearchResults(true);
    try {
      const data = await apiGet<{ shops: any[]; markets: any[]; products: any[] }>(
        `/search?q=${encodeURIComponent(query.trim())}`
      );
      setSearchResults(data);
    } catch (error) {
      console.error('[ExploreScreen] Search failed:', error);
      setSearchResults({ shops: [], markets: [], products: [] });
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.trim().length < 2) {
      setSearchResults(null);
      setShowSearchResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(text);
    }, 300);
  }, [performSearch]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  function handleLogo() {
    switchToTab('Home');
  }

  function handleViewStores(marketId: string) {
    const m = markets.find((x) => x._id === marketId);
    if (m) {
      const location = `${m.city}, ${m.state}`;
      const coverImage = m.images?.find((img) => img.type === 'cover') ?? m.images?.[0];
      openMarketDetail({
        marketId: m._id,
        name: m.name,
        location,
        rating: m.ratingAverage ?? 4.5,
        description: m.description ?? '',
        imageUrl: coverImage?.url,
      });
    }
  }

  function renderCard({ item }: { item: Market }) {
    const location = `${item.city}, ${item.state}`;
    const imageUrl = item.images && item.images[0] ? item.images[0].url : null;
    return (
      <Pressable
        onPress={() => handleViewStores(item._id)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.cardImage}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.cardImageFill} resizeMode="cover" />
          ) : (
            <View style={styles.cardImagePlaceholder} />
          )}
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>
              {(item.ratingAverage ?? 4.5).toFixed(1)} ★
            </Text>
          </View>
        </View>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
          <Text style={styles.locationText}>{location}</Text>
        </View>
        <Text style={styles.cardDesc} numberOfLines={2}>
          {item.description}
        </Text>
        <Pressable
          onPress={() => handleViewStores(item._id)}
          style={({ pressed }) => [styles.viewStoresBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.viewStoresLabel}>View Stores</Text>
        </Pressable>
      </Pressable>
    );
  }

  const renderSearchResult = (item: any, type: 'shop' | 'market' | 'product', index: number) => {
    if (type === 'shop') {
      return (
        <Pressable
          key={`shop-${item._id}`}
          onPress={() => {
            setShowSearchResults(false);
            setSearchQuery('');
            openShopDetail({ shopId: item._id });
          }}
          style={styles.searchResultItem}
        >
          <Ionicons name="storefront" size={20} color={colors.primary} style={styles.searchResultIcon} />
          <View style={styles.searchResultContent}>
            <Text style={styles.searchResultName} numberOfLines={1}>{item.name}</Text>
            {item.description && (
              <Text style={styles.searchResultDesc} numberOfLines={1}>{item.description}</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>
      );
    }
    if (type === 'market') {
      return (
        <Pressable
          key={`market-${item._id}`}
          onPress={() => {
            setShowSearchResults(false);
            setSearchQuery('');
            openMarketDetail({
              marketId: item._id,
              name: item.name,
              location: `${item.city}, ${item.state}`,
              rating: item.ratingAverage || 4.5,
              description: item.description || '',
            });
          }}
          style={styles.searchResultItem}
        >
          <Ionicons name="location" size={20} color={colors.primary} style={styles.searchResultIcon} />
          <View style={styles.searchResultContent}>
            <Text style={styles.searchResultName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.searchResultDesc} numberOfLines={1}>{item.city}, {item.state}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>
      );
    }
    if (type === 'product') {
      return (
        <Pressable
          key={`product-${item._id}`}
          onPress={() => {
            if (item.shop?._id) {
              setShowSearchResults(false);
              setSearchQuery('');
              openShopDetail({ shopId: item.shop._id });
            }
          }}
          style={styles.searchResultItem}
        >
          <Ionicons name="cube" size={20} color={colors.primary} style={styles.searchResultIcon} />
          <View style={styles.searchResultContent}>
            <Text style={styles.searchResultName} numberOfLines={1}>{item.name}</Text>
            {item.shop && (
              <Text style={styles.searchResultDesc} numberOfLines={1}>
                {item.shop.name} · ₹{item.discountPrice || item.price}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>
      );
    }
    return null;
  };

  const totalSearchResults = searchResults
    ? searchResults.shops.length + searchResults.markets.length + searchResults.products.length
    : 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.header, searchFocused && styles.headerExpanded]}>
          {!searchFocused && (
            <Pressable onPress={handleLogo} style={({ pressed }) => [styles.logoRow, pressed && styles.pressed]}>
              <Image source={splashLogo} style={styles.logo} resizeMode="contain" />
              <Text style={styles.logoText} numberOfLines={1}>Bazaario</Text>
            </Pressable>
          )}
          <View style={[styles.searchBarContainer, searchFocused && { width: expandedWidth, flex: undefined }]}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder="Search..."
                placeholderTextColor={colors.mutedForeground}
                onFocus={() => {
                  setSearchFocused(true);
                  setShowSearchResults(true);
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setShowSearchResults(false);
                    setSearchFocused(false);
                  }, 200);
                }}
              />
              {searchFocused ? (
                <Pressable
                  onPress={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                    setShowSearchResults(false);
                    setSearchFocused(false);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.searchCloseText}>Cancel</Text>
                </Pressable>
              ) : searchQuery.length > 0 ? (
                <Pressable
                  onPress={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                    setShowSearchResults(false);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
            {showSearchResults && searchFocused && (
              <View style={[styles.searchResultsDropdown, { width: expandedWidth }]}>
                {searchLoading ? (
                  <View style={styles.searchResultsLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.searchResultsLoadingText}>Searching...</Text>
                  </View>
                ) : searchResults && totalSearchResults > 0 ? (
                  <ScrollView
                    style={styles.searchResultsScroll}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                  >
                    {searchResults.shops.length > 0 && (
                      <>
                        <View style={styles.searchSectionHeader}>
                          <Text style={styles.searchSectionTitle}>Shops</Text>
                        </View>
                        {searchResults.shops.map((s, idx) => renderSearchResult(s, 'shop', idx))}
                      </>
                    )}
                    {searchResults.markets.length > 0 && (
                      <>
                        {searchResults.shops.length > 0 && <View style={styles.searchSectionDivider} />}
                        <View style={styles.searchSectionHeader}>
                          <Text style={styles.searchSectionTitle}>Markets</Text>
                        </View>
                        {searchResults.markets.map((m, idx) => renderSearchResult(m, 'market', idx))}
                      </>
                    )}
                    {searchResults.products.length > 0 && (
                      <>
                        {(searchResults.shops.length > 0 || searchResults.markets.length > 0) && (
                          <View style={styles.searchSectionDivider} />
                        )}
                        <View style={styles.searchSectionHeader}>
                          <Text style={styles.searchSectionTitle}>Products</Text>
                        </View>
                        {searchResults.products.map((p, idx) => renderSearchResult(p, 'product', idx))}
                      </>
                    )}
                  </ScrollView>
                ) : searchQuery.length >= 2 ? (
                  <View style={styles.searchResultsEmpty}>
                    <Text style={styles.searchResultsEmptyText}>No results found</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
          {!searchFocused && (
            <View style={styles.headerRight}>
              <Pressable
                onPress={openConversations}
                style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]}
                hitSlop={8}
              >
                <Ionicons name="chatbubbles-outline" size={22} color={colors.foreground} />
                {totalUnread > 0 && (
                  <View style={styles.messageBadge}>
                    <Text style={styles.messageBadgeText}>
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </Text>
                  </View>
                )}
              </Pressable>
              <NotificationBell dropdownTop={insets.top + 56} />
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={markets}
        keyExtractor={(m) => m._id}
        numColumns={2}
        columnWrapperStyle={styles.cardRow}
        contentContainerStyle={[styles.listContent, { paddingTop: 8, paddingBottom: 100 + insets.bottom }]}
        ListHeaderComponent={
          <Text style={styles.title}>
            {loading ? 'Loading markets...' : 'Explore Markets'}
          </Text>
        }
        renderItem={renderCard}
        showsVerticalScrollIndicator={false}
      />
    </KeyboardAvoidingView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  pressed: { opacity: 0.85 },
  cardPressed: { opacity: 0.95 },
  btnPressed: { opacity: 0.9 },

  headerContainer: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    gap: 8,
  },
  headerExpanded: {
    justifyContent: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  searchCloseText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  logoText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: colors.primary, 
    fontFamily: 'Impact',
    maxWidth: 80,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    position: 'relative',
    padding: 4,
  },
  messageBadge: {
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
  messageBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.card,
  },

  listContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 16,
  },
  searchBarContainer: {
    flex: 1,
    position: 'relative',
    minWidth: 0,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: 12,
    height: 36,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.foreground,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
    minWidth: 0,
  },
  searchResultsDropdown: {
    position: 'absolute',
    top: 44,
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxHeight: 400,
    zIndex: 1001,
    overflow: 'hidden',
  },
  searchResultsScroll: {
    maxHeight: 400,
  },
  searchResultsLoading: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchResultsLoadingText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  searchResultsEmpty: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  searchResultsEmptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 56,
  },
  searchResultIcon: {
    flexShrink: 0,
  },
  searchResultContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    lineHeight: 20,
  },
  searchResultDesc: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  searchSectionHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  searchSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchSectionDivider: {
    height: 8,
    backgroundColor: colors.background,
  },

  cardRow: {
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },
  card: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: SHADOW_OFFSET,
    shadowOpacity: SHADOW_OPACITY,
    shadowRadius: SHADOW_RADIUS,
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    aspectRatio: IMAGE_ASPECT,
    backgroundColor: colors.muted,
    position: 'relative',
  },
  cardImagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.border,
  },
  cardImageFill: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  ratingText: { fontSize: 12, fontWeight: '600', color: colors.card },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 12,
    marginHorizontal: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginHorizontal: 12,
  },
  locationText: { fontSize: 13, color: colors.mutedForeground },
  cardDesc: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 6,
    marginHorizontal: 12,
    lineHeight: 18,
  },
  viewStoresBtn: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: colors.secondary,
    paddingVertical: 10,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  viewStoresLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
