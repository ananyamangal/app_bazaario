import React from 'react';
import {
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
import { useWishlist, WishlistItem } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
const PAD = 16;

type Props = {
  onBack: () => void;
  onViewShop?: (shopId: string) => void;
};

export default function WishlistScreen({ onBack, onViewShop }: Props) {
  const insets = useSafeAreaInsets();
  const { items, removeFromWishlist, clearWishlist } = useWishlist();
  const { addItem } = useCart();

  const products = items.filter(i => i.type === 'product');
  const shops = items.filter(i => i.type === 'shop');

  function handleRemove(id: string) {
    removeFromWishlist(id);
  }

  function handleClearAll() {
    Alert.alert(
      'Clear Wishlist',
      'Are you sure you want to remove all items from your wishlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: clearWishlist,
        },
      ]
    );
  }

  function handleAddToCart(item: WishlistItem) {
    if (!item.shopId) return;
    
    addItem({
      productId: item.id,
      shopId: item.shopId,
      shopName: item.shopName || 'Shop',
      name: item.name,
      price: item.price ?? 0,
      image: item.image,
    });
    
    Alert.alert('Added to Cart', `${item.name} has been added to your cart.`);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>Wishlist</Text>
        {items.length > 0 ? (
          <Pressable onPress={handleClearAll} hitSlop={8}>
            <Text style={styles.clearText}>Clear All</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="heart-outline" size={72} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptyText}>Save items you like to find them easily later</Text>
          </View>
        ) : (
          <>
            {/* Products Section */}
            {products.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Products ({products.length})</Text>
                {products.map((item) => (
                  <View key={item.id} style={[styles.itemCard, SHADOW]}>
                    <View style={styles.itemRow}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.itemImage} />
                      ) : (
                        <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                          <Ionicons name="cube-outline" size={24} color={colors.mutedForeground} />
                        </View>
                      )}
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                        {item.shopName && (
                          <Text style={styles.itemShop}>{item.shopName}</Text>
                        )}
                      </View>
                      <Pressable onPress={() => handleRemove(item.id)} style={styles.removeBtn} hitSlop={8}>
                        <Ionicons name="heart" size={24} color={colors.primary} />
                      </Pressable>
                    </View>
                    <View style={styles.itemActions}>
                      <Pressable
                        style={({ pressed }) => [styles.addToCartBtn, pressed && { opacity: 0.9 }]}
                        onPress={() => handleAddToCart(item)}
                      >
                        <Ionicons name="cart-outline" size={18} color={colors.card} />
                        <Text style={styles.addToCartText}>Add to Cart</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Shops Section */}
            {shops.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Shops ({shops.length})</Text>
                {shops.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.shopCard, SHADOW]}
                    onPress={() => onViewShop?.(item.id)}
                  >
                    <View style={styles.shopRow}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.shopImage} />
                      ) : (
                        <View style={[styles.shopImage, styles.itemImagePlaceholder]}>
                          <Ionicons name="storefront-outline" size={28} color={colors.mutedForeground} />
                        </View>
                      )}
                      <View style={styles.shopInfo}>
                        <Text style={styles.shopName}>{item.name}</Text>
                        {item.rating && (
                          <View style={styles.ratingRow}>
                            <Ionicons name="star" size={14} color="#FCD34D" />
                            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.shopActions}>
                        <Pressable onPress={() => handleRemove(item.id)} hitSlop={8}>
                          <Ionicons name="heart" size={24} color={colors.primary} />
                        </Pressable>
                        <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, paddingBottom: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 26, fontWeight: '700', color: colors.foreground },
  clearText: { fontSize: 15, fontWeight: '600', color: colors.destructive },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: PAD, paddingTop: 16 },
  emptyWrap: { paddingVertical: 80, alignItems: 'center', gap: 20 },
  emptyIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 24, fontWeight: '700', color: colors.foreground },
  emptyText: { fontSize: 17, color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: 32, lineHeight: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 12, marginTop: 8 },
  itemCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: PAD, marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemImage: { width: 80, height: 80, borderRadius: radius.md, marginRight: 12 },
  itemImagePlaceholder: { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.foreground, marginBottom: 4 },
  itemShop: { fontSize: 13, color: colors.mutedForeground, marginBottom: 4 },
  itemPrice: { fontSize: 16, fontWeight: '700', color: colors.primary },
  removeBtn: { padding: 4 },
  itemActions: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  addToCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  addToCartText: { fontSize: 14, fontWeight: '600', color: colors.card },
  shopCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: PAD, marginBottom: 12 },
  shopRow: { flexDirection: 'row', alignItems: 'center' },
  shopImage: { width: 60, height: 60, borderRadius: radius.md, marginRight: 12 },
  shopInfo: { flex: 1 },
  shopName: { fontSize: 16, fontWeight: '600', color: colors.foreground, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, color: colors.mutedForeground },
  shopActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
