import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

export default function CheckoutScheduleScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { schedule, setSchedule } = useCheckout();
  const [type, setType] = useState<'instant' | 'scheduled'>(schedule.type);

  function handleContinue() {
    setSchedule(type === 'instant' ? { type: 'instant' } : { type: 'scheduled', date: 'Tomorrow', time: '10:00 AM - 12:00 PM' });
    navigation.navigate('CheckoutInvoice' as never);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md, paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.backRow}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <StepIndicator current={3} total={6} />
        <Text style={styles.title}>Delivery / Service</Text>
        <Text style={styles.sub}>Choose when you want your order.</Text>

        <Pressable onPress={() => setType('instant')} style={[styles.opt, SHADOW, type === 'instant' && styles.optSelected]}>
          <Ionicons name="flash" size={24} color={type === 'instant' ? colors.primary : colors.mutedForeground} />
          <View style={styles.optBody}>
            <Text style={styles.optTitle}>Instant</Text>
            <Text style={styles.optSub}>As soon as the seller confirms</Text>
          </View>
          {type === 'instant' && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
        </Pressable>

        <Pressable onPress={() => setType('scheduled')} style={[styles.opt, SHADOW, type === 'scheduled' && styles.optSelected]}>
          <Ionicons name="calendar" size={24} color={type === 'scheduled' ? colors.primary : colors.mutedForeground} />
          <View style={styles.optBody}>
            <Text style={styles.optTitle}>Scheduled</Text>
            <Text style={styles.optSub}>Pick a date & time slot</Text>
          </View>
          {type === 'scheduled' && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
        </Pressable>

        {type === 'scheduled' && (
          <View style={[styles.pickerCard, SHADOW]}>
            <Text style={styles.pickerLabel}>Preferred date & time</Text>
            <Pressable style={styles.pickerBtn}>
              <Text style={styles.pickerBtnText}>Tomorrow, 10:00 AM - 12:00 PM</Text>
              <Ionicons name="chevron-down" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )}

        <View style={styles.estimate}>
          <Ionicons name="time-outline" size={18} color={colors.mutedForeground} />
          <Text style={styles.estimateText}>Estimated: Same day (instant) or as per slot</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable onPress={handleContinue} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
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
  title: { fontSize: 20, fontWeight: '700', color: colors.foreground, marginBottom: 4 },
  sub: { fontSize: 15, color: colors.mutedForeground, marginBottom: 20 },
  opt: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: PAD, marginBottom: 12 },
  optSelected: { borderWidth: 2, borderColor: colors.primary },
  optBody: { flex: 1, marginLeft: 14 },
  optTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  optSub: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  pickerCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: PAD, marginTop: 8, marginBottom: 16 },
  pickerLabel: { fontSize: 14, fontWeight: '500', color: colors.foreground, marginBottom: 8 },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14 },
  pickerBtnText: { fontSize: 15, color: colors.foreground },
  estimate: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  estimateText: { fontSize: 13, color: colors.mutedForeground },
  footer: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, paddingHorizontal: PAD, paddingTop: 12, backgroundColor: colors.background },
  cta: { height: 54, backgroundColor: colors.primary, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  ctaPressed: { opacity: 0.9 },
  ctaLabel: { color: colors.card, fontSize: 17, fontWeight: '600' },
});
