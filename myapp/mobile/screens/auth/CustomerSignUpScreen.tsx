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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '../../components/BackButton';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import type { RootStackParamList } from '../../navigation/types';
import { apiPost } from '../../api/client';

const LOGO_SIZE = 120;
const HORIZONTAL_PADDING = 24;
const INPUT_PADDING_H = 16;
const INPUT_PADDING_V = 14;
const BUTTON_HEIGHT = 54;
const SHADOW_OFFSET = { width: 0, height: 2 };

const splashLogo: ImageSourcePropType = require('../../../assets/splashlogo.png');

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerSignUp'>;

export default function CustomerSignUpScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSendOtp() {
    const cleaned = phone.replace(/\D/g, '').slice(0, 10);
    if (cleaned.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    try {
      await apiPost('/otp/send', { phone: cleaned });
      navigation.navigate('CustomerOtpVerify', {
        phone: cleaned,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  }

  const canSendOtp = phone.replace(/\D/g, '').length >= 10 && !isLoading;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.md }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.backRow}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>

        <Image source={splashLogo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.heading}>Sign up</Text>
        <Text style={styles.subheading}>Create an account to shop from local stores.</Text>

        <Text style={styles.label}>Name (optional)</Text>
        <TextInput
          style={styles.inputFull}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
          editable={!isLoading}
        />

        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.prefix}>+91</Text>
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

        <Text style={styles.label}>Email (optional)</Text>
        <TextInput
          style={styles.inputFull}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoading}
        />

        <Pressable
          onPress={handleSendOtp}
          disabled={!canSendOtp}
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed, !canSendOtp && styles.disabled]}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.btnLabel}>Send OTP</Text>
          )}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>By signing up, you agree to our </Text>
          <Pressable onPress={() => Linking.openURL('https://bazaario-privacypolicy.vercel.app/terms')} hitSlop={6}>
            <Text style={styles.footerLink}>Terms of Service</Text>
          </Pressable>
          <Text style={styles.footerText}> and </Text>
          <Pressable onPress={() => Linking.openURL('https://bazaario-privacypolicy.vercel.app/')} hitSlop={6}>
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </Pressable>
          <Text style={styles.footerText}>.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: HORIZONTAL_PADDING, paddingBottom: 32 },
  backRow: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE, alignSelf: 'center', marginBottom: 20 },
  heading: { fontSize: 26, fontWeight: '700', color: colors.foreground, marginBottom: 8 },
  subheading: { fontSize: 16, color: colors.mutedForeground, marginBottom: 20 },
  toggle: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.xxl, padding: 4, marginBottom: 20 },
  toggleSeg: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  toggleLeft: { borderTopLeftRadius: radius.xl, borderBottomLeftRadius: radius.xl },
  toggleRight: { borderTopRightRadius: radius.xl, borderBottomRightRadius: radius.xl },
  toggleActive: { backgroundColor: colors.primary },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.mutedForeground },
  toggleLabelActive: { color: colors.card },
  label: { fontSize: 15, fontWeight: '500', color: colors.foreground, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: INPUT_PADDING_H, marginBottom: 24 },
  prefix: { fontSize: 16, color: colors.foreground, marginRight: 4 },
  input: { flex: 1, fontSize: 16, color: colors.foreground, paddingVertical: INPUT_PADDING_V },
  inputFull: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: INPUT_PADDING_H, paddingVertical: INPUT_PADDING_V, fontSize: 16, color: colors.foreground, marginBottom: 24 },
  btnPrimary: { height: BUTTON_HEIGHT, backgroundColor: colors.primary, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: SHADOW_OFFSET, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
  btnLabel: { color: colors.card, fontSize: 17, fontWeight: '600' },
  orRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { marginHorizontal: 12, fontSize: 14, color: colors.mutedForeground },
  footer: { marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center' },
  footerLink: { fontSize: 13, fontWeight: '600', color: colors.primary },
});
