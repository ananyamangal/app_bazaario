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

type Props = NativeStackScreenProps<RootStackParamList, 'SellerStep1'>;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SellerStep1Screen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [shopDescription, setShopDescription] = useState('');

  function handleBack() {
    navigation.goBack();
  }

  function handleNext() {
    navigation.navigate('SellerStep2', { shopName, ownerName, shopDescription });
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 12 + insets.top, paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.backRow}>
          <BackButton onPress={handleBack} />
        </View>

        {/* Progress: 1 of 4 */}
        <View style={styles.progressRow}>
          {[...Array(STEPS_TOTAL)].map((_, i) => (
            <View
              key={i}
              style={[styles.progressSeg, i < 1 ? styles.progressSegFilled : styles.progressSegEmpty]}
            />
          ))}
        </View>

        <Text style={styles.heading}>Tell us about your Shop</Text>
        <Text style={styles.subheading}>Create your digital storefront in seconds.</Text>

        <Text style={styles.label}>Shop Name</Text>
        <TextInput
          style={styles.input}
          value={shopName}
          onChangeText={setShopName}
          placeholder="e.g. Ramesh Textiles"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Owner Name</Text>
        <TextInput
          style={styles.input}
          value={ownerName}
          onChangeText={setOwnerName}
          placeholder="Your Full Name"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Shop Description</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={shopDescription}
          onChangeText={setShopDescription}
          placeholder="What do you sell? Any specialties?"
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPrimaryPressed]}
        >
          <Text style={styles.btnPrimaryLabel}>Next step</Text>
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
  inputMultiline: { minHeight: 100, paddingTop: INPUT_PADDING },
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
