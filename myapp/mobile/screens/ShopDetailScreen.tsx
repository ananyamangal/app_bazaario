import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';

import BackButton from '../components/BackButton';
import { type ShopDetailParams } from '../navigation/TabContext';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { apiGet, apiGetAuth, apiPostAuth, apiDeleteAuth } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAvailability, AvailabilityStatus } from '../context/AvailabilityContext';
import { useChat, type Conversation } from '../context/ChatContext';
import { useCall } from '../context/CallContext';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const LOGO_SIZE = 36;
const CAROUSEL_HEIGHT = 240;
const HORIZONTAL_PADDING = 16;
const BANNER_WIDTH = 280;
const BANNER_HEIGHT = 100;

const RATING_YELLOW = '#FEF3C7';
const SHADOW_OPACITY = 0.08;
const SHADOW_RADIUS = 8;
const SHADOW_OFFSET = { width: 0, height: 2 };
const CAROUSEL_AUTO_INTERVAL = 4000;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ShopReview = {
  id: string;
  name: string;
  rating: number;
  text: string;
  date?: string;
  images?: string[];
};

type ShopDetails = {
  _id: string;
  shopName?: string;
  name?: string;
  ratingAverage?: number;
  reviewCount?: number;
  categories?: string[];
  description?: string;
  banner?: string;
  images?: string[];
  banners?: { id: string; title: string }[];
  reviews?: ShopReview[];
  returnDays?: number | null;
  exchangeDays?: number | null;
};

type Product = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  discountPrice?: number;
  images: string[];
  isAvailable: boolean;
  stock?: number;
};

type Props = ShopDetailParams & { 
  onBack: () => void;
  onOpenChat?: (conversation: Conversation) => void;
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ShopDetailScreen({ shopId, onBack, onOpenChat }: Props) {
  const insets = useSafeAreaInsets();
  const width = Dimensions.get('window').width;
  const { addItem, isInCart, getItemQuantity, updateQuantity, totalItems, shopId: cartShopId } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { checkProductAvailability, requestAvailability, availabilityCache } = useAvailability();
  const { startConversation } = useChat();
  const { requestCall, isAgoraConfigured } = useCall();
  const { user } = useAuth();

  const [shop, setShop] = useState<ShopDetails | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savedCheckDone, setSavedCheckDone] = useState(false);
  const [savingShop, setSavingShop] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [shopReels, setShopReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [checkingAvailability, setCheckingAvailability] = useState<{ [productId: string]: boolean }>({});
  const [reviews, setReviews] = useState<ShopReview[]>([]);
  const carouselRef = useRef<ScrollView>(null);
  const carouselIndexRef = useRef(0);
  const bannerImage = shop?.banner;
  const shopImages = shop?.images && shop.images.length > 0 ? (shop.images as string[]).slice().reverse() : [];
  const slidesBase: (string | null)[] =
    (bannerImage ? [bannerImage] : []).concat(shopImages.length > 0 ? shopImages : []);
  const slides = slidesBase.length > 0 ? slidesBase : [null, null, null]; // Use banner/images or show 3 placeholders

  useEffect(() => {
    async function loadShop() {
      try {
        setLoading(true);
        const [shopData, productsData, reelsData, reviewsData] = await Promise.all([
          apiGet<ShopDetails>(`/shops/${shopId}`),
          apiGet<{ products: Product[] }>(`/shops/${shopId}/products`),
          apiGet<{ reels: any[] }>(`/shops/${shopId}/reels`).catch(() => ({ reels: [] })),
          apiGet<{ reviews: ShopReview[] }>(`/shops/${shopId}/reviews`).catch(() => ({ reviews: [] })),
        ]);
        setShop({ ...shopData, reviews: reviewsData.reviews || [] });
        setProducts(productsData.products || []);
        setShopReels(reelsData.reels || []);
        setReviews(reviewsData.reviews || []);
      } catch (e) {
        console.warn('Failed to load shop', e);
      } finally {
        setLoading(false);
      }
    }
    loadShop();
  }, [shopId]);

  // Check if shop is saved (when user is logged in)
  useEffect(() => {
    if (!shopId || !user) {
      setSavedCheckDone(true);
      setIsSaved(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGetAuth<{ saved: boolean }>(`/me/saved-shops/check/${shopId}`);
        if (!cancelled) {
          setIsSaved(res.saved);
        }
      } catch {
        if (!cancelled) setIsSaved(false);
      } finally {
        if (!cancelled) setSavedCheckDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [shopId, user]);

  async function handleToggleSaveShop() {
    if (!user) {
      Alert.alert('Sign in to save', 'Sign in to save shops and see them in your profile.');
      return;
    }
    setSavingShop(true);
    try {
      if (isSaved) {
        await apiDeleteAuth(`/me/saved-shops/${shopId}`);
        setIsSaved(false);
      } else {
        await apiPostAuth(`/me/saved-shops/${shopId}`);
        setIsSaved(true);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not update saved shop.');
    } finally {
      setSavingShop(false);
    }
  }

  // Check availability before adding to cart
  async function handleCheckAvailability(product: Product) {
    setCheckingAvailability(prev => ({ ...prev, [product._id]: true }));
    
    try {
      // First check if already approved
      const status = await checkProductAvailability(product._id);
      
      if (status.canAddToCart) {
        // Already approved, can add to cart
        handleAddToCart(product);
      } else if (status.status === 'pending') {
        Alert.alert(
          'Request Pending',
          'You already have a pending request for this product. Please wait for the seller to respond.',
          [{ text: 'OK' }]
        );
      } else {
        // Need to request availability
        Alert.alert(
          'Check Availability',
          `Would you like to ask the seller if "${product.name}" is available?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Ask Seller',
              onPress: async () => {
                const request = await requestAvailability(product._id, 1);
                if (request) {
                  Alert.alert(
                    'Request Sent',
                    'The seller has been notified. You\'ll receive a notification when they respond (within 15 minutes).',
                    [{ text: 'OK' }]
                  );
                } else {
                  Alert.alert('Error', 'Failed to send request. Please try again.');
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Availability check error:', error);
      Alert.alert('Error', 'Failed to check availability. Please try again.');
    } finally {
      setCheckingAvailability(prev => ({ ...prev, [product._id]: false }));
    }
  }

  function handleAddToCart(product: Product) {
    const shopName = shop?.name || shop?.shopName || 'Shop';
    
    // Warn if cart has items from different shop
    if (cartShopId && cartShopId !== shopId) {
      Alert.alert(
        'Replace Cart?',
        'Your cart has items from another shop. Adding this will clear your current cart.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: () => {
              addItem({
                productId: product._id,
                shopId,
                shopName,
                name: product.name,
                price: product.discountPrice || product.price,
                image: product.images?.[0],
              });
            },
          },
        ]
      );
      return;
    }

    addItem({
      productId: product._id,
      shopId,
      shopName,
      name: product.name,
      price: product.discountPrice || product.price,
      image: product.images?.[0],
    });
  }

  function handleIncrement(productId: string) {
    const qty = getItemQuantity(productId);
    updateQuantity(productId, qty + 1);
  }

  function handleDecrement(productId: string) {
    const qty = getItemQuantity(productId);
    updateQuantity(productId, qty - 1);
  }

  function handleToggleWishlist(product: Product) {
    const shopName = shop?.name || shop?.shopName || 'Shop';
    
    if (isInWishlist(product._id)) {
      removeFromWishlist(product._id);
    } else {
      addToWishlist({
        id: product._id,
        type: 'product',
        name: product.name,
        image: product.images?.[0],
        price: product.discountPrice || product.price,
        shopId: shopId,
        shopName: shopName,
      });
    }
  }

  useEffect(() => {
    const id = setInterval(() => {
      const next = (carouselIndexRef.current + 1) % slides.length;
      carouselRef.current?.scrollTo({ x: next * width, animated: true });
    }, CAROUSEL_AUTO_INTERVAL);
    return () => clearInterval(id);
  }, [slides.length, width]);

  function handleScrollEnd(e: { nativeEvent: { contentOffset: { x: number } } }) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setCarouselIndex(i);
    carouselIndexRef.current = i;
  }

  async function handleChat() {
    if (!shop) return;
    try {
      const conversation = await startConversation(shopId);
      if (conversation) {
        // If onOpenChat is provided, open the chat directly
        if (onOpenChat) {
          onOpenChat(conversation);
        } else {
          // Fallback to alert if no handler provided
          Alert.alert(
            'Chat Started',
            `You can now chat with ${shop.shopName ?? shop.name}. Go to Profile > Messages to view your conversations.`
          );
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not start chat');
    }
  }

  function handleVideoCall() {
    if (!shop) return;
    if (!isAgoraConfigured) {
      Alert.alert('Not Available', 'Video calling is not configured on this server.');
      return;
    }

    const shopName = shop.shopName ?? shop.name ?? 'Shop';

    // Step 1: Confirm user wants to call
    Alert.alert(
      'Are you sure you want to call?',
      '',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          style: 'default',
          onPress: () => {
            // Step 2: Privacy notice before starting the call
            Alert.alert(
              'Before you call',
              'Your camera will be off and your phone number will not be shared. You may switch the camera on if you want to.',
              [
                { text: 'Back', style: 'cancel' },
                {
                  text: 'Proceed',
                  style: 'default',
                  onPress: () => {
                    requestCall(shopId, shopName, 'video');
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }

  // Show loading state
  if (loading || !shop) {
    return (
      <View style={styles.container}>
        <View style={[styles.carouselWrap, { paddingTop: insets.top, height: CAROUSEL_HEIGHT + insets.top }]}>
          <View style={styles.backBtnWrap}>
            <BackButton onPress={onBack} variant="floating" iconColor={colors.foreground} />
          </View>
        </View>
        <Text style={{ padding: 20, color: colors.mutedForeground }}>Loading shop details...</Text>
      </View>
    );
  }

  const shopName = shop.shopName ?? shop.name ?? 'Shop';
  const categories = shop.categories ?? [];
  const banners = shop.banners ?? [];
  const promotion = (shop as any).promotion;
  const shopReviews = reviews.length > 0 ? reviews : (shop.reviews ?? []);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Carousel */}
        <View style={[styles.carouselWrap, { paddingTop: insets.top }]}>
          <ScrollView
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            decelerationRate="fast"
          >
            {slides.map((imageUrl, i) => (
              <View key={i} style={[styles.carouselSlide, { width, height: CAROUSEL_HEIGHT }]}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.carouselImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.carouselImage, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))}
          </ScrollView>
          <View style={styles.dots}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === carouselIndex && styles.dotActive]}
              />
            ))}
          </View>
          <View style={styles.backBtnWrap}>
            <BackButton onPress={onBack} variant="floating" iconColor={colors.foreground} />
          </View>
        </View>

        {/* Shop Info */}
        <View style={styles.section}>
          <View style={styles.shopNameRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.shopName}>{shopName}</Text>
              {promotion?.active && (
                <View style={styles.promoBadge}>
                  <Text style={styles.promoBadgeText}>
                    {promotion.discountPercent
                      ? `${promotion.discountPercent}% OFF`
                      : promotion.title || 'Offer available'}
                  </Text>
                </View>
              )}
            </View>
            {user && (
              <Pressable
                onPress={handleToggleSaveShop}
                disabled={savingShop}
                style={({ pressed }) => [styles.saveShopBtn, pressed && styles.btnPressed]}
                hitSlop={8}
              >
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={24}
                  color={isSaved ? colors.primary : colors.mutedForeground}
                />
              </Pressable>
            )}
          </View>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingValue}>⭐ {(shop.ratingAverage ?? 4.5).toFixed(1)}</Text>
            <Text style={styles.reviewCount}>({shop.reviewCount ?? 0} reviews)</Text>
          </View>
          <View style={styles.chips}>
            {categories.map((c: string) => (
              <View key={c} style={styles.chip}>
                <Text style={styles.chipText}>{c}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.desc}>{shop.description ?? ''}</Text>
        </View>

        {/* CTAs */}
        <View style={styles.ctaRow}>
          <Pressable
            onPress={handleChat}
            style={({ pressed }) => [styles.chatBtn, pressed && styles.btnPressed]}
          >
            <Ionicons name="chatbubble-outline" size={20} color={colors.card} />
            <Text style={styles.chatBtnLabel}>Chat with shop</Text>
          </Pressable>
          <Pressable
            onPress={handleVideoCall}
            style={({ pressed }) => [styles.videoBtn, pressed && styles.btnPressed]}
          >
            <Ionicons name="videocam" size={20} color={colors.primary} />
            <Text style={styles.videoBtnLabel}>Video Call</Text>
          </Pressable>
        </View>

        {/* Shop Reels Section — only show when there are reels */}
        {shopReels.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Shop Reels</Text>
            <FlatList
              data={shopReels}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) => `reel-${index}`}
              contentContainerStyle={styles.reelsContainer}
              renderItem={({ item }) => (
                <View style={styles.reelCard}>
                  <Video
                    source={{ uri: item.videoUrl }}
                    style={styles.reelVideo}
                    resizeMode={ResizeMode.COVER}
                    isLooping
                    shouldPlay={false}
                    isMuted
                    useNativeControls
                  />
                  <View style={styles.reelOverlay}>
                    <View style={styles.reelStats}>
                      <View style={styles.reelStat}>
                        <Ionicons name="heart-outline" size={16} color={colors.card} />
                        <Text style={styles.reelStatText}>0</Text>
                      </View>
                      <View style={styles.reelStat}>
                        <Ionicons name="chatbubble-outline" size={16} color={colors.card} />
                        <Text style={styles.reelStatText}>0</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            />
          </>
        )}

        {/* Offers & Promotions — right below reels */}
        {promotion?.active && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Offers & Promotions</Text>
            <View style={styles.promoCard}>
              <View style={styles.promoHeader}>
                <Text style={styles.promoTitle}>{promotion.title || 'Special Offer'}</Text>
                {promotion.discountPercent && (
                  <Text style={styles.promoDiscount}>{promotion.discountPercent}% OFF</Text>
                )}
              </View>
              {promotion.description ? (
                <Text style={styles.promoDescription}>{promotion.description}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Return & Exchange Policy bar — right below reels / offers */}
        <View style={styles.policyBar}>
          <View style={styles.policyItem}>
            <View style={styles.policyIconWrap}>
              <Ionicons name="arrow-undo-outline" size={22} color={colors.primary} />
            </View>
            <Text style={styles.policyLabel} numberOfLines={2}>
              {shop?.returnDays != null ? `${shop.returnDays} days Return` : '— days Return'}
            </Text>
          </View>
          <View style={styles.policyItem}>
            <View style={styles.policyIconWrap}>
              <Ionicons name="repeat-outline" size={22} color={colors.primary} />
            </View>
            <Text style={styles.policyLabel} numberOfLines={2}>
              {shop?.exchangeDays != null ? `${shop.exchangeDays} days Exchange` : '— days Exchange'}
            </Text>
          </View>
          <View style={styles.policyItem}>
            <View style={styles.policyIconWrap}>
              <Ionicons name="bicycle-outline" size={22} color={colors.primary} />
            </View>
            <Text style={styles.policyLabel} numberOfLines={2}>
              Delivered by{'\n'}Bazaario
            </Text>
          </View>
        </View>

        {/* Products Section — only show when there are products */}
        {products.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Products</Text>
            <View style={styles.productsGrid}>
              {products.map((product) => {
                const inCart = isInCart(product._id);
                const quantity = getItemQuantity(product._id);
                const inWishlist = isInWishlist(product._id);
                const isChecking = checkingAvailability[product._id];
                const availStatus = availabilityCache[product._id];
                const canAddToCart = availStatus?.canAddToCart;
                const isPending = availStatus?.status === 'pending';
                const isDeclined = availStatus?.status === 'declined';
                
                // Render the appropriate button based on availability status
                const renderActionButton = () => {
                  if (!product.isAvailable) {
                    return (
                      <View style={styles.unavailableBtn}>
                        <Text style={styles.unavailableBtnText}>Unavailable</Text>
                      </View>
                    );
                  }
                  
                  // If already in cart, show quantity controls
                  if (inCart) {
                    return (
                      <View style={styles.quantityControl}>
                        <Pressable 
                          onPress={() => handleDecrement(product._id)} 
                          style={styles.qtyBtn}
                        >
                          <Ionicons name="remove" size={18} color={colors.primary} />
                        </Pressable>
                        <Text style={styles.qtyText}>{quantity}</Text>
                        <Pressable 
                          onPress={() => handleIncrement(product._id)} 
                          style={styles.qtyBtn}
                        >
                          <Ionicons name="add" size={18} color={colors.primary} />
                        </Pressable>
                      </View>
                    );
                  }
                  
                  // If approved, show Add to Cart
                  if (canAddToCart) {
                    return (
                      <Pressable 
                        onPress={() => handleAddToCart(product)} 
                        style={({ pressed }) => [styles.addBtn, pressed && styles.btnPressed]}
                      >
                        <Ionicons name="add" size={16} color={colors.card} />
                        <Text style={styles.addBtnText}>Add to Cart</Text>
                      </Pressable>
                    );
                  }
                  
                  // If pending, show waiting state
                  if (isPending) {
                    return (
                      <View style={styles.pendingBtn}>
                        <Ionicons name="time-outline" size={16} color={colors.primary} />
                        <Text style={styles.pendingBtnText}>Waiting...</Text>
                      </View>
                    );
                  }
                  
                  // If declined, show declined state with retry option
                  if (isDeclined) {
                    return (
                      <Pressable 
                        onPress={() => handleCheckAvailability(product)} 
                        style={({ pressed }) => [styles.declinedBtn, pressed && styles.btnPressed]}
                        disabled={isChecking}
                      >
                        <Ionicons name="close-circle-outline" size={16} color={colors.destructive} />
                        <Text style={styles.declinedBtnText}>Not Available</Text>
                      </Pressable>
                    );
                  }
                  
                  // Default: Show Check Availability button
                  return (
                    <Pressable 
                      onPress={() => handleCheckAvailability(product)} 
                      style={({ pressed }) => [styles.checkAvailBtn, pressed && styles.btnPressed]}
                      disabled={isChecking}
                    >
                      {isChecking ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
                          <Text style={styles.checkAvailBtnText}>Check Availability</Text>
                        </>
                      )}
                    </Pressable>
                  );
                };
                
                return (
                  <View key={product._id} style={styles.productCard}>
                    <View style={styles.productImageWrap}>
                      {product.images?.[0] ? (
                        <Image 
                          source={{ uri: product.images[0] }} 
                          style={styles.productImage} 
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.productImage, { backgroundColor: colors.muted }]}>
                          <Ionicons name="image-outline" size={32} color={colors.mutedForeground} />
                        </View>
                      )}
                      {!product.isAvailable && (
                        <View style={styles.outOfStock}>
                          <Text style={styles.outOfStockText}>Out of Stock</Text>
                        </View>
                      )}
                      {isPending && (
                        <View style={styles.pendingBadge}>
                          <Ionicons name="time" size={12} color={colors.card} />
                        </View>
                      )}
                      {canAddToCart && !inCart && (
                        <View style={styles.approvedBadge}>
                          <Ionicons name="checkmark-circle" size={12} color={colors.card} />
                        </View>
                      )}
                      <Pressable 
                        style={styles.wishlistBtn} 
                        onPress={() => handleToggleWishlist(product)}
                        hitSlop={8}
                      >
                        <Ionicons 
                          name={inWishlist ? "heart" : "heart-outline"} 
                          size={20} 
                          color={inWishlist ? colors.primary : colors.card} 
                        />
                      </Pressable>
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                      {product.description ? (
                        <Text style={styles.productDescription} numberOfLines={2}>{product.description}</Text>
                      ) : null}
                      {renderActionButton()}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Reviews</Text>

          {shopReviews.length === 0 ? (
            <Text style={styles.noReviewsText}>No reviews yet.</Text>
          ) : (
            shopReviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <Text style={styles.reviewName}>{r.name}</Text>
                <View style={styles.reviewMeta}>
                  <Text style={styles.reviewStars}>⭐ {r.rating.toFixed(1)}</Text>
                  {r.date && (
                    <Text style={styles.reviewDate}>
                      {new Date(r.date).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <Text style={styles.reviewText}>{r.text}</Text>
                {r.images && r.images.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.reviewImagesRow}
                  >
                    {r.images.map((url, idx) => (
                      <Image key={idx} source={{ uri: url }} style={styles.reviewImage} />
                    ))}
                  </ScrollView>
                )}
              </View>
            ))
          )}
        </View>
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
  btnPressed: { opacity: 0.9 },

  carouselWrap: {
    marginHorizontal: -HORIZONTAL_PADDING,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  carouselSlide: { backgroundColor: colors.muted },
  carouselImage: {
    flex: 1,
    backgroundColor: colors.border,
  },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  dotActive: {
    backgroundColor: colors.card,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  backBtnWrap: {
    position: 'absolute',
    top: spacing.md,
    left: HORIZONTAL_PADDING,
  },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
  shopNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  shopName: { fontSize: 24, fontWeight: '700', color: colors.foreground, flex: 1 },
  saveShopBtn: { padding: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  ratingValue: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  reviewCount: { fontSize: 14, color: colors.mutedForeground },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.xxl,
  },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.primary },
  promoBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.xxl,
    backgroundColor: colors.secondary,
  },
  promoBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  desc: { fontSize: 15, color: colors.foreground, lineHeight: 24, fontWeight: '500' },

  ctaRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  chatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  chatBtnLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  videoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  videoBtnLabel: { fontSize: 15, fontWeight: '600', color: colors.primary },

  promoCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.secondary,
  },
  promoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  promoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  promoDiscount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  promoDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
  },

  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: SHADOW_OFFSET,
    shadowOpacity: SHADOW_OPACITY,
    shadowRadius: SHADOW_RADIUS,
    elevation: 2,
  },
  reviewName: { fontSize: 15, fontWeight: '600', color: colors.foreground, marginBottom: 4 },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  reviewStars: { fontSize: 13 },
  reviewDate: { fontSize: 12, color: colors.mutedForeground },
  reviewText: { fontSize: 14, color: colors.foreground, lineHeight: 20 },
  noReviewsText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  policyBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  policyItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  policyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  policyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
  },
  reviewImagesRow: {
    marginTop: 8,
  },
  reviewImage: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    marginRight: 8,
    backgroundColor: colors.muted,
  },

  // Products Grid
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  productCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: SHADOW_OFFSET,
    shadowOpacity: SHADOW_OPACITY,
    shadowRadius: SHADOW_RADIUS,
    elevation: 2,
  },
  productImageWrap: {
    width: '100%',
    height: 120,
    backgroundColor: colors.muted,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: '600',
  },
  wishlistBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 8,
    lineHeight: 16,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 8,
  },
  addBtnText: {
    color: colors.card,
    fontSize: 14,
    fontWeight: '600',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  unavailableBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingVertical: 8,
  },
  unavailableBtnText: {
    color: colors.mutedForeground,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyProducts: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyProductsText: {
    fontSize: 15,
    color: colors.mutedForeground,
  },
  // Availability check buttons
  checkAvailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  checkAvailBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  pendingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    paddingVertical: 8,
  },
  pendingBtnText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
  },
  declinedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: radius.md,
    paddingVertical: 8,
  },
  declinedBtnText: {
    color: colors.destructive,
    fontSize: 12,
    fontWeight: '600',
  },
  pendingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelsContainer: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 16,
  },
  reelCard: {
    width: 200,
    height: 300,
    marginRight: 12,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    position: 'relative',
  },
  reelVideo: {
    width: '100%',
    height: '100%',
  },
  reelOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  reelStats: {
    flexDirection: 'row',
    gap: 16,
  },
  reelStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reelStatText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.card,
  },
});
