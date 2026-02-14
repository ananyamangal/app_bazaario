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

import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';
import type { RootStackParamList } from '../../navigation/types';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const LOGO_HEIGHT = 120;
const LOGO_MAX_WIDTH = 200;
const BUTTON_HEIGHT = 52;
const GAP_LOGO_BUTTONS = 32;
const GAP_BUTTONS = 12;
const GAP_DIVIDER = 24;
const HORIZONTAL_PADDING = 24;
const DIVIDER_LABEL_MARGIN = 12;

const SHADOW_OPACITY = 0.12;
const SHADOW_RADIUS = 8;
const SHADOW_OFFSET = { width: 0, height: 2 };

// -----------------------------------------------------------------------------
// Assets
// -----------------------------------------------------------------------------

const splashLogo: ImageSourcePropType = require('../../../assets/splashlogo.png');

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

type AuthScreenProps = NativeStackScreenProps<RootStackParamList, 'Auth'>;

export default function AuthScreen({ navigation }: AuthScreenProps) {

  function handleLogin() {
    navigation.navigate('Login');
  }

  function handleRegister() {
    navigation.navigate('RoleSelect');
  }

  async function handleGoogle() {
    // Navigate to role selection first, then user can choose customer or seller
    navigation.navigate('RoleSelect');
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <Image
          source={splashLogo}
          style={styles.logo}
          resizeMode="contain"
        />

        <Pressable
          onPress={handleLogin}
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPrimaryPressed]}
        >
          <Text style={styles.btnPrimaryLabel}>Login</Text>
        </Pressable>

        <Pressable
          onPress={handleRegister}
          style={({ pressed }) => [styles.btnOutlined, pressed && styles.btnOutlinedPressed]}
        >
          <Text style={styles.btnOutlinedLabel}>Register</Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          onPress={handleGoogle}
          style={({ pressed }) => [styles.btnSocial, pressed && styles.btnSocialPressed]}
        >
          <Text style={styles.btnSocialLabel}>Continue with Google</Text>
        </Pressable>
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
    justifyContent: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 40,
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    height: LOGO_HEIGHT,
    maxWidth: LOGO_MAX_WIDTH,
    marginBottom: GAP_LOGO_BUTTONS,
  },
  btnPrimary: {
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
  btnPrimaryPressed: {
    opacity: 0.9,
  },
  btnPrimaryLabel: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
  },
  btnOutlined: {
    height: BUTTON_HEIGHT,
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: GAP_DIVIDER,
  },
  btnOutlinedPressed: {
    opacity: 0.85,
  },
  btnOutlinedLabel: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: GAP_DIVIDER,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    color: colors.mutedForeground,
    fontSize: 14,
    marginHorizontal: DIVIDER_LABEL_MARGIN,
  },
  btnSocial: {
    height: BUTTON_HEIGHT,
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: GAP_BUTTONS,
  },
  btnSocialPressed: {
    backgroundColor: colors.muted,
  },
  btnSocialLabel: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '500',
  },
});
