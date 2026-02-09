import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';

type Props = { current: number; total: number };

export default function StepIndicator({ current, total }: Props) {
  return (
    <View style={styles.row}>
      {[...Array(total)].map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i + 1 <= current ? styles.dotActive : styles.dotInactive,
            i + 1 === current && styles.dotCurrent,
          ]}
        />
      ))}
      <Text style={styles.label}>Step {current} of {total}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: colors.primary },
  dotInactive: { backgroundColor: colors.border },
  dotCurrent: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 12, color: colors.mutedForeground, marginLeft: 8 },
});
