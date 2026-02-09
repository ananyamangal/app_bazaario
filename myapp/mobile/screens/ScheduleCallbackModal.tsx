import React, { useState, useEffect } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { apiPostAuth } from '../api/client';

const PAD = 16;
const TIME_SLOTS = [
  { label: '9:00 AM - 12:00 PM', hour: 9 },
  { label: '12:00 PM - 3:00 PM', hour: 12 },
  { label: '3:00 PM - 6:00 PM', hour: 15 },
  { label: '6:00 PM - 9:00 PM', hour: 18 },
];

function getNextDays(count: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDate(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d0 = new Date(d);
  d0.setHours(0, 0, 0, 0);
  if (d0.getTime() === today.getTime()) return 'Today';
  if (d0.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

type Props = {
  visible: boolean;
  shopId: string;
  shopName: string;
  /** When true, show "shop didn't pick up" variant */
  fromDeclinedOrNoAnswer?: boolean;
  onClose: () => void;
  onScheduled?: () => void;
};

export default function ScheduleCallbackModal({
  visible,
  shopId,
  shopName,
  fromDeclinedOrNoAnswer,
  onClose,
  onScheduled,
}: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ hour: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep(0);
      setSelectedDate(null);
      setSelectedSlot(null);
    }
  }, [visible]);

  const days = getNextDays(4);

  const handleSchedulePress = () => setStep(1);

  const handleConfirm = async () => {
    if (!selectedDate || !selectedSlot) return;
    setSubmitting(true);
    try {
      const at = new Date(selectedDate);
      at.setHours(selectedSlot.hour, 0, 0, 0);
      await apiPostAuth('/calls/schedule-callback', {
        shopId,
        scheduledAt: at.toISOString(),
      });
      Alert.alert('Scheduled', `Callback scheduled with ${shopName} for ${formatDate(selectedDate)} at ${TIME_SLOTS.find(s => s.hour === selectedSlot.hour)?.label}.`);
      onScheduled?.();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not schedule callback.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(0);
    setSelectedDate(null);
    setSelectedSlot(null);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.card}>
          {step === 0 && (
            <>
              <View style={styles.iconWrap}>
                <Ionicons name="call-outline" size={40} color={colors.primary} />
              </View>
              <Text style={styles.title}>
                {fromDeclinedOrNoAnswer
                  ? "The shop didn't pick up"
                  : 'Shop is not accepting calls at the moment'}
              </Text>
              <Text style={styles.message}>
                {fromDeclinedOrNoAnswer
                  ? `Would you like to schedule a callback with ${shopName}?`
                  : `You can schedule a callback and ${shopName} will call you at your chosen time.`}
              </Text>
              <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={handleSchedulePress}>
                <Text style={styles.primaryBtnText}>Schedule callback</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} onPress={handleClose}>
                <Text style={styles.secondaryBtnText}>Maybe later</Text>
              </Pressable>
            </>
          )}

          {step === 1 && (
            <>
              <View style={styles.headerRow}>
                <Pressable onPress={() => setStep(0)} hitSlop={8}>
                  <Ionicons name="arrow-back" size={24} color={colors.foreground} />
                </Pressable>
                <Text style={styles.titleSmall}>Choose date & time</Text>
                <View style={{ width: 24 }} />
              </View>
              <Text style={styles.label}>Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll} contentContainerStyle={styles.daysContent}>
                {days.map((d) => {
                  const isSelected = selectedDate?.toDateString() === d.toDateString();
                  return (
                    <Pressable
                      key={d.toISOString()}
                      style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                      onPress={() => setSelectedDate(d)}
                    >
                      <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>{formatDate(d)}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={styles.label}>Time slot</Text>
              <View style={styles.slots}>
                {TIME_SLOTS.map((slot) => {
                  const isSelected = selectedSlot?.hour === slot.hour;
                  return (
                    <Pressable
                      key={slot.hour}
                      style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                      onPress={() => setSelectedSlot({ hour: slot.hour })}
                    >
                      <Text style={[styles.slotChipText, isSelected && styles.slotChipTextSelected]}>{slot.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                style={[styles.primaryBtn, (!selectedDate || !selectedSlot || submitting) && styles.primaryBtnDisabled, submitting && styles.pressed]}
                onPress={handleConfirm}
                disabled={!selectedDate || !selectedSlot || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.card} />
                ) : (
                  <Text style={styles.primaryBtnText}>Confirm</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: PAD,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: PAD,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 8,
  },
  titleSmall: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  message: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: colors.card },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 15, color: colors.mutedForeground },
  pressed: { opacity: 0.9 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 8 },
  daysScroll: { marginHorizontal: -PAD },
  daysContent: { paddingHorizontal: PAD, gap: 8, marginBottom: 16 },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayChipSelected: { borderColor: colors.primary, backgroundColor: colors.secondary },
  dayChipText: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  dayChipTextSelected: { color: colors.primary, fontWeight: '600' },
  slots: { gap: 8, marginBottom: 24 },
  slotChip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  slotChipSelected: { borderColor: colors.primary, backgroundColor: colors.secondary },
  slotChipText: { fontSize: 15, color: colors.foreground },
  slotChipTextSelected: { color: colors.primary, fontWeight: '600' },
});
