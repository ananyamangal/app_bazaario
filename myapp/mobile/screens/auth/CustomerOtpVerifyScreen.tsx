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

import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import type { RootStackParamList } from '../../navigation/types';
import { apiPost } from '../../api/client';
import { auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const OTP_BOX_SIZE = 48;
const OTP_BOX_GAP = 10;
const OTP_BORDER = colors.border;
const OTP_ACTIVE = colors.primary;

const GAP_HEADING_SUB = 8;
const GAP_SUB_OTP = 28;
const GAP_OTP_HELPER = 12;
const GAP_HELPER_BUTTON = 28;
const GAP_BUTTON_RESEND = 20;
const HORIZONTAL_PADDING = 24;
const BUTTON_HEIGHT = 54;

const SHADOW_OPACITY = 0.1;
const SHADOW_RADIUS = 6;
const SHADOW_OFFSET = { width: 0, height: 2 };

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function maskPhone(v: string): string {
  if (v.length < 6) return `+91 ${v}`;
  return `+91 ${v.slice(0, 5)} •••••`;
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerOtpVerify'>;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function CustomerOtpVerifyScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { phone, name, email } = route.params;
  const { refreshUser, signInWithSession, updateSessionUser } = useAuth();

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const masked = maskPhone(phone);

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
      // Verify OTP with backend
      const response = await apiPost<{
        verified: boolean;
        isNewUser: boolean;
        customToken: string;
        sessionToken?: string;
        uid: string;
        user: any;
        profile: any;
        shop: any;
      }>('/otp/verify', { phone, code, role: 'customer' });

      if (!response.verified) {
        Alert.alert('Invalid OTP', 'The code you entered is incorrect');
        return;
      }

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

      // Complete registration with name and email
      const reg = await apiPost<{ user: any; profile: any; shop: any }>('/otp/complete-registration', {
        uid: response.uid,
        phone,
        role: 'customer',
        name,
        email,
      });
      if (reg?.user) updateSessionUser({ user: reg.user, profile: reg.profile ?? null, shop: reg.shop ?? null });

      await refreshUser();
    } catch (error: any) {
      console.error('[CustomerOtpVerify] Error:', error);
      Alert.alert('Error', error.message || 'Failed to verify OTP');
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

  const canVerify = digits.every((d) => d !== '') && !isLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: spacing.md + insets.top, paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.backRow}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>

        <Text style={styles.heading}>Verify your phone number</Text>
        <Text style={styles.subheading}>We've sent a 6-digit code to {masked}</Text>

        <View style={styles.otpRow}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={[styles.otpBox, focusedIndex === i && styles.otpBoxActive]}>
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
            styles.btnVerify,
            pressed && styles.btnVerifyPressed,
            !canVerify && styles.btnDisabled,
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.btnVerifyLabel}>Verify</Text>
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
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: GAP_HEADING_SUB,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.mutedForeground,
    marginBottom: GAP_SUB_OTP,
    lineHeight: 24,
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
    borderColor: OTP_ACTIVE,
    backgroundColor: '#EFF6FF',
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
  btnVerify: {
    height: BUTTON_HEIGHT,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: GAP_BUTTON_RESEND,
    shadowColor: '#000',
    shadowOffset: SHADOW_OFFSET,
    shadowOpacity: SHADOW_OPACITY,
    shadowRadius: SHADOW_RADIUS,
    elevation: 3,
  },
  btnVerifyPressed: { opacity: 0.9 },
  btnDisabled: { opacity: 0.5 },
  btnVerifyLabel: { color: colors.card, fontSize: 17, fontWeight: '600' },
  resendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' },
  resendText: { fontSize: 14, color: colors.mutedForeground },
  resendLink: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
