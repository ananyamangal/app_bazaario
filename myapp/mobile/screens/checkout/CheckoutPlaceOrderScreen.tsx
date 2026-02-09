import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '../../components/BackButton';
import StepIndicator from '../../components/StepIndicator';
import { useCheckout } from '../../context/CheckoutContext';
import { apiPostAuth } from '../../api/client';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
const PAD = 16;

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function CheckoutPlaceOrderScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { items, address, total, schedule, shopId, paymentMethod, contact, resetCheckout } = useCheckout();
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handlePlaceOrder() {
    if (!accepted || !address || !shopId) return;
    
    // Validate address has required fields
    if (!address.line1 || !address.line1.trim()) {
      Alert.alert('Address Required', 'Please add a valid delivery address with street details');
      return;
    }
    
    setIsLoading(true);
    try {
      // Prepare order data
      const orderData = {
        shopId,
        items: items.map(item => ({
          productId: item.id,
          quantity: item.qty,
        })),
        deliveryAddress: {
          label: address.label || 'Home',
          line1: address.line1.trim(),
          line2: address.line2 || '',
          city: address.city || 'Delhi',
          state: address.state || 'Delhi',
          pincode: address.pincode || '',
          phone: contact.phone || '',
        },
        deliverySchedule: schedule.type === 'scheduled' ? {
          date: schedule.date,
          timeSlot: schedule.time,
        } : undefined,
        paymentMethod: paymentMethod || 'cod',
        notes: contact.notes,
      };

      console.log('[Order] Placing order with data:', JSON.stringify(orderData, null, 2));
      
      // Create order via API
      const response = await apiPostAuth<{ order: any; message: string }>('/orders', orderData);
      
      console.log('[Order] Created:', response.order._id);
      
      // Clear cart and reset checkout
      resetCheckout();
      
      // Navigate to success screen
      navigation.replace('CheckoutSuccess' as never);
    } catch (error: any) {
      console.error('[Order] Failed:', error);
      
      // Check if it's a product not found error
      if (error.message?.includes('Product') && error.message?.includes('not found')) {
        Alert.alert(
          'Cart Updated',
          'Some products in your cart are no longer available. Please clear your cart and add items again.',
          [
            {
              text: 'Clear Cart',
              style: 'destructive',
              onPress: () => {
                resetCheckout();
                navigation.navigate('Cart' as never);
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('Order Failed', error.message || 'Failed to place order. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md, paddingBottom: 140 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.backRow}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <StepIndicator current={6} total={6} />
        <Text style={styles.title}>Place order</Text>

        <View style={[styles.summaryCard, SHADOW]}>
          <Text style={styles.summaryTitle}>Order summary</Text>
          {items.slice(0, 3).map((i) => (
            <Text key={i.id} style={styles.summaryRow}>{i.name} × {i.qty}</Text>
          ))}
          {items.length > 3 && <Text style={styles.summaryRow}>+{items.length - 3} more</Text>}
          <Text style={styles.summaryAddr}>To: {address?.line1}, {address?.city}</Text>
          <Text style={styles.summarySchedule}>{schedule.type === 'instant' ? 'Instant' : 'Scheduled'}</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{fmt(total)}</Text>
          </View>
        </View>

        <Pressable onPress={() => setAccepted(!accepted)} style={styles.tcRow}>
          <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
            {accepted && <Ionicons name="checkmark" size={14} color={colors.card} />}
          </View>
          <Text style={styles.tcText}>I agree to the terms & conditions and cancellation policy.</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable
          onPress={handlePlaceOrder}
          disabled={!accepted || isLoading}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, (!accepted || isLoading) && styles.ctaDisabled]}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.ctaLabel}>Place Order</Text>
          )}
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
  summaryCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: PAD, marginBottom: 20 },
  summaryTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground, marginBottom: 12 },
  summaryRow: { fontSize: 14, color: colors.mutedForeground, marginBottom: 4 },
  summaryAddr: { fontSize: 13, color: colors.mutedForeground, marginTop: 8 },
  summarySchedule: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  totalValue: { fontSize: 18, fontWeight: '700', color: colors.primary },
  tcRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tcText: { flex: 1, fontSize: 14, color: colors.foreground },
  footer: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, paddingHorizontal: PAD, paddingTop: 12, backgroundColor: colors.background },
  cta: { height: 54, backgroundColor: colors.primary, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  ctaPressed: { opacity: 0.9 },
  ctaDisabled: { opacity: 0.5 },
  ctaLabel: { color: colors.card, fontSize: 17, fontWeight: '600' },
});
