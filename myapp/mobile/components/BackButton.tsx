import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const BACK_BUTTON_HIT_SLOP = 12;
const BACK_ICON_SIZE = 24;
/** Min touch target 44pt: (44 - BACK_ICON_SIZE) / 2 = 10 */
const BACK_BUTTON_PADDING = 10;

type Props = {
  onPress: () => void;
  iconColor?: string;
  /** Use on hero/image overlays for better visibility */
  variant?: 'default' | 'floating';
  style?: ViewStyle;
};

export default function BackButton({
  onPress,
  iconColor = colors.foreground,
  variant = 'default',
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={BACK_BUTTON_HIT_SLOP}
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
}

const styles = StyleSheet.create({
  button: {
    padding: BACK_BUTTON_PADDING,
    marginRight: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floating: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 22,
    width: 44,
    height: 44,
    marginRight: 0,
    padding: (44 - BACK_ICON_SIZE) / 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
