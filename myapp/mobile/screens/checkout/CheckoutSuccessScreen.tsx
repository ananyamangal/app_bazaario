import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';

const ORDER_ID = 'BZ' + Date.now().toString(36).toUpperCase().slice(-8);
const ESTIMATED = 'Today by 6 PM';

export default function CheckoutSuccessScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  function handleTrack() {
    // TODO: navigate to order tracking
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }

  function handleHome() {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark-circle" size={80} color={colors.success} />
      </View>
      <Text style={styles.title}>Order placed!</Text>
      <Text style={styles.sub}>Thank you for shopping with Bazaario.</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Order ID</Text>
        <Text style={styles.orderId}>{ORDER_ID}</Text>
        <View style={styles.estimateRow}>
          <Ionicons name="time-outline" size={18} color={colors.mutedForeground} />
          <Text style={styles.estimateText}>Estimated delivery: {ESTIMATED}</Text>
        </View>
      </View>

      <View style={styles.btns}>
        <Pressable onPress={handleTrack} style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}>
          <Text style={styles.btnPrimaryLabel}>Track Order</Text>
        </Pressable>
        <Pressable onPress={handleHome} style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.pressed]}>
          <Text style={styles.btnSecondaryLabel}>Go to Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24, alignItems: 'center' },
  iconWrap: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '700', color: colors.foreground, marginBottom: 8 },
  sub: { fontSize: 16, color: colors.mutedForeground, marginBottom: 32 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, width: '100%', marginBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  cardLabel: { fontSize: 13, color: colors.mutedForeground, marginBottom: 4 },
  orderId: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  estimateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  estimateText: { fontSize: 14, color: colors.mutedForeground },
  btns: { width: '100%', gap: 12 },
  btn: { height: 54, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: { borderWidth: 2, borderColor: colors.primary },
  pressed: { opacity: 0.9 },
  btnPrimaryLabel: { color: colors.card, fontSize: 17, fontWeight: '600' },
  btnSecondaryLabel: { color: colors.primary, fontSize: 17, fontWeight: '600' },
});
