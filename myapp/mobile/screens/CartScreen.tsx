import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import StepIndicator from '../components/StepIndicator';
import { useCheckout } from '../context/CheckoutContext';
import { useTabNavigator } from '../navigation/TabContext';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
const PAD = 16;

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { switchToTab } = useTabNavigator();
  const { items, updateQty, removeItem, subtotal, platformFee, discount, tax, total } = useCheckout();

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="cart-outline" size={64} color={colors.mutedForeground} />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>Add items from shops to get started.</Text>
        <Pressable onPress={() => switchToTab('Home')} style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.emptyBtnLabel}>Continue shopping</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <StepIndicator current={1} total={6} />
        <Text style={styles.title}>Checkout</Text>

        {items.map((i) => (
          <View key={i.id} style={[styles.itemCard, SHADOW]}>
            <View style={styles.itemHeader}>
              <Text style={styles.shopName}>{i.shopName}</Text>
              <Pressable onPress={() => removeItem(i.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={colors.destructive} />
              </Pressable>
            </View>
            <Text style={styles.itemName}>{i.name}</Text>
            <View style={styles.itemRow}>
              <View style={styles.qtyWrap}>
                <Pressable onPress={() => updateQty(i.id, Math.max(1, i.qty - 1))} style={styles.qtyBtn}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </Pressable>
                <Text style={styles.qtyNum}>{i.qty}</Text>
                <Pressable onPress={() => updateQty(i.id, i.qty + 1)} style={styles.qtyBtn}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.itemPrice}>{fmt(i.price * i.qty)}</Text>
            </View>
          </View>
        ))}

        <View style={[styles.summaryCard, SHADOW]}>
          <Row label="Subtotal" value={fmt(subtotal)} />
          <Row label="Platform fee" value={fmt(platformFee)} />
          {discount > 0 && <Row label="Discount" value={'-' + fmt(discount)} highlight />}
          <Row label="Taxes" value={fmt(tax)} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{fmt(total)}</Text>
          </View>
        </View>

        <View style={styles.trustRow}>
          <Ionicons name="shield-checkmark" size={16} color={colors.success} />
          <Text style={styles.trustText}>Secure payment · 100% safe</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable
          onPress={() => navigation.navigate('CheckoutAddress' as never)}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaLabel}>Proceed to Checkout</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, highlight && styles.summaryHighlight]}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && styles.summaryHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: PAD },
  title: { fontSize: 22, fontWeight: '700', color: colors.foreground, marginTop: 12, marginBottom: 16 },
  itemCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: PAD, marginBottom: 12 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  shopName: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground },
  itemName: { fontSize: 16, fontWeight: '600', color: colors.foreground, marginBottom: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qtyWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' },
  qtyBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 18, fontWeight: '600', color: colors.foreground },
  qtyNum: { minWidth: 28, textAlign: 'center' as const, fontSize: 15, fontWeight: '600', color: colors.foreground },
  itemPrice: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  summaryCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: PAD, marginTop: 8, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: colors.mutedForeground },
  summaryValue: { fontSize: 14, color: colors.foreground },
  summaryHighlight: { color: colors.success, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  totalValue: { fontSize: 18, fontWeight: '700', color: colors.primary },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { fontSize: 12, color: colors.mutedForeground },
  footer: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, paddingHorizontal: PAD, paddingTop: 12, backgroundColor: colors.background },
  cta: { height: 54, backgroundColor: colors.primary, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  ctaPressed: { opacity: 0.9 },
  ctaLabel: { color: colors.card, fontSize: 17, fontWeight: '600' },
  empty: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.foreground, marginTop: 16 },
  emptySub: { fontSize: 15, color: colors.mutedForeground, marginTop: 8 },
  emptyBtn: { marginTop: 24, backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: radius.xl },
  emptyBtnLabel: { color: colors.card, fontSize: 16, fontWeight: '600' },
});
