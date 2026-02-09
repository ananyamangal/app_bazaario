import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { apiPutAuth, apiGetAuth, apiPostAuth } from '../../api/client';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
const PAD = 16;

type Props = { onOpenConversations?: () => void };

export default function SellerProfileTabScreen({ onOpenConversations }: Props = {}) {
  const insets = useSafeAreaInsets();
  const { signOut, user, shop, profile, refreshUser } = useAuth();
  const { totalUnread } = useChat();

  // Edit modals
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editType, setEditType] = useState<'contact' | 'bank' | null>(null);
  const [saving, setSaving] = useState(false);

  // Contact form
  const [contactPhone, setContactPhone] = useState((shop as any)?.businessPhone || user?.phone || '');
  const [contactEmail, setContactEmail] = useState((shop as any)?.businessEmail || user?.email || '');

  // Bank form
  const [bankHolder, setBankHolder] = useState((shop as any)?.bankDetails?.accountHolder || '');
  const [bankAccount, setBankAccount] = useState((shop as any)?.bankDetails?.accountNumber || '');
  const [bankName, setBankName] = useState((shop as any)?.bankDetails?.bankName || '');
  const [bankIfsc, setBankIfsc] = useState((shop as any)?.bankDetails?.ifscCode || '');

  const shopId = shop?._id;
  const sellerProfile = profile as any;

  // Subscription
  type PlanId = 'Basic' | 'Pro' | 'Premium';
  const [currentPlan, setCurrentPlan] = useState<PlanId>('Basic');
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('Pro');

  const PLANS: { id: PlanId; price: number; label: string; description: string }[] = [
    { id: 'Basic', price: 0, label: 'Basic', description: 'Good for new shops just getting started.' },
    { id: 'Pro', price: 499, label: 'Pro', description: 'Boost visibility and unlock insights.' },
    { id: 'Premium', price: 999, label: 'Premium', description: 'Max exposure with full analytics.' },
  ];

  React.useEffect(() => {
    let isMounted = true;
    async function loadSubscription() {
      try {
        setSubscriptionLoading(true);
        const res = await apiGetAuth<{
          planName: string;
          price: number;
        }>('/subscriptions/me');
        if (!isMounted) return;
        const name = res.planName as PlanId;
        if (name === 'Basic' || name === 'Pro' || name === 'Premium') {
          setCurrentPlan(name);
        } else {
          setCurrentPlan('Basic');
        }
      } catch (e) {
        // Fallback to Basic
        if (isMounted) setCurrentPlan('Basic');
      } finally {
        if (isMounted) setSubscriptionLoading(false);
      }
    }
    // Only sellers care about subscription
    if (user?.role === 'seller') {
      loadSubscription();
    }
    return () => {
      isMounted = false;
    };
  }, [user?.role]);

  async function handleLogout() {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  }

  function openEditModal(type: 'contact' | 'bank') {
    setEditType(type);
    if (type === 'contact') {
      setContactPhone((shop as any)?.businessPhone || user?.phone || '');
      setContactEmail((shop as any)?.businessEmail || user?.email || '');
    } else if (type === 'bank') {
      setBankHolder((shop as any)?.bankDetails?.accountHolder || '');
      setBankAccount((shop as any)?.bankDetails?.accountNumber || '');
      setBankName((shop as any)?.bankDetails?.bankName || '');
      setBankIfsc((shop as any)?.bankDetails?.ifscCode || '');
    }
    setEditModalVisible(true);
  }

  async function handleSaveContact() {
    if (!shopId) return;
    setSaving(true);
    try {
      await apiPutAuth(`/shops/${shopId}`, {
        businessPhone: contactPhone,
        businessEmail: contactEmail,
      });
      await refreshUser();
      setEditModalVisible(false);
      Alert.alert('Success', 'Contact details updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update contact details');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBank() {
    if (!shopId) return;
    setSaving(true);
    try {
      await apiPutAuth(`/shops/${shopId}`, {
        bankDetails: {
          accountHolder: bankHolder,
          accountNumber: bankAccount,
          bankName: bankName,
          ifscCode: bankIfsc,
        },
      });
      await refreshUser();
      setEditModalVisible(false);
      Alert.alert('Success', 'Bank details updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update bank details');
    } finally {
      setSaving(false);
    }
  }

  // Mask bank account number
  const maskedAccount = (shop as any)?.bankDetails?.accountNumber 
    ? `•••• ${(shop as any).bankDetails.accountNumber.slice(-4)}`
    : 'Not set';

  async function handleConfirmUpgrade() {
    try {
      setSaving(true);
      await apiPostAuth('/subscriptions/upgrade', { planName: selectedPlan });
      setCurrentPlan(selectedPlan);
      setUpgradeModalVisible(false);
      Alert.alert('Success', `You are now on the ${selectedPlan} plan.`);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to upgrade subscription. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 100 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Profile</Text>
        {onOpenConversations && (
          <Pressable onPress={onOpenConversations} style={styles.chatIconBtn} hitSlop={8}>
            <Ionicons name="chatbubbles-outline" size={22} color={colors.foreground} />
            {totalUnread > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>

      {/* Shop info */}
      <View style={[styles.card, SHADOW]}>
        <Text style={styles.cardTitle}>Shop information</Text>
        <Text style={styles.cardText}>{shop?.name || 'Your Shop'}</Text>
        <Text style={styles.cardSub}>{shop?.description || 'No description'}</Text>
        <View style={styles.categoryRow}>
          {shop?.categories?.slice(0, 3).map((cat, i) => (
            <View key={i} style={styles.categoryTag}>
              <Text style={styles.categoryTagText}>{cat}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Seller info */}
      <View style={[styles.card, SHADOW]}>
        <Text style={styles.cardTitle}>Seller information</Text>
        <Text style={styles.cardText}>{user?.name || 'Seller'}</Text>
        <Text style={styles.cardSub}>
          {sellerProfile?.businessName || 'Business'} · {sellerProfile?.businessType || 'Retail'}
        </Text>
      </View>

      {/* Contact */}
      <View style={[styles.card, SHADOW]}>
        <Text style={styles.cardTitle}>Contact details</Text>
        <Text style={styles.cardText}>{(shop as any)?.businessPhone || user?.phone || 'Not set'}</Text>
        <Text style={styles.cardSub}>{(shop as any)?.businessEmail || user?.email || 'No email'}</Text>
        <Pressable style={({ pressed }) => [styles.link, pressed && { opacity: 0.8 }]} onPress={() => openEditModal('contact')}>
          <Text style={styles.linkText}>Edit contact</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      </View>

      {/* Bank / Payout */}
      <View style={[styles.card, SHADOW]}>
        <Text style={styles.cardTitle}>Bank / Payout details</Text>
        <Text style={styles.cardText}>{maskedAccount}</Text>
        <Text style={styles.cardSub}>{(shop as any)?.bankDetails?.bankName || 'Not configured'}</Text>
        <Pressable style={({ pressed }) => [styles.link, pressed && { opacity: 0.8 }]} onPress={() => openEditModal('bank')}>
          <Text style={styles.linkText}>Manage</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      </View>

      {/* My Subscription */}
      <View style={[styles.card, SHADOW]}>
        <Text style={styles.cardTitle}>My Subscription</Text>
        <View style={styles.subRow}>
          <View>
            <Text style={styles.planName}>{currentPlan} Plan</Text>
            <Text style={styles.planPrice}>
              {currentPlan === 'Basic' ? '₹0 / month' : currentPlan === 'Pro' ? '₹499 / month' : '₹999 / month'}
            </Text>
          </View>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>
              {subscriptionLoading ? 'Loading…' : currentPlan === 'Basic' ? 'Free' : 'Active'}
            </Text>
          </View>
        </View>
        <Text style={styles.cardSub}>
          {currentPlan === 'Basic'
            ? 'Unlock higher visibility and insights by upgrading.'
            : 'You can change your plan at any time.'}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.upgradeBtn, pressed && { opacity: 0.9 }]}
          onPress={() => {
            setSelectedPlan(currentPlan === 'Premium' ? 'Premium' : 'Pro');
            setUpgradeModalVisible(true);
          }}
        >
          <Text style={styles.upgradeBtnLabel}>
            {currentPlan === 'Basic' ? 'Upgrade plan' : 'Change plan'}
          </Text>
        </Pressable>
      </View>

      {/* Account verification */}
      <View style={[styles.card, styles.verifiedCard, SHADOW]}>
        <View style={styles.verifiedRow}>
          <Ionicons 
            name={sellerProfile?.verificationStatus === 'verified' ? 'checkmark-circle' : 'time-outline'} 
            size={24} 
            color={sellerProfile?.verificationStatus === 'verified' ? colors.success : colors.warning} 
          />
          <View style={styles.verifiedBody}>
            <Text style={styles.cardTitle}>
              {sellerProfile?.verificationStatus === 'verified' ? 'Account verified' : 'Verification pending'}
            </Text>
            <Text style={styles.cardSub}>
              {sellerProfile?.verificationStatus === 'verified' ? 'Identity & shop verified' : 'Under review'}
            </Text>
          </View>
        </View>
      </View>

      {/* Log out */}
      <Pressable onPress={handleLogout} style={({ pressed }) => [styles.logout, pressed && { opacity: 0.9 }]}>
        <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
        <Text style={styles.logoutLabel}>Log Out</Text>
      </Pressable>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditModalVisible(false)} />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editType === 'contact' ? 'Edit Contact Details' : 'Bank Details'}
                </Text>
                <Pressable onPress={() => setEditModalVisible(false)} hitSlop={8}>
                  <Ionicons name="close" size={24} color={colors.foreground} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
                {editType === 'contact' ? (
                  <>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <TextInput
                      style={styles.input}
                      value={contactPhone}
                      onChangeText={setContactPhone}
                      placeholder="Enter phone number"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="phone-pad"
                    />
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <TextInput
                      style={styles.input}
                      value={contactEmail}
                      onChangeText={setContactEmail}
                      placeholder="Enter email address"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <Pressable
                      style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }, saving && styles.saveBtnDisabled]}
                      onPress={handleSaveContact}
                      disabled={saving}
                    >
                      {saving ? <ActivityIndicator color={colors.card} /> : <Text style={styles.saveBtnText}>Save Contact</Text>}
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.inputLabel}>Account Holder Name</Text>
                    <TextInput
                      style={styles.input}
                      value={bankHolder}
                      onChangeText={setBankHolder}
                      placeholder="Enter name"
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <Text style={styles.inputLabel}>Account Number</Text>
                    <TextInput
                      style={styles.input}
                      value={bankAccount}
                      onChangeText={setBankAccount}
                      placeholder="Enter account number"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="numeric"
                    />
                    <Text style={styles.inputLabel}>Bank Name</Text>
                    <TextInput
                      style={styles.input}
                      value={bankName}
                      onChangeText={setBankName}
                      placeholder="Enter bank name"
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <Text style={styles.inputLabel}>IFSC Code</Text>
                    <TextInput
                      style={styles.input}
                      value={bankIfsc}
                      onChangeText={setBankIfsc}
                      placeholder="Enter IFSC code"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="characters"
                    />
                    <Pressable
                      style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }, saving && styles.saveBtnDisabled]}
                      onPress={handleSaveBank}
                      disabled={saving}
                    >
                      {saving ? <ActivityIndicator color={colors.card} /> : <Text style={styles.saveBtnText}>Save Bank Details</Text>}
                    </Pressable>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Upgrade Subscription Modal */}
      <Modal
        visible={upgradeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUpgradeModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setUpgradeModalVisible(false)} />
            <View style={[styles.modalContent, { maxHeight: '80%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose your plan</Text>
                <Pressable onPress={() => setUpgradeModalVisible(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.foreground} />
                </Pressable>
              </View>

              {PLANS.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                const isCurrent = currentPlan === plan.id;
                return (
                  <Pressable
                    key={plan.id}
                    onPress={() => setSelectedPlan(plan.id)}
                    style={({ pressed }) => [
                      styles.planCard,
                      isSelected && styles.planCardSelected,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <View style={styles.planCardHeader}>
                      <Text style={styles.planCardTitle}>{plan.label}</Text>
                      <Text style={styles.planCardPrice}>₹{plan.price} / month</Text>
                    </View>
                    <Text style={styles.planCardDesc}>{plan.description}</Text>
                    {isCurrent && (
                      <View style={styles.currentPlanChip}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={styles.currentPlanChipText}>Current plan</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}

              <Pressable
                style={({ pressed }) => [
                  styles.saveBtn,
                  pressed && { opacity: 0.9 },
                  saving && styles.saveBtnDisabled,
                ]}
                onPress={handleConfirmUpgrade}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.card} />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {currentPlan === selectedPlan ? 'Keep this plan' : `Switch to ${selectedPlan}`}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: PAD },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: colors.foreground },
  chatIconBtn: { position: 'relative', padding: 4 },
  chatBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.card,
  },
  chatBadgeText: { fontSize: 10, fontWeight: '700', color: colors.card },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: PAD, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  cardText: { fontSize: 15, color: colors.foreground, marginTop: 6 },
  cardSub: { fontSize: 13, color: colors.mutedForeground, marginTop: 4 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.primary, marginRight: 4 },
  
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  categoryTag: { backgroundColor: colors.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.xxl },
  categoryTagText: { fontSize: 12, color: colors.foreground },
  
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  planName: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  planPrice: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  planBadge: { backgroundColor: colors.success, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.xxl },
  planBadgeText: { fontSize: 11, fontWeight: '600', color: colors.card },
  upgradeBtn: { marginTop: 12, backgroundColor: colors.primary, paddingVertical: 10, borderRadius: radius.lg, alignItems: 'center' },
  upgradeBtnLabel: { color: colors.card, fontSize: 14, fontWeight: '600' },
  
  verifiedCard: {},
  verifiedRow: { flexDirection: 'row', alignItems: 'center' },
  verifiedBody: { marginLeft: 12 },
  
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, paddingVertical: 14 },
  logoutLabel: { fontSize: 16, fontWeight: '600', color: colors.destructive },

  // Modal
  keyboardAvoid: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: PAD, paddingBottom: 32, maxHeight: '90%' },
  modalScrollContent: { paddingBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  inputLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 15,
    color: colors.foreground,
  },
  saveBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: radius.lg, alignItems: 'center', marginTop: 20 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.card, fontSize: 16, fontWeight: '600' },
  // Plan cards (upgrade modal)
  planCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 10,
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  planCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  planCardPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  planCardDesc: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  currentPlanChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  currentPlanChipText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
  },
});
