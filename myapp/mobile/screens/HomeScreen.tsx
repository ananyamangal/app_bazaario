import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  FlatList,
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
const HERO_HEIGHT = 200;
const MARKET_CARD_WIDTH = 160;
const MARKET_CARD_HEIGHT = 120;
const CATEGORY_SIZE = 72;
const STORE_IMAGE_SIZE = 64;

const HORIZONTAL_PADDING = 16;
const SECTION_GAP = 24;
const CARD_GAP = 12;

const SHADOW_OPACITY = 0.08;
const SHADOW_RADIUS = 8;
const SHADOW_OFFSET = { width: 0, height: 2 };

const HERO_BG = '#7D6E5C';

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

type Category = {
  _id: string;
  name: string;
  icon?: string;
};

type Shop = {
  _id: string;
  name?: string;
  shopName?: string;
  description?: string;
  ratingAverage?: number;
  promotion?: {
    title?: string | null;
    discountPercent?: number | null;
    active?: boolean;
  };
  images?: string[];
};

// Icon mapping for categories
const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Apparel': 'shirt-outline',
  'Jewelry': 'diamond-outline',
  'Footwear': 'walk-outline',
  'Suits': 'business-outline',
  'Home Decor': 'home-outline',
  'Casual Wear': 'body-outline',
  'Lehenga': 'flower-outline',
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function HomeScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { switchToTab, openMarketDetail, openCategoryShops, openShopDetail, openConversations, openSearchResults } = useTabNavigator();
  const { totalUnread } = useChat();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    shops: any[];
    markets: any[];
    products: any[];
  } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const marketScrollRef = useRef<ScrollView>(null);
  const marketScrollIndexRef = useRef(0);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const expandedWidth = screenWidth * 0.9;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [marketsData, categoriesData, shopsData] = await Promise.all([
          apiGet<Market[]>('/markets'),
          apiGet<Category[]>('/categories'),
          apiGet<Shop[]>('/shops'),
        ]);
        setMarkets(marketsData.slice(0, 5)); // Show up to 5 markets
        setCategories(categoriesData);
        setShops(shopsData.slice(0, 5)); // Show up to 5 shops
      } catch (e) {
        console.warn('Failed to load home data', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Auto-scroll markets horizontally
  useEffect(() => {
    if (markets.length === 0) return;
    
    const scrollInterval = setInterval(() => {
      const nextIndex = (marketScrollIndexRef.current + 1) % markets.length;
      const scrollX = nextIndex * (MARKET_CARD_WIDTH + CARD_GAP);
      
      marketScrollRef.current?.scrollTo({ x: scrollX, animated: true });
      marketScrollIndexRef.current = nextIndex;
    }, 3000); // Scroll every 3 seconds

    return () => clearInterval(scrollInterval);
  }, [markets.length]);

  function handleLogo() {
    // scroll to top or home action
  }

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
      console.error('[HomeScreen] Search failed:', error);
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

  function handleStartExploring() {
    switchToTab('Explore');
  }

  function handleViewAllMarkets() {
    switchToTab('Explore');
  }

  function handleMarketCard(market: Market) {
    const location = `${market.city}, ${market.state}`;
    openMarketDetail({
      marketId: market._id,
      name: market.name,
      location,
      rating: market.ratingAverage ?? 4.5,
      description: market.description ?? '',
    });
  }

  function handleCategory(category: Category) {
    openCategoryShops({ categoryId: category._id, categoryLabel: category.name });
  }

  function handleVisitStore(shop: Shop) {
    openShopDetail({ shopId: shop._id });
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
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.header, searchFocused && styles.headerExpanded]}>
          <>
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
                  if (searchQuery.length >= 2 && searchResults) setShowSearchResults(true);
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
          </>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 8, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* Hero */}
        <Pressable onPress={handleStartExploring} style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}>
          <Image
            source={{ uri: 'https://res.cloudinary.com/dc2z9g4ld/image/upload/v1769690526/Screenshot_2026-01-29_at_6.11.55_PM_losg19.png' }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
          <Text style={styles.heroHeading}>Shop from Offline Stores</Text>
          <Text style={styles.heroSub}>Original prices, authentic goods.</Text>
          <Pressable onPress={handleStartExploring} style={({ pressed: p }) => [styles.heroCta, p && styles.ctaPressed]}>
            <Text style={styles.heroCtaLabel}>Start Exploring</Text>
          </Pressable>
        </Pressable>

        {/* Popular Markets */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {loading ? 'Loading...' : 'Popular Markets'}
            </Text>
            <Pressable onPress={handleViewAllMarkets} hitSlop={8}>
              <Text style={styles.viewAll}>View All →</Text>
            </Pressable>
          </View>
          <ScrollView 
            ref={marketScrollRef}
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.marketScroll}
            pagingEnabled={false}
            decelerationRate="fast"
            snapToInterval={MARKET_CARD_WIDTH + CARD_GAP}
            snapToAlignment="start"
          >
            {markets.map((m) => {
              const imageUrl = m.images && m.images[0] ? m.images[0].url : null;
              console.log('[HomeScreen] Market:', m.name, 'imageUrl:', imageUrl);
              return (
                <Pressable key={m._id} onPress={() => handleMarketCard(m)} style={({ pressed }) => [styles.marketCard, pressed && styles.cardPressed]}>
                  {imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={[styles.marketCardImage, { width: '100%', height: '100%' }]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.marketCardImage} />
                  )}
                  <View style={styles.marketCardOverlay} />
                  <Text style={styles.marketCardName}>{m.name}</Text>
                  <Text style={styles.marketCardRating}>⭐ {(m.ratingAverage ?? 4.5).toFixed(1)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Shop by Category */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.shopByCategoryTitle]}>Shop by Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {categories.map((c) => (
              <Pressable key={c._id} onPress={() => handleCategory(c)} style={({ pressed }) => [styles.categoryItem, pressed && styles.pressed]}>
                <View style={styles.categoryCircle}>
                  <Ionicons name={CATEGORY_ICONS[c.name] ?? 'pricetag-outline'} size={28} color={colors.primary} />
                </View>
                <Text style={styles.categoryLabel}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Top Stores */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Stores</Text>
          {shops.map((s) => (
            <View key={s._id} style={styles.storeCard}>
              {s.images && s.images[0] ? (
                <Image source={{ uri: s.images[0] }} style={styles.storeImage} resizeMode="cover" />
              ) : (
                <View style={styles.storeImage} />
              )}
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>{s.shopName ?? s.name ?? 'Shop'}</Text>
                {s.promotion?.active && (
                  <View style={styles.storePromoBadge}>
                    <Text style={styles.storePromoText}>
                      {s.promotion.discountPercent
                        ? `${s.promotion.discountPercent}% OFF`
                        : s.promotion.title || 'Offer'}
                    </Text>
                  </View>
                )}
                <Text style={styles.storeDesc}>{s.description ?? ''}</Text>
                <Text style={styles.storeRating}>⭐ Rating {(s.ratingAverage ?? 4.5).toFixed(1)}</Text>
              </View>
              <Pressable onPress={() => handleVisitStore(s)} style={({ pressed }) => [styles.visitBtn, pressed && styles.ctaPressed]}>
                <Ionicons name="videocam-outline" size={14} color={colors.card} />
                <Text style={styles.visitBtnLabel}>Visit</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView >
    </View >
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  logo: { width: 28, height: 28 },
  logoText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: colors.foreground, 
    fontFamily: 'Impact',
    maxWidth: 80,
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
  iconBtn: { position: 'relative', padding: 4 },

  hero: {
    height: HERO_HEIGHT,
    borderRadius: radius.xl,
    backgroundColor: HERO_BG,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 20,
    marginBottom: SECTION_GAP,
  },
  heroPressed: { opacity: 0.98 },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.card,
    marginBottom: 4,
  },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 14 },
  heroCta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: SHADOW_OFFSET,
    shadowOpacity: SHADOW_OPACITY,
    shadowRadius: SHADOW_RADIUS,
    elevation: 2,
  },
  ctaPressed: { opacity: 0.9 },
  heroCtaLabel: { color: colors.card, fontSize: 15, fontWeight: '600' },

  section: { marginBottom: SECTION_GAP },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  shopByCategoryTitle: { paddingBottom: 8 },
  viewAll: { fontSize: 14, fontWeight: '600', color: colors.primary },

  marketScroll: { gap: CARD_GAP, paddingRight: HORIZONTAL_PADDING },
  marketCard: {
    width: MARKET_CARD_WIDTH,
    height: MARKET_CARD_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  cardPressed: { opacity: 0.9 },
  marketCardImage: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.border },
  marketCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  marketCardName: {
    position: 'absolute',
    bottom: 32,
    left: 12,
    right: 12,
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
  },
  marketCardRating: { position: 'absolute', bottom: 10, left: 12, fontSize: 12, color: colors.card },

  categoryScroll: { gap: 16, paddingRight: HORIZONTAL_PADDING },
  categoryRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  categoryItem: { alignItems: 'center' },
  categoryCircle: {
    width: CATEGORY_SIZE,
    height: CATEGORY_SIZE,
    borderRadius: CATEGORY_SIZE / 2,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryLabel: { fontSize: 13, fontWeight: '500', color: colors.foreground },

  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: CARD_GAP,
    shadowColor: '#000',
    shadowOffset: SHADOW_OFFSET,
    shadowOpacity: SHADOW_OPACITY,
    shadowRadius: SHADOW_RADIUS,
    elevation: 2,
  },
  storeImage: {
    width: STORE_IMAGE_SIZE,
    height: STORE_IMAGE_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    marginRight: 12,
  },
  storeInfo: { flex: 1 },
  storeName: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 2 },
  storePromoBadge: {
    alignSelf: 'flex-start',
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xxl,
    backgroundColor: colors.secondary,
  },
  storePromoText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  storeDesc: { fontSize: 13, color: colors.mutedForeground, marginBottom: 4 },
  storeRating: { fontSize: 12, color: colors.mutedForeground },
  visitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.lg,
  },
  visitBtnLabel: { color: colors.card, fontSize: 13, fontWeight: '600' },
});
