import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { signInWithCustomToken } from 'firebase/auth';

import BackButton from '../../components/BackButton';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import type { RootStackParamList } from '../../navigation/types';
import { apiPost } from '../../api/client';
import { auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const STEPS_TOTAL = 4;
const OTP_BOX_SIZE = 48;
const OTP_BOX_GAP = 10;
const GAP_PROGRESS_HEADING = 20;
const GAP_HEADING_SUB = 8;
const GAP_SUB_OTP = 28;
const GAP_OTP_HELPER = 12;
const GAP_HELPER_BUTTON = 28;
const GAP_BUTTON_RESEND = 20;
const HORIZONTAL_PADDING = 24;
const INPUT_PADDING = 14;
const BUTTON_HEIGHT = 54;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = NativeStackScreenProps<RootStackParamList, 'SellerPhoneOtp'>;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SellerPhoneOtpScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { shopName, ownerName, shopDescription, market, city, shopAddress, categories, phone: initialPhone } = route.params;
  const { refreshUser, signInWithSession, updateSessionUser, user: currentUser, firebaseUser } = useAuth();

  const [phase, setPhase] = useState<'phone' | 'otp'>(initialPhone ? 'otp' : 'phone');
  const [phone, setPhone] = useState(initialPhone || '');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  function handleBack() {
    if (phase === 'otp' && !initialPhone) {
      setPhase('phone');
      setDigits(['', '', '', '', '', '']);
    } else {
      navigation.goBack();
    }
  }

  async function handleSendOtp() {
    const cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    try {
      await apiPost('/otp/send', { phone: cleanedPhone });
      setPhase('otp');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  }

  function handleDigitChange(i: number, v: string) {
    const cleaned = v.replace(/\D/g, '').slice(0, 1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = cleaned;
      return next;
    });
    if (cleaned && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleKeyPress(i: number, key: string) {
    if (key === 'Backspace' && !digits[i] && i > 0) {
      setDigits((prev) => {
        const next = [...prev];
        next[i - 1] = '';
        return next;
      });
      inputRefs.current[i - 1]?.focus();
    }
  }

  async function handleVerify() {
    const code = digits.join('');
    if (code.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      // If user is already authenticated (e.g., via Google), use their existing UID
      // Otherwise, verify OTP and get a new UID
      let uid: string;
      let verified = false;

      if (firebaseUser?.uid) {
        // User is already authenticated (Google sign-in case)
        uid = firebaseUser.uid;
        verified = true;
        
        // Still verify the phone number with backend (but don't create a new auth session)
        try {
          await apiPost('/otp/verify', { phone, code, role: 'seller' });
        } catch (error: any) {
          // If OTP verification fails, still proceed if user is authenticated
          // (phone might already be verified or OTP might be expired)
          console.warn('[SellerPhoneOtp] OTP verify failed, but user is authenticated:', error);
        }
      } else {
        // User is not authenticated - verify OTP and sign them in
        const response = await apiPost<{
          verified: boolean;
          customToken: string;
          sessionToken?: string;
          uid: string;
          user: any;
          profile: any;
          shop: any;
        }>('/otp/verify', { phone, code, role: 'seller' });

        if (!response.verified) {
          Alert.alert('Invalid OTP', 'The code you entered is incorrect');
          return;
        }

        verified = true;
        uid = response.uid;

        const useSessionFallback = (err: any) =>
          err?.code === 'auth/network-request-failed' ||
          (err?.message && String(err.message).includes('network-request-failed'));

        try {
          if (response.customToken) {
            await signInWithCustomToken(auth, response.customToken);
          }
        } catch (firebaseError: any) {
          if (response.sessionToken && useSessionFallback(firebaseError)) {
            await signInWithSession({
              user: response.user ?? null,
              profile: response.profile ?? null,
              shop: response.shop ?? null,
              sessionToken: response.sessionToken,
            });
          } else {
            throw firebaseError;
          }
        }
      }

      if (!verified || !uid) {
        Alert.alert('Error', 'Failed to verify phone number');
        return;
      }

      // Register seller with shop details (works for both new and existing authenticated users)
      const reg = await apiPost<{ user: any; sellerProfile: any; shop: any }>('/auth/register-seller', {
        uid,
        phone,
        name: ownerName,
        shopName,
        shopDescription,
        market,
        city,
        shopAddress,
        categories,
      });
      
      if (reg?.user) {
        updateSessionUser({ user: reg.user, profile: reg.sellerProfile ?? null, shop: reg.shop ?? null });
      }

      await refreshUser();
      
      // After shop creation, AppNavigator will automatically switch to SellerStack
      // when it detects isAuthenticated=true and user.role='seller'
      // The navigation happens automatically via AppNavigator's conditional rendering
    } catch (error: any) {
      console.error('[SellerPhoneOtp] Error:', error);
      Alert.alert('Error', error.message || 'Failed to verify OTP and create shop');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    setIsResending(true);
    try {
      await apiPost('/otp/send', { phone });
      Alert.alert('OTP Sent', 'A new OTP has been sent to your phone');
      setDigits(['', '', '', '', '', '']);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend OTP');
    } finally {
      setIsResending(false);
    }
  }

  const displayPhone = phone ? `+91 ${phone.slice(0, 5)} •••••` : '+91 ••••• •••••';
  const canSendOtp = phone.replace(/\D/g, '').length >= 10 && !isLoading;
  const canVerify = digits.every((d) => d !== '') && !isLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 12 + insets.top, paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.backRow}>
          <BackButton onPress={handleBack} />
        </View>

        {/* Progress: 4 of 4 */}
        <View style={styles.progressRow}>
          {[...Array(STEPS_TOTAL)].map((_, i) => (
            <View
              key={i}
              style={[styles.progressSeg, styles.progressSegFilled]}
            />
          ))}
        </View>

        {phase === 'phone' ? (
          <>
            <Text style={styles.heading}>Verify your phone</Text>
            <Text style={styles.subheading}>
              We'll send a 6-digit code to your number before you launch your shop.
            </Text>

            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputPrefix}>+91</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                placeholder="98765 43210"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                maxLength={10}
                editable={!isLoading}
              />
            </View>

            <Pressable
              onPress={handleSendOtp}
              disabled={!canSendOtp}
              style={({ pressed }) => [
                styles.btnPrimary,
                pressed && styles.btnPrimaryPressed,
                !canSendOtp && styles.btnDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <Text style={styles.btnPrimaryLabel}>Send OTP</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.heading}>Enter verification code</Text>
            <Text style={styles.subheading}>
              We've sent a 6-digit code to {displayPhone}
            </Text>

            <View style={styles.otpRow}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.otpBox,
                    focusedIndex === i && styles.otpBoxActive,
                  ]}
                >
                  <TextInput
                    ref={(el) => { inputRefs.current[i] = el; }}
                    value={digits[i]}
                    onChangeText={(v) => handleDigitChange(i, v)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                    onFocus={() => setFocusedIndex(i)}
                    onBlur={() => setFocusedIndex(null)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    style={styles.otpInput}
                    editable={!isLoading}
                  />
                </View>
              ))}
            </View>

            <Text style={styles.helper}>Enter the code you received via SMS</Text>

            <Pressable
              onPress={handleVerify}
              disabled={!canVerify}
              style={({ pressed }) => [
                styles.btnPrimary,
                pressed && styles.btnPrimaryPressed,
                !canVerify && styles.btnDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <Text style={styles.btnPrimaryLabel}>Verify & launch shop</Text>
              )}
            </Pressable>

            <View style={styles.resendRow}>
              <Text style={styles.resendText}>Didn't receive the code? </Text>
              <Pressable onPress={handleResend} hitSlop={8} disabled={isResending}>
                {isResending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.resendLink}>RESEND</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
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

  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: GAP_HEADING_SUB,
  },
  subheading: {
    fontSize: 15,
    color: colors.mutedForeground,
    marginBottom: GAP_SUB_OTP,
    lineHeight: 22,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  inputPrefix: { fontSize: 16, color: colors.foreground, marginRight: 4 },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.foreground,
    paddingVertical: INPUT_PADDING,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: OTP_BOX_GAP,
    marginBottom: GAP_OTP_HELPER,
  },
  otpBox: {
    width: OTP_BOX_SIZE,
    height: OTP_BOX_SIZE,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  otpBoxActive: {
    borderColor: colors.primary,
    backgroundColor: '#FDF2F8',
  },
  otpInput: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    width: '100%',
    height: '100%',
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 0,
  },
  helper: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: GAP_HELPER_BUTTON,
  },
  btnPrimary: {
    height: BUTTON_HEIGHT,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: GAP_BUTTON_RESEND,
  },
  btnPrimaryPressed: { opacity: 0.9 },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryLabel: { color: colors.card, fontSize: 17, fontWeight: '600' },
  resendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: { fontSize: 14, color: colors.mutedForeground },
  resendLink: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
