import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '../../components/BackButton';
import StepIndicator from '../../components/StepIndicator';
import { useCheckout } from '../../context/CheckoutContext';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
const PAD = 16;

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function CheckoutInvoiceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    items,
    address,
    subtotal,
    platformFee,
    discount,
    tax,
    total,
    walletBalance,
    walletApplied,
    setPromoCode,
    setPromoDiscount,
    promoCode,
  } = useCheckout();
  const [promo, setPromo] = useState(promoCode);
  const [showWallet, setShowWallet] = useState(false);
  const grandTotal = total;

  function handleApplyPromo() {
    setPromoCode(promo);
    if (promo.toUpperCase() === 'SAVE5') setPromoDiscount(Math.round(subtotal * 0.05));
    else setPromoDiscount(0);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md, paddingBottom: 120 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.backRow}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <StepIndicator current={4} total={6} />
        <Text style={styles.title}>Final invoice</Text>

        <View style={[styles.invoiceCard, SHADOW]}>
          {items.map((i) => (
            <View key={i.id} style={styles.invRow}>
              <Text style={styles.invItem}>{i.name} × {i.qty}</Text>
              <Text style={styles.invAmt}>{fmt(i.price * i.qty)}</Text>
            </View>
          ))}
          <View style={styles.invDiv} />
          <Text style={styles.invSeller}>Seller: {items[0]?.shopName ?? '—'}</Text>
          <Text style={styles.invAddr}>Deliver to: {address?.line1}, {address?.city} - {address?.pincode}</Text>
          <View style={styles.invDiv} />
          <View style={styles.invRow}><Text style={styles.invLabel}>Subtotal</Text><Text style={styles.invAmt}>{fmt(subtotal)}</Text></View>
          <View style={styles.invRow}><Text style={styles.invLabel}>Platform fee</Text><Text style={styles.invAmt}>{fmt(platformFee)}</Text></View>
          <View style={styles.invRow}><Text style={styles.invLabel}>Taxes</Text><Text style={styles.invAmt}>{fmt(tax)}</Text></View>
          {discount > 0 && <View style={styles.invRow}><Text style={[styles.invLabel, { color: colors.success }]}>Discount</Text><Text style={[styles.invAmt, { color: colors.success }]}>-{fmt(discount)}</Text></View>}
          {walletApplied > 0 && <View style={styles.invRow}><Text style={styles.invLabel}>Wallet</Text><Text style={[styles.invAmt, { color: colors.success }]}>-{fmt(walletApplied)}</Text></View>}
          <View style={[styles.invRow, styles.grandRow]}>
            <Text style={styles.grandLabel}>Grand total</Text>
            <Text style={styles.grandAmt}>{fmt(grandTotal)}</Text>
          </View>
        </View>

        <View style={[styles.promoRow, SHADOW]}>
          <TextInput style={styles.promoInput} value={promo} onChangeText={setPromo} placeholder="Promo code" placeholderTextColor={colors.mutedForeground} />
          <Pressable onPress={handleApplyPromo} style={styles.promoBtn}><Text style={styles.promoBtnText}>Apply</Text></Pressable>
        </View>

        <Pressable onPress={() => setShowWallet(!showWallet)} style={[styles.walletRow, SHADOW]}>
          <Ionicons name="wallet-outline" size={22} color={colors.primary} />
          <View style={styles.walletBody}>
            <Text style={styles.walletLabel}>Wallet credits</Text>
            <Text style={styles.walletBal}>Balance: {fmt(walletBalance)}</Text>
          </View>
          <Text style={styles.walletUse}>{walletApplied > 0 ? `-${fmt(walletApplied)}` : 'Use'}</Text>
        </Pressable>

        <Pressable hitSlop={8} style={styles.policy}>
          <Text style={styles.policyText}>Order cancellation policy</Text>
          <Ionicons name="open-outline" size={14} color={colors.primary} />
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable onPress={() => navigation.navigate('CheckoutPayment' as never)} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
          <Text style={styles.ctaLabel}>Continue to Payment</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: PAD },
  backRow: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  title: { fontSize: 20, fontWeight: '700', color: colors.foreground, marginBottom: 16 },
  invoiceCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: PAD, marginBottom: 16 },
  invRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  invItem: { fontSize: 14, color: colors.foreground },
  invAmt: { fontSize: 14, color: colors.foreground },
  invLabel: { fontSize: 14, color: colors.mutedForeground },
  invDiv: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  invSeller: { fontSize: 13, color: colors.mutedForeground },
  invAddr: { fontSize: 13, color: colors.mutedForeground, marginTop: 4, marginBottom: 8 },
  grandRow: { marginTop: 8 },
  grandLabel: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  grandAmt: { fontSize: 18, fontWeight: '700', color: colors.primary },
  promoRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 12 },
  promoInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: colors.foreground },
  promoBtn: { paddingHorizontal: 20, justifyContent: 'center' },
  promoBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  walletRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: PAD, marginBottom: 16 },
  walletBody: { flex: 1, marginLeft: 12 },
  walletLabel: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  walletBal: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  walletUse: { fontSize: 14, fontWeight: '600', color: colors.primary },
  policy: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  policyText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  footer: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, paddingHorizontal: PAD, paddingTop: 12, backgroundColor: colors.background },
  cta: { height: 54, backgroundColor: colors.primary, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  ctaPressed: { opacity: 0.9 },
  ctaLabel: { color: colors.card, fontSize: 17, fontWeight: '600' },
});
