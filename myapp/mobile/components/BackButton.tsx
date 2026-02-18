import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

/** Minimum touch target (iOS HIG). Hit area extended so button is easy to tap. */
const MIN_TOUCH_TARGET = 44;
const BACK_ICON_SIZE = 24;
/** Padding so icon + padding = MIN_TOUCH_TARGET */
const BACK_BUTTON_PADDING = (MIN_TOUCH_TARGET - BACK_ICON_SIZE) / 2;
/** Extra hit area around the button for easier tapping */
const HIT_SLOP = { top: 16, bottom: 16, left: 16, right: 16 };

type Props = {
  onPress: () => void;
  iconColor?: string;
  /** Use on hero/image overlays for better visibility */
  variant?: 'default' | 'floating';
  /** Wrap in a padded container so the button has proper top/row padding and is always clickable (default true) */
  withPadding?: boolean;
  style?: ViewStyle;
};

export default function BackButton({
  onPress,
  iconColor = colors.foreground,
  variant = 'default',
  withPadding = true,
  style,
}: Props) {
  const pressable = (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      style={({ pressed }) => [
        styles.button,
        variant === 'floating' && styles.floating,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityLabel="Go back"
      accessibilityRole="button"
    >
      <Ionicons name="arrow-back" size={BACK_ICON_SIZE} color={iconColor} />
    </Pressable>
  );

  if (withPadding && variant === 'default') {
    return <View style={styles.paddedWrapper}>{pressable}</View>;
  }
  return pressable;
}

const styles = StyleSheet.create({
  paddedWrapper: {
    alignSelf: 'flex-start',
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    marginBottom: spacing.sm,
    justifyContent: 'center',
  },
  button: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    padding: BACK_BUTTON_PADDING,
    marginRight: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floating: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 22,
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    marginRight: 0,
    padding: BACK_BUTTON_PADDING,
  },
  pressed: {
    opacity: 0.7,
  },
});
