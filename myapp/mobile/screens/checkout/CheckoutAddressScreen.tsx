import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '../../components/BackButton';
import StepIndicator from '../../components/StepIndicator';
import { useCheckout, SavedAddress } from '../../context/CheckoutContext';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
const PAD = 16;

export default function CheckoutAddressScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { address, setAddress, savedAddresses, contact, setContact } = useCheckout();

  // New address form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLabel, setNewLabel] = useState('Home');
  const [newLine1, setNewLine1] = useState('');
  const [newLine2, setNewLine2] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('Delhi');
  const [newPincode, setNewPincode] = useState('');

  function handleAddAddress() {
    if (!newLine1 || !newCity || !newPincode) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }
    
    const newAddress: SavedAddress = {
      id: `new-${Date.now()}`,
      label: newLabel,
      line1: newLine1,
      line2: newLine2,
      city: newCity,
      state: newState,
      pincode: newPincode,
    };
    
    setAddress(newAddress);
    setShowAddModal(false);
    // Reset form
    setNewLine1('');
    setNewLine2('');
    setNewCity('');
    setNewPincode('');
  }

  const addresses = savedAddresses.length > 0 ? savedAddresses : [];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md, paddingBottom: 120 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.backRow}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <StepIndicator current={2} total={6} />
        <Text style={styles.title}>Delivery / Service Address</Text>

        {addresses.length === 0 && !address && (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No saved addresses</Text>
            <Text style={styles.emptySubtext}>Add a delivery address to continue</Text>
          </View>
        )}

        {addresses.map((a) => (
          <Pressable key={a.id} onPress={() => setAddress(a)} style={[styles.addressCard, SHADOW, address?.id === a.id && styles.addressSelected]}>
            <View style={styles.radio}>
              {address?.id === a.id && <View style={styles.radioInner} />}
            </View>
            <View style={styles.addressBody}>
              <Text style={styles.addressLabel}>{a.label}</Text>
              <Text style={styles.addressLine}>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</Text>
              <Text style={styles.addressCity}>{a.city} - {a.pincode}</Text>
            </View>
          </Pressable>
        ))}

        {/* Show current address if it's a new one not in saved list */}
        {address && !addresses.find(a => a.id === address.id) && (
          <View style={[styles.addressCard, SHADOW, styles.addressSelected]}>
            <View style={styles.radio}>
              <View style={styles.radioInner} />
            </View>
            <View style={styles.addressBody}>
              <Text style={styles.addressLabel}>{address.label}</Text>
              <Text style={styles.addressLine}>{address.line1}{address.line2 ? `, ${address.line2}` : ''}</Text>
              <Text style={styles.addressCity}>{address.city} - {address.pincode}</Text>
            </View>
          </View>
        )}

        <Pressable style={[styles.addAddr, styles.addAddrBorder]} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.addAddrText}>Add New Address</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Contact details</Text>
        <View style={[styles.card, SHADOW]}>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput style={styles.input} value={contact.name} onChangeText={(v) => setContact({ name: v })} placeholder="Your name" placeholderTextColor={colors.mutedForeground} />
          <Text style={styles.inputLabel}>Phone</Text>
          <TextInput style={styles.input} value={contact.phone} onChangeText={(v) => setContact({ phone: v })} placeholder="10-digit mobile" placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" maxLength={10} />
          <Text style={styles.inputLabel}>Notes for seller (optional)</Text>
          <TextInput style={[styles.input, styles.inputArea]} value={contact.notes} onChangeText={(v) => setContact({ notes: v })} placeholder="Delivery instructions, preferences..." placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable 
          onPress={() => {
            if (!address) {
              Alert.alert('Address Required', 'Please add or select a delivery address');
              return;
            }
            if (!address.line1 || !address.line1.trim()) {
              Alert.alert('Invalid Address', 'The selected address is missing street details. Please add a new address.');
              return;
            }
            navigation.navigate('CheckoutSchedule' as never);
          }} 
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, !address && styles.ctaDisabled]}
        >
          <Text style={styles.ctaLabel}>Continue</Text>
        </Pressable>
      </View>

      {/* Add Address Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Address</Text>
              <Pressable onPress={() => setShowAddModal(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Address Label</Text>
              <View style={styles.labelRow}>
                {['Home', 'Work', 'Other'].map((label) => (
                  <Pressable
                    key={label}
                    style={[styles.labelChip, newLabel === label && styles.labelChipActive]}
                    onPress={() => setNewLabel(label)}
                  >
                    <Text style={[styles.labelChipText, newLabel === label && styles.labelChipTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.inputLabel}>Address Line 1 *</Text>
              <TextInput
                style={styles.input}
                value={newLine1}
                onChangeText={setNewLine1}
                placeholder="House no., Building, Street"
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={styles.inputLabel}>Address Line 2</Text>
              <TextInput
                style={styles.input}
                value={newLine2}
                onChangeText={setNewLine2}
                placeholder="Area, Landmark (optional)"
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={styles.inputLabel}>City *</Text>
              <TextInput
                style={styles.input}
                value={newCity}
                onChangeText={setNewCity}
                placeholder="City"
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={styles.inputLabel}>State</Text>
              <TextInput
                style={styles.input}
                value={newState}
                onChangeText={setNewState}
                placeholder="State"
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={styles.inputLabel}>Pincode *</Text>
              <TextInput
                style={styles.input}
                value={newPincode}
                onChangeText={setNewPincode}
                placeholder="Pincode"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                maxLength={6}
              />
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.modalBtn, pressed && { opacity: 0.9 }]}
              onPress={handleAddAddress}
            >
              <Text style={styles.modalBtnText}>Add Address</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: PAD },
  backRow: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  title: { fontSize: 20, fontWeight: '700', color: colors.foreground, marginBottom: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.foreground, marginTop: 12 },
  emptySubtext: { fontSize: 14, color: colors.mutedForeground, marginTop: 4 },
  addressCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.card, borderRadius: radius.lg, padding: PAD, marginBottom: 12 },
  addressSelected: { borderWidth: 2, borderColor: colors.primary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  addressBody: { flex: 1 },
  addressLabel: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  addressLine: { fontSize: 14, color: colors.mutedForeground, marginTop: 4 },
  addressCity: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  addAddr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, marginBottom: 24 },
  addAddrBorder: { borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' as const, borderRadius: radius.lg, justifyContent: 'center' },
  addAddrText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: PAD },
  inputLabel: { fontSize: 14, fontWeight: '500', color: colors.foreground, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.foreground, backgroundColor: colors.background },
  inputArea: { minHeight: 80, textAlignVertical: 'top' },
  footer: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, paddingHorizontal: PAD, paddingTop: 12, backgroundColor: colors.background },
  cta: { height: 54, backgroundColor: colors.primary, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  ctaPressed: { opacity: 0.9 },
  ctaDisabled: { opacity: 0.5 },
  ctaLabel: { color: colors.card, fontSize: 17, fontWeight: '600' },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: PAD, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  labelRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  labelChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.xxl, backgroundColor: colors.muted },
  labelChipActive: { backgroundColor: colors.primary },
  labelChipText: { fontSize: 14, fontWeight: '500', color: colors.mutedForeground },
  labelChipTextActive: { color: colors.card },
  modalBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: radius.xl, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  modalBtnText: { color: colors.card, fontSize: 16, fontWeight: '600' },
});
