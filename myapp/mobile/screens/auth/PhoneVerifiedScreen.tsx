import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/types';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const PHONE_WIDTH = 100;
const PHONE_HEIGHT = 180;
const PHONE_RADIUS = 20;
const CHECK_SIZE = 56;
const DECO_CIRCLE_SIZE = 160;

const GAP_ILLUSTRATION_HEADING = 28;
const GAP_HEADING_SUB = 10;
const GAP_SUB_BUTTON = 36;
const HORIZONTAL_PADDING = 24;
const BUTTON_HEIGHT = 54;

const SHADOW_OPACITY = 0.12;
const SHADOW_RADIUS = 8;
const SHADOW_OFFSET = { width: 0, height: 2 };

const PHONE_BG = '#F3F4F6';
const PHONE_OUTLINE = '#78350F';
const ACCENT_BLUE = '#BFDBFE';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneVerified'>;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function PhoneVerifiedScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { refreshUser } = useAuth();

  async function handleContinue() {
    // Refresh user data - conditional navigation will redirect automatically
    await refreshUser();
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.illustration}>
          <View style={styles.decoCircle} />
          <Text style={[styles.deco, styles.decoPlus1]}>+</Text>
          <Text style={[styles.deco, styles.decoPlus2]}>+</Text>
          <Text style={[styles.deco, styles.decoPlus3]}>+</Text>
          <View style={[styles.deco, styles.decoDot1]} />
          <View style={[styles.deco, styles.decoDot2]} />
          <View style={styles.phone}>
            <View style={styles.phoneSpeaker} />
            <View style={styles.phoneScreen}>
              <Ionicons
                name="checkmark-circle"
                size={CHECK_SIZE}
                color={colors.success}
              />
            </View>
            <View style={styles.phoneHome} />
          </View>
        </View>

        <Text style={styles.heading}>Your phone number has been verified!</Text>
        <Text style={styles.subheading}>You're all set to start shopping!</Text>

        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [styles.btnContinue, pressed && styles.btnContinuePressed]}
        >
          <Text style={styles.btnContinueLabel}>Continue</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustration: {
    width: 200,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: GAP_ILLUSTRATION_HEADING,
  },
  decoCircle: {
    position: 'absolute',
    left: -40,
    top: 20,
    width: DECO_CIRCLE_SIZE,
    height: DECO_CIRCLE_SIZE,
    borderRadius: DECO_CIRCLE_SIZE / 2,
    backgroundColor: ACCENT_BLUE,
    opacity: 0.6,
  },
  deco: {
    position: 'absolute',
  },
  decoPlus1: {
    left: 24,
    top: 40,
    fontSize: 14,
    color: colors.foreground,
    opacity: 0.4,
  },
  decoPlus2: {
    right: 20,
    top: 80,
    fontSize: 12,
    color: colors.foreground,
    opacity: 0.35,
  },
  decoPlus3: {
    left: 16,
    bottom: 50,
    fontSize: 10,
    color: colors.foreground,
    opacity: 0.3,
  },
  decoDot1: {
    right: 28,
    top: 50,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.foreground,
    opacity: 0.35,
  },
  decoDot2: {
    left: 32,
    bottom: 70,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.foreground,
    opacity: 0.3,
  },
  phone: {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    borderRadius: PHONE_RADIUS,
    backgroundColor: PHONE_BG,
    borderWidth: 2,
    borderColor: PHONE_OUTLINE,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  phoneSpeaker: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: PHONE_OUTLINE,
    opacity: 0.8,
  },
  phoneScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneHome: {
    width: 28,
    height: 6,
    borderRadius: 3,
    backgroundColor: PHONE_OUTLINE,
    opacity: 0.8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.success,
    textAlign: 'center',
    marginBottom: GAP_HEADING_SUB,
    paddingHorizontal: 8,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: GAP_SUB_BUTTON,
  },
  btnContinue: {
    height: BUTTON_HEIGHT,
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: SHADOW_OFFSET,
    shadowOpacity: SHADOW_OPACITY,
    shadowRadius: SHADOW_RADIUS,
    elevation: 3,
  },
  btnContinuePressed: {
    opacity: 0.9,
  },
  btnContinueLabel: {
    color: colors.card,
    fontSize: 17,
    fontWeight: '600',
  },
});
