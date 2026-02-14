import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import BackButton from '../../components/BackButton';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import type { RootStackParamList } from '../../navigation/types';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const STEPS_TOTAL = 4;
const CATEGORIES = [
  { id: 'apparel', label: 'Apparel' },
  { id: 'footwear', label: 'Footwear' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'fabrics', label: 'Fabrics' },
  { id: 'jewelry', label: 'Jewelry' },
  { id: 'decor', label: 'Decor' },
  { id: 'bags', label: 'Bags' },
];

const GAP_PROGRESS_HEADING = 20;
const GAP_HEADING_SUB = 8;
const GAP_SUB_GRID = 20;
const GAP_GRID_BUTTONS = 28;
const GAP_BUTTONS = 12;
const HORIZONTAL_PADDING = 24;
const BUTTON_HEIGHT = 54;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = NativeStackScreenProps<RootStackParamList, 'SellerStep3'>;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SellerStep3Screen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { shopName, ownerName, shopDescription, market, city, shopAddress } = route.params;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function handleBack() {
    navigation.goBack();
  }

  function toggleCategory(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleLaunchShop() {
    // Goes to phone + OTP; after verify, shop is launched
    navigation.navigate('SellerPhoneOtp', {
      shopName,
      ownerName,
      shopDescription,
      market,
      city,
      shopAddress,
      categories: Array.from(selected),
    });
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingTop: spacing.md + insets.top, paddingBottom: 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.backRow}>
        <BackButton onPress={handleBack} />
      </View>

      {/* Progress: 3 of 4 */}
      <View style={styles.progressRow}>
        {[...Array(STEPS_TOTAL)].map((_, i) => (
          <View
            key={i}
            style={[styles.progressSeg, i < 3 ? styles.progressSegFilled : styles.progressSegEmpty]}
          />
        ))}
      </View>

      <Text style={styles.heading}>What do you sell?</Text>
      <Text style={styles.subheading}>Select all categories that apply.</Text>

      <View style={styles.grid}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => toggleCategory(c.id)}
            style={({ pressed }) => [styles.categoryItem, pressed && styles.categoryItemPressed]}
          >
            <View style={[styles.checkbox, selected.has(c.id) && styles.checkboxChecked]}>
              {selected.has(c.id) && <Ionicons name="checkmark" size={16} color={colors.card} />}
            </View>
            <Text style={styles.categoryLabel}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.btnBack, pressed && styles.btnBackPressed]}
        >
          <Text style={styles.btnBackLabel}>Back</Text>
        </Pressable>
        <Pressable
          onPress={handleLaunchShop}
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPrimaryPressed]}
        >
          <Text style={styles.btnPrimaryLabel}>Launch shop</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.card },
  scrollContent: { paddingHorizontal: HORIZONTAL_PADDING },
  backRow: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: GAP_PROGRESS_HEADING,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressSegFilled: { backgroundColor: colors.primary },
  progressSegEmpty: { backgroundColor: colors.muted },

  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: GAP_HEADING_SUB,
  },
  subheading: {
    fontSize: 15,
    color: colors.mutedForeground,
    marginBottom: GAP_SUB_GRID,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: GAP_GRID_BUTTONS,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  categoryItemPressed: { opacity: 0.9 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryLabel: { fontSize: 15, fontWeight: '500', color: colors.foreground },

  buttonRow: {
    flexDirection: 'row',
    gap: GAP_BUTTONS,
  },
  btnBack: {
    flex: 1,
    height: BUTTON_HEIGHT,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.foreground,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnBackPressed: { opacity: 0.9 },
  btnBackLabel: { fontSize: 17, fontWeight: '600', color: colors.foreground },
  btnPrimary: {
    flex: 1,
    height: BUTTON_HEIGHT,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimaryPressed: { opacity: 0.9 },
  btnPrimaryLabel: { color: colors.card, fontSize: 17, fontWeight: '600' },
});
