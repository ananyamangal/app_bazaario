import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenHeader from '../components/ScreenHeader';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { useAuth } from '../context/AuthContext';
import { apiPutAuth } from '../api/client';

const PAD = 16;

type Props = {
  onBack: () => void;
};

export default function EditProfileScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { user, profile, refreshUser } = useAuth();
  const customerProfile = profile as any;

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);

  // Address fields
  const defaultAddress = customerProfile?.addresses?.[0] || {};
  const [addressLabel, setAddressLabel] = useState(defaultAddress.label || 'Home');
  const [line1, setLine1] = useState(defaultAddress.line1 || '');
  const [line2, setLine2] = useState(defaultAddress.line2 || '');
  const [city, setCity] = useState(defaultAddress.city || '');
  const [state, setState] = useState(defaultAddress.state || '');
  const [pincode, setPincode] = useState(defaultAddress.pincode || '');

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setSaving(true);
    try {
      // Update user profile
      await apiPutAuth('/users/profile', {
        name: name.trim(),
        email: email.trim() || undefined,
        address: {
          label: addressLabel,
          line1: line1.trim(),
          line2: line2.trim(),
          city: city.trim(),
          state: state.trim() || 'Delhi',
          pincode: pincode.trim(),
        },
      });

      await refreshUser();
      Alert.alert('Success', 'Profile updated successfully');
      onBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <ScreenHeader onBack={onBack} title="Edit Profile" right={<View style={{ width: 24 }} />} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Personal Info */}
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={user?.phone || ''}
            editable={false}
          />
          <Text style={styles.inputHint}>Phone number cannot be changed</Text>

          <Text style={styles.inputLabel}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Address */}
        <Text style={styles.sectionTitle}>Default Address</Text>
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Address Label</Text>
          <View style={styles.labelRow}>
            {['Home', 'Work', 'Other'].map((label) => (
              <Pressable
                key={label}
                style={[styles.labelChip, addressLabel === label && styles.labelChipActive]}
                onPress={() => setAddressLabel(label)}
              >
                <Text style={[styles.labelChipText, addressLabel === label && styles.labelChipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.inputLabel}>Address Line 1</Text>
          <TextInput
            style={styles.input}
            value={line1}
            onChangeText={setLine1}
            placeholder="House no., Building, Street"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={styles.inputLabel}>Address Line 2</Text>
          <TextInput
            style={styles.input}
            value={line2}
            onChangeText={setLine2}
            placeholder="Area, Landmark (optional)"
            placeholderTextColor={colors.mutedForeground}
          />

          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>City</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>State</Text>
              <TextInput
                style={styles.input}
                value={state}
                onChangeText={setState}
                placeholder="State"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Pincode</Text>
          <TextInput
            style={styles.input}
            value={pincode}
            onChangeText={setPincode}
            placeholder="Pincode"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            maxLength={6}
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: PAD, paddingTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: PAD,
    marginBottom: 20,
  },
  inputLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 15,
    color: colors.foreground,
  },
  inputDisabled: { backgroundColor: colors.muted, color: colors.mutedForeground },
  inputHint: { fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
  labelRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  labelChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.xxl,
    backgroundColor: colors.muted,
  },
  labelChipActive: { backgroundColor: colors.primary },
  labelChipText: { fontSize: 14, fontWeight: '500', color: colors.mutedForeground },
  labelChipTextActive: { color: colors.card },
  rowInputs: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  saveBtn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: radius.xl,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.card, fontSize: 16, fontWeight: '600' },
});
