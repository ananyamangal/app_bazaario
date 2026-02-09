import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '../../components/BackButton';
import StepIndicator from '../../components/StepIndicator';
import { useCheckout, type PaymentMethod } from '../../context/CheckoutContext';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
const PAD = 16;

const METHODS: { id: PaymentMethod; label: string; icon: 'phone-portrait-outline' | 'card-outline' | 'business-outline' | 'wallet-outline' | 'cash-outline' }[] = [
  { id: 'upi', label: 'UPI', icon: 'phone-portrait-outline' },
  { id: 'card', label: 'Credit / Debit Card', icon: 'card-outline' },
  { id: 'netbanking', label: 'Net Banking', icon: 'business-outline' },
  { id: 'wallet', label: 'Wallet', icon: 'wallet-outline' },
  { id: 'cod', label: 'Cash on Delivery', icon: 'cash-outline' },
];

export default function CheckoutPaymentScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { paymentMethod, setPaymentMethod } = useCheckout();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md, paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.backRow}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <StepIndicator current={5} total={6} />
        <Text style={styles.title}>Choose Payment Method</Text>

        {METHODS.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setPaymentMethod(m.id)}
            style={[styles.methodCard, SHADOW, paymentMethod === m.id && styles.methodSelected]}
          >
            <Ionicons name={m.icon} size={24} color={paymentMethod === m.id ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.methodLabel, paymentMethod === m.id && styles.methodLabelActive]}>{m.label}</Text>
            {paymentMethod === m.id && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
          </Pressable>
        ))}

        <View style={styles.secureRow}>
          <Ionicons name="shield-checkmark" size={20} color={colors.success} />
          <Text style={styles.secureText}>Secure payment · 100% safe</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable onPress={() => navigation.navigate('CheckoutPlaceOrder' as never)} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
          <Text style={styles.ctaLabel}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: PAD },
  backRow: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  title: { fontSize: 20, fontWeight: '700', color: colors.foreground, marginBottom: 16 },
  methodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: PAD, marginBottom: 12, gap: 14 },
  methodSelected: { borderWidth: 2, borderColor: colors.primary },
  methodLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.foreground },
  methodLabelActive: { color: colors.primary, fontWeight: '600' },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  secureText: { fontSize: 14, color: colors.success, fontWeight: '500' },
  footer: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, paddingHorizontal: PAD, paddingTop: 12, backgroundColor: colors.background },
  cta: { height: 54, backgroundColor: colors.primary, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  ctaPressed: { opacity: 0.9 },
  ctaLabel: { color: colors.card, fontSize: 17, fontWeight: '600' },
});
