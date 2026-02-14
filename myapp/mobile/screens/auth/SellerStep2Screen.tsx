import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
const GAP_PROGRESS_HEADING = 20;
const GAP_HEADING_SUB = 8;
const GAP_SUB_FIELDS = 24;
const GAP_LABEL_INPUT = 8;
const GAP_FIELDS = 20;
const GAP_BUTTON = 32;
const HORIZONTAL_PADDING = 24;
const INPUT_PADDING = 14;
const BUTTON_HEIGHT = 54;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = NativeStackScreenProps<RootStackParamList, 'SellerStep2'>;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SellerStep2Screen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { shopName, ownerName, shopDescription } = route.params;
  const [market, setMarket] = useState('');
  const [city, setCity] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleBack() {
    navigation.goBack();
  }

  function handleProceed() {
    const missing: string[] = [];
    if (!market.trim()) missing.push('Market');
    if (!city.trim()) missing.push('City');
    if (!shopAddress.trim()) missing.push('Shop Number / Address');
    if (missing.length > 0) {
      setError('Please fill in all required fields.');
      return;
    }
    setError(null);
    navigation.navigate('SellerStep3', {
      shopName,
      ownerName,
      shopDescription,
      market: market.trim(),
      city: city.trim(),
      shopAddress: shopAddress.trim(),
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: spacing.md + insets.top, paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.backRow}>
          <BackButton onPress={handleBack} />
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Progress: 2 of 4 */}
        <View style={styles.progressRow}>
          {[...Array(STEPS_TOTAL)].map((_, i) => (
            <View
              key={i}
              style={[styles.progressSeg, i < 2 ? styles.progressSegFilled : styles.progressSegEmpty]}
            />
          ))}
        </View>

        <Text style={styles.heading}>Where are you located?</Text>
        <Text style={styles.subheading}>Help customers find your physical store.</Text>

        <Text style={styles.label}>Market</Text>
        <TextInput
          style={styles.input}
          value={market}
          onChangeText={(v) => { setMarket(v); setError(null); }}
          placeholder="e.g. Sarojini Nagar"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
        />

        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={(v) => { setCity(v); setError(null); }}
          placeholder="e.g. New Delhi"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Shop Number / Address</Text>
        <TextInput
          style={styles.input}
          value={shopAddress}
          onChangeText={(v) => { setShopAddress(v); setError(null); }}
          placeholder="e.g. Shop 12, Main lane"
          placeholderTextColor={colors.mutedForeground}
        />

        <Pressable
          onPress={handleProceed}
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPrimaryPressed]}
        >
          <Text style={styles.btnPrimaryLabel}>Proceed</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: HORIZONTAL_PADDING },
  backRow: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: GAP_PROGRESS_HEADING,
  },
  errorBanner: {
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  errorText: { fontSize: 14, color: colors.foreground },
  progressSeg: {
    flex: 1,
    minWidth: 40,
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
    marginBottom: GAP_SUB_FIELDS,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: GAP_LABEL_INPUT,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: INPUT_PADDING,
    fontSize: 16,
    color: colors.foreground,
    marginBottom: GAP_FIELDS,
  },
  btnPrimary: {
    height: BUTTON_HEIGHT,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: GAP_BUTTON,
  },
  btnPrimaryPressed: { opacity: 0.9 },
  btnPrimaryLabel: { color: colors.card, fontSize: 17, fontWeight: '600' },
});
