import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import BackButton from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'GoogleRoleSelect'>;

export default function GoogleRoleSelectScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { signInWithGoogle } = useAuth();
  const [loadingRole, setLoadingRole] = useState<'customer' | 'seller' | null>(null);

  async function handleChoose(role: 'customer' | 'seller') {
    if (loadingRole) return;
    setLoadingRole(role);
    try {
      const result = await signInWithGoogle(role);

      // For new sellers (no shop yet), send them into onboarding flow
      if (result && result.needsProfile && role === 'seller') {
        navigation.navigate('SellerStep1');
      }
      // For existing users, AppNavigator will switch stacks automatically
    } catch (error: any) {
      if (error?.message?.toLowerCase().includes('cancel')) return;
      Alert.alert('Error', error?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoadingRole(null);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.headerRow}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Continue with Google</Text>
        <Text style={styles.subtitle}>
          How do you want to use Bazaario with your Google account?
        </Text>

        <View style={styles.cardRow}>
          <Pressable
            style={({ pressed }) => [
              styles.roleCard,
              pressed && styles.roleCardPressed,
            ]}
            onPress={() => handleChoose('customer')}
            disabled={!!loadingRole}
          >
            <View style={styles.roleIconWrap}>
              <Ionicons name="bag-handle-outline" size={26} color={colors.primary} />
            </View>
            <Text style={styles.roleTitle}>Customer</Text>
            <Text style={styles.roleSubtitle}>Shop from trusted local sellers</Text>
            {loadingRole === 'customer' && (
              <ActivityIndicator style={styles.roleSpinner} size="small" color={colors.primary} />
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.roleCard,
              pressed && styles.roleCardPressed,
            ]}
            onPress={() => handleChoose('seller')}
            disabled={!!loadingRole}
          >
            <View style={styles.roleIconWrap}>
              <Ionicons name="storefront-outline" size={26} color={colors.primary} />
            </View>
            <Text style={styles.roleTitle}>Seller</Text>
            <Text style={styles.roleSubtitle}>Create your shop and get orders</Text>
            {loadingRole === 'seller' && (
              <ActivityIndicator style={styles.roleSpinner} size="small" color={colors.primary} />
            )}
          </Pressable>
        </View>

        <View style={styles.helperTextWrap}>
          <Text style={styles.helperText}>
            You can always update your details later from settings.
          </Text>
        </View>
      </View>
    </View>
  );
}

const CARD_RADIUS = radius.xl;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
    paddingHorizontal: 24,
  },
  headerRow: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 24,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
  },
  roleCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: CARD_RADIUS,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  roleCardPressed: {
    opacity: 0.9,
  },
  roleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  roleTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 4,
  },
  roleSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  roleSpinner: {
    marginTop: 8,
  },
  helperTextWrap: {
    marginTop: 24,
  },
  helperText: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});

