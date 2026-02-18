import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import BackButton from './BackButton';

type Props = {
  onBack: () => void;
  title?: string;
  right?: React.ReactNode;
  /** Use when back is over a light/white background (e.g. hero) so icon stays visible */
  backIconColor?: string;
  /** If true, header has no bottom border and uses default background */
  transparent?: boolean;
};

export default function ScreenHeader({
  onBack,
  title,
  right,
  backIconColor = colors.foreground,
  transparent = false,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing.sm,
          paddingHorizontal: spacing.md,
        },
        !transparent && styles.headerBordered,
      ]}
    >
      <BackButton onPress={onBack} iconColor={backIconColor} withPadding={false} />
      {title != null ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.spacer} />
      )}
      {right != null ? right : <View style={styles.placeholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  headerBordered: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginLeft: spacing.xs,
  },
  spacer: {
    flex: 1,
  },
  placeholder: {
    width: 24,
    minHeight: 44,
  },
});
