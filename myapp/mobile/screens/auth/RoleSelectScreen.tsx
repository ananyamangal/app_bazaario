import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackButton from '../../components/BackButton';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import type { RootStackParamList } from '../../navigation/types';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const IMAGE_HEIGHT = 420;
const IMAGE_MAX_WIDTH = 620;
const GAP_IMAGE_TITLE = 24;
const GAP_TITLE_SUBTITLE = 8;
const GAP_SUBTITLE_BUTTONS = 28;
const GAP_BUTTONS = 14;
const GAP_BUTTONS_FOOTER = 32;
const HORIZONTAL_PADDING = 24;
const BUTTON_HEIGHT = 54;

const SHADOW_OPACITY = 0.1;
const SHADOW_RADIUS = 6;
const SHADOW_OFFSET = { width: 0, height: 2 };

// -----------------------------------------------------------------------------
// Assets
// -----------------------------------------------------------------------------

const roleSelectImage: ImageSourcePropType = require('../../../assets/Screenshot_2026-01-25_at_4.26.52_PM-removebg-preview.png');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = NativeStackScreenProps<RootStackParamList, 'RoleSelect'>;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function RoleSelectScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  function handleJoinAsCustomer() {
    navigation.navigate('CustomerSignUp');
  }

  function handleJoinAsSeller() {
    navigation.navigate('SellerStep1');
  }

  function handleLogin() {
    navigation.navigate('Login');
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.md }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.backRow}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
      <View style={styles.content}>
        <Image
          source={roleSelectImage}
          style={styles.image}
          resizeMode="contain"
        />

        <Text style={styles.title}>Join Bazaario</Text>
        <Text style={styles.subtitle}>Choose how you want to use Bazaario.</Text>

        <Pressable
          onPress={handleJoinAsCustomer}
          style={({ pressed }) => [styles.btnFilled, pressed && styles.btnFilledPressed]}
        >
          <Text style={styles.btnFilledLabel}>Join as Customer</Text>
        </Pressable>

        <Pressable
          onPress={handleJoinAsSeller}
          style={({ pressed }) => [styles.btnOutlined, pressed && styles.btnOutlinedPressed]}
        >
          <Text style={styles.btnOutlinedLabel}>Join as Seller</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable onPress={handleLogin} hitSlop={8}>
            <Text style={styles.footerLink}>Login</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.card,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 32,
  },
  backRow: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  content: {
    alignItems: 'center',
  },
  image: {
    height: IMAGE_HEIGHT,
    maxWidth: IMAGE_MAX_WIDTH,
    width: '100%',
    marginBottom: GAP_IMAGE_TITLE,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: GAP_TITLE_SUBTITLE,
  },
  subtitle: {
    fontSize: 16,
    color: colors.mutedForeground,
    marginBottom: GAP_SUBTITLE_BUTTONS,
    textAlign: 'center',
  },
  btnFilled: {
    height: BUTTON_HEIGHT,
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: GAP_BUTTONS,
    shadowColor: '#000',
    shadowOffset: SHADOW_OFFSET,
    shadowOpacity: SHADOW_OPACITY,
    shadowRadius: SHADOW_RADIUS,
    elevation: 3,
  },
  btnFilledPressed: {
    opacity: 0.9,
  },
  btnFilledLabel: {
    color: colors.card,
    fontSize: 17,
    fontWeight: '600',
  },
  btnOutlined: {
    height: BUTTON_HEIGHT,
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: GAP_BUTTONS_FOOTER,
  },
  btnOutlinedPressed: {
    opacity: 0.9,
  },
  btnOutlinedLabel: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 15,
    color: colors.mutedForeground,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
});
