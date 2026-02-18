import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '../../components/BackButton';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import type { RootStackParamList } from '../../navigation/types';
import { apiPost } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const LOGO_SIZE = 160;
const GAP_LOGO_HEADING = 20;
const GAP_HEADING_SUB = 8;
const GAP_SUB_TOGGLE = 16;
const GAP_TOGGLE_FORM = 20;
const GAP_LABEL_INPUT = 8;
const GAP_INPUT_BUTTON = 20;
const GAP_BUTTON_FOOTER = 20;
const HORIZONTAL_PADDING = 24;
const INPUT_PADDING_H = 16;
const INPUT_PADDING_V = 14;
const BUTTON_HEIGHT = 54;
const TOGGLE_PADDING = 4;
const TOGGLE_SEGMENT_PADDING_V = 12;

const SHADOW_OPACITY = 0.1;
const SHADOW_RADIUS = 6;
const SHADOW_OFFSET = { width: 0, height: 2 };

// -----------------------------------------------------------------------------
// Assets
// -----------------------------------------------------------------------------

const splashLogo: ImageSourcePropType = require('../../../assets/splashlogo.png');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

type UserType = 'Customer' | 'Seller';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [userType, setUserType] = useState<UserType>('Customer');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { /* signInWithGoogle */ } = useAuth();

  async function handleSendOtp() {
    const cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    try {
      await apiPost('/otp/send', { phone: cleanedPhone });
      // Navigate to OTP verification with phone and role
      navigation.navigate('OtpVerify', {
        phone: cleanedPhone,
        role: userType.toLowerCase() as 'customer' | 'seller',
        isLogin: true,
      } as any);
    } catch (error: any) {
      console.error('[Login] OTP send error:', error);
      Alert.alert('Error', error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleGoogleSignIn() {
    // Single Google button → then choose customer vs seller on next screen
    navigation.navigate('GoogleRoleSelect', { from: 'login' });
  }

  function handleTerms() {
    Linking.openURL('https://bazaario-privacypolicy.vercel.app/terms');
  }

  function handlePrivacy() {
    Linking.openURL('https://bazaario-privacypolicy.vercel.app/');
  }

  const canSendOtp = phone.replace(/\D/g, '').length >= 10 && !isLoading;

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.backRow}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
      <View style={styles.content}>
        <Image
          source={splashLogo}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.heading}>Welcome Back</Text>
        <Text style={styles.subheading}>Sign in to continue to Bazaario</Text>

        <View style={styles.toggle}>
          <Pressable
            onPress={() => setUserType('Customer')}
            style={[
              styles.toggleSegment,
              styles.toggleLeft,
              userType === 'Customer' && styles.toggleSegmentActive,
            ]}
          >
            <Text
              style={[
                styles.toggleLabel,
                userType === 'Customer' && styles.toggleLabelActive,
              ]}
            >
              Customer
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setUserType('Seller')}
            style={[
              styles.toggleSegment,
              styles.toggleRight,
              userType === 'Seller' && styles.toggleSegmentActive,
            ]}
          >
            <Text
              style={[
                styles.toggleLabel,
                userType === 'Seller' && styles.toggleLabelActive,
              ]}
            >
              Seller
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.inputPrefix}>+91</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
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

        <View style={styles.dividerWrap}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialRow}>
          <Pressable
            onPress={handleGoogleSignIn}
            style={({ pressed }) => [
              styles.socialBtn,
              pressed && styles.btnPrimaryPressed,
            ]}
          >
            <Ionicons name="logo-google" size={22} color="#4285F4" />
            <Text style={styles.socialBtnLabel}>Google</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>By continuing, you agree to our </Text>
          <Pressable onPress={handleTerms} hitSlop={6}>
            <Text style={styles.footerLink}>Terms of Service</Text>
          </Pressable>
          <Text style={styles.footerText}> and </Text>
          <Pressable onPress={handlePrivacy} hitSlop={6}>
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </Pressable>
        </View>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.card,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.card,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 24,
  },
  backRow: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  content: {
    alignItems: 'center',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    marginBottom: GAP_LOGO_HEADING,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: GAP_HEADING_SUB,
  },
  subheading: {
    fontSize: 16,
    color: colors.mutedForeground,
    marginBottom: GAP_SUB_TOGGLE,
  },
  toggle: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    backgroundColor: colors.muted,
    borderRadius: radius.xxl,
    padding: TOGGLE_PADDING,
    marginBottom: GAP_TOGGLE_FORM,
  },
  toggleSegment: {
    flex: 1,
    paddingVertical: TOGGLE_SEGMENT_PADDING_V,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLeft: {
    borderTopLeftRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
  },
  toggleRight: {
    borderTopRightRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  toggleSegmentActive: {
    backgroundColor: colors.primary,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  toggleLabelActive: {
    color: colors.card,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
    alignSelf: 'stretch',
    marginBottom: GAP_LABEL_INPUT,
  },
  inputWrap: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: INPUT_PADDING_H,
    marginBottom: GAP_INPUT_BUTTON,
  },
  inputPrefix: {
    fontSize: 16,
    color: colors.foreground,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.foreground,
    paddingVertical: INPUT_PADDING_V,
  },
  btnPrimary: {
    height: BUTTON_HEIGHT,
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: GAP_BUTTON_FOOTER,
    shadowColor: '#000',
    shadowOffset: SHADOW_OFFSET,
    shadowOpacity: SHADOW_OPACITY,
    shadowRadius: SHADOW_RADIUS,
    elevation: 3,
  },
  btnPrimaryPressed: {
    opacity: 0.9,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPrimaryLabel: {
    color: colors.card,
    fontSize: 17,
    fontWeight: '600',
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: GAP_BUTTON_FOOTER,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginHorizontal: 12,
  },
  socialRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 12,
    marginBottom: GAP_BUTTON_FOOTER,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: BUTTON_HEIGHT,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    shadowColor: '#000',
    shadowOffset: SHADOW_OFFSET,
    shadowOpacity: SHADOW_OPACITY,
    shadowRadius: SHADOW_RADIUS,
    elevation: 2,
  },
  socialBtnLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
