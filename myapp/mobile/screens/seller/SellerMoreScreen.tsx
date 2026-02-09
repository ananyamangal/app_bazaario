import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
const PAD = 16;

const ITEMS = [
  { icon: 'settings-outline' as const, label: 'Settings' },
  { icon: 'help-circle-outline' as const, label: 'Help & Support' },
  { icon: 'document-text-outline' as const, label: 'Policies' },
  { icon: 'information-circle-outline' as const, label: 'About Bazaario' },
];

export default function SellerMoreScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>More</Text>
      <View style={[styles.card, SHADOW]}>
        {ITEMS.map((item, i) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.rowPressed,
              i < ITEMS.length - 1 && styles.rowBorder,
            ]}
          >
            <Ionicons name={item.icon} size={22} color={colors.primary} />
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: PAD },
  title: { fontSize: 22, fontWeight: '700', color: colors.foreground, marginBottom: 20 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: PAD, gap: 12 },
  rowPressed: { backgroundColor: colors.muted },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.foreground },
});
